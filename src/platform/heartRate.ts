/**
 * Heart-rate straps over BLE.
 *
 * Uses the standard Bluetooth SIG Heart Rate Service (0x180D). On the web that
 * is Web Bluetooth (Chromium); on Capacitor Android/iOS it is native BLE via
 * @capacitor-community/bluetooth-le, because System WebView has no Web Bluetooth.
 */

import { bleSupported, connectNativeNotify, isNativeBle, webBluetoothSupported } from './ble';

// Full 128-bit UUIDs — some Chromium builds reject short GATT aliases.
// SIG: Heart Rate service 0x180D, measurement 0x2A37.
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

export type HeartStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';

export interface HeartHandlers {
  onReading(bpm: number): void;
  onStatus(status: HeartStatus, detail?: string): void;
}

export function bluetoothSupported(): boolean {
  return bleSupported();
}

/**
 * Decode a Heart Rate Measurement characteristic.
 *
 * Bit 0 of the flags byte says whether the value is 8- or 16-bit. Straps
 * genuinely use both — the 16-bit form exists for rates above 255 bpm, which no
 * human produces, but a few devices set it anyway — and reading a 16-bit value
 * as 8-bit gives a plausible-looking wrong number rather than an obvious error.
 */
export function parseHeartRate(view: DataView): number | null {
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  const sixteenBit = (flags & 0x01) === 1;
  if (sixteenBit) {
    if (view.byteLength < 3) return null;
    // Bluetooth characteristics are little-endian.
    return view.getUint16(1, true);
  }
  return view.getUint8(1);
}

export interface HeartConnection {
  disconnect(): void;
  deviceName: string;
}

function emitBpm(handlers: HeartHandlers, view: DataView): void {
  const bpm = parseHeartRate(view);
  // A strap reporting 0 has lost skin contact; passing it on would drag the
  // average down and paint a zone-1 stripe through the middle of a hard run.
  if (bpm !== null && bpm > 0) handlers.onReading(bpm);
}

/**
 * Open the device chooser and start streaming.
 *
 * Must be called straight from a click (user gesture) for both Web Bluetooth
 * and the native plugin chooser.
 */
export async function connectHeartRate(handlers: HeartHandlers): Promise<HeartConnection | null> {
  if (!bluetoothSupported()) {
    handlers.onStatus(
      'unsupported',
      'Bluetooth is not available here. Use the Android app build or Chrome on Android.',
    );
    return null;
  }

  handlers.onStatus('connecting');

  if (isNativeBle()) {
    try {
      const conn = await connectNativeNotify({
        serviceUuid: HEART_RATE_SERVICE,
        characteristicUuid: HEART_RATE_MEASUREMENT,
        nameHint: 'Heart rate monitor',
        onValue: (value) => emitBpm(handlers, value),
        onDisconnected: () => handlers.onStatus('disconnected', 'The strap disconnected.'),
      });
      handlers.onStatus('connected', conn.deviceName);
      return {
        deviceName: conn.deviceName,
        disconnect: () => {
          void conn.disconnect().then(() => handlers.onStatus('disconnected'));
        },
      };
    } catch (error) {
      return handleConnectError(error, handlers);
    }
  }

  // --- Web Bluetooth (Chrome / Edge) ---------------------------------------
  if (!webBluetoothSupported()) {
    handlers.onStatus('unsupported', 'This browser has no Web Bluetooth.');
    return null;
  }

  try {
    const bluetooth = (navigator as Navigator & { bluetooth: any }).bluetooth;
    const device = await bluetooth.requestDevice({
      filters: [{ services: [HEART_RATE_SERVICE] }],
      optionalServices: [HEART_RATE_SERVICE],
    });

    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);

    const onChange = (event: Event) => {
      const value = (event.target as unknown as { value: DataView }).value;
      emitBpm(handlers, value);
    };

    characteristic.addEventListener('characteristicvaluechanged', onChange);
    await characteristic.startNotifications();

    const onDisconnect = () => handlers.onStatus('disconnected', 'The strap disconnected.');
    device.addEventListener('gattserverdisconnected', onDisconnect);

    handlers.onStatus('connected', device.name ?? 'Heart rate monitor');

    return {
      deviceName: device.name ?? 'Heart rate monitor',
      disconnect: () => {
        characteristic.removeEventListener('characteristicvaluechanged', onChange);
        device.removeEventListener('gattserverdisconnected', onDisconnect);
        try {
          characteristic.stopNotifications().catch(() => {});
          if (device.gatt?.connected) device.gatt.disconnect();
        } catch {
          // Already gone.
        }
        handlers.onStatus('disconnected');
      },
    };
  } catch (error) {
    return handleConnectError(error, handlers);
  }
}

function handleConnectError(error: unknown, handlers: HeartHandlers): null {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancelled|canceled|user gesture|No device selected|user denied/i.test(message)) {
    handlers.onStatus('disconnected');
  } else {
    handlers.onStatus('disconnected', message);
  }
  return null;
}
