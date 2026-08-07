/**
 * Heart-rate straps over Web Bluetooth.
 *
 * Uses the standard Bluetooth SIG Heart Rate Service (0x180D), which every
 * mainstream chest strap and most watches implement. That is the whole appeal:
 * no vendor SDK, no account, no cloud round-trip — the strap talks directly to
 * the page.
 *
 * The API is Chromium-only and requires HTTPS plus a real user gesture to open
 * the chooser, so everything here is written to fail politely rather than to
 * assume it will work.
 */

// Full 128-bit UUIDs — some Chromium builds reject short GATT aliases
// (same class of failure as rsc_feature on the foot pod).
// SIG: Heart Rate service 0x180D, measurement 0x2A37.
const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

export type HeartStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';

export interface HeartHandlers {
  onReading(bpm: number): void;
  onStatus(status: HeartStatus, detail?: string): void;
}

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
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

/**
 * Open the device chooser and start streaming.
 *
 * Must be called straight from a click: Chrome rejects `requestDevice` without a
 * user gesture, and an await before it can lose that gesture.
 */
export async function connectHeartRate(handlers: HeartHandlers): Promise<HeartConnection | null> {
  if (!bluetoothSupported()) {
    handlers.onStatus('unsupported', 'This browser has no Web Bluetooth. Chrome on Android works.');
    return null;
  }

  handlers.onStatus('connecting');

  try {
    const bluetooth = (navigator as Navigator & { bluetooth: any }).bluetooth;
    const device = await bluetooth.requestDevice({
      filters: [{ services: [HEART_RATE_SERVICE] }],
      // Measurement lives on the primary HR service; no extra optional UUIDs.
      optionalServices: [HEART_RATE_SERVICE],
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);

    const onChange = (event: Event) => {
      const value = (event.target as unknown as { value: DataView }).value;
      const bpm = parseHeartRate(value);
      // A strap reporting 0 has lost skin contact; passing it on would drag the
      // average down and paint a zone-1 stripe through the middle of a hard run.
      if (bpm !== null && bpm > 0) handlers.onReading(bpm);
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
          // Stopping notifications first lets the strap drop back to advertising
          // instead of sitting in a half-open connection until it times out.
          characteristic.stopNotifications().catch(() => {});
          if (device.gatt.connected) device.gatt.disconnect();
        } catch {
          // Already gone. Nothing to do.
        }
        handlers.onStatus('disconnected');
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Cancelling the chooser is a normal thing to do, not an error worth shouting about.
    if (/cancelled|user gesture|No device selected/i.test(message)) {
      handlers.onStatus('disconnected');
    } else {
      handlers.onStatus('disconnected', message);
    }
    return null;
  }
}
