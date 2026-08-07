/**
 * Foot pods over BLE (Running Speed and Cadence profile).
 *
 * Web Bluetooth on Chromium; native BLE on Capacitor Android/iOS.
 * Zwift RunPod and most shoe pods use the standard RSC service (0x1814).
 */

import { parseRscMeasurement, type RscMeasurement } from '../core/footpod';
import {
  asDataView,
  bleSupported,
  connectNativeNotify,
  isNativeBle,
  webBluetoothSupported,
} from './ble';

// Full 128-bit UUIDs — Chrome rejects some short aliases (e.g. rsc_feature).
// SIG: RSC service 0x1814, measurement 0x2A53, feature 0x2A54.
const RSC_SERVICE = '00001814-0000-1000-8000-00805f9b34fb';
const RSC_MEASUREMENT = '00002a53-0000-1000-8000-00805f9b34fb';
const RSC_FEATURE = '00002a54-0000-1000-8000-00805f9b34fb';

export type FootpodStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';

export interface FootpodHandlers {
  onMeasurement(measurement: RscMeasurement): void;
  onStatus(status: FootpodStatus, detail?: string): void;
}

export interface FootpodConnection {
  disconnect(): void;
  deviceName: string;
}

export function bluetoothSupported(): boolean {
  return bleSupported();
}

function emitMeasurement(handlers: FootpodHandlers, raw: unknown): void {
  const view = asDataView(raw);
  const measurement = parseRscMeasurement(view);
  if (measurement) handlers.onMeasurement(measurement);
}

/**
 * Open the chooser and start streaming.
 *
 * Must be called straight from a click. Zwift RunPod often only advertises and
 * streams while it is moving — shake the pod if it does not appear or stays silent.
 */
export async function connectFootpod(handlers: FootpodHandlers): Promise<FootpodConnection | null> {
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
      let packetCount = 0;
      const conn = await connectNativeNotify({
        serviceUuid: RSC_SERVICE,
        characteristicUuid: RSC_MEASUREMENT,
        optionalServices: [RSC_SERVICE, RSC_FEATURE],
        nameHint: 'Foot pod',
        nameHints: ['Zwift', 'RunPod', 'Run Pod', 'STRYD', 'Foot'],
        onValue: (value) => {
          packetCount++;
          emitMeasurement(handlers, value);
        },
        onDisconnected: () => handlers.onStatus('disconnected', 'The foot pod disconnected.'),
      });
      handlers.onStatus(
        'connected',
        conn.deviceName.includes('Zwift') || /run\s*pod/i.test(conn.deviceName)
          ? `${conn.deviceName} · shake/move to stream`
          : conn.deviceName,
      );

      // If nothing arrives for a few seconds, nudge the user (common with Zwift).
      window.setTimeout(() => {
        if (packetCount === 0) {
          handlers.onStatus(
            'connected',
            `${conn.deviceName} · waiting for motion (shake the pod)`,
          );
        }
      }, 4000);

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

  if (!webBluetoothSupported()) {
    handlers.onStatus('unsupported', 'This browser has no Web Bluetooth.');
    return null;
  }

  try {
    const bluetooth = (navigator as Navigator & { bluetooth: any }).bluetooth;
    const device = await bluetooth.requestDevice({
      filters: [{ services: [RSC_SERVICE] }],
      optionalServices: [RSC_SERVICE, RSC_FEATURE],
    });

    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(RSC_SERVICE);
    const characteristic = await service.getCharacteristic(RSC_MEASUREMENT);

    const onChange = (event: Event) => {
      const value = (event.target as unknown as { value: DataView }).value;
      emitMeasurement(handlers, value);
    };

    characteristic.addEventListener('characteristicvaluechanged', onChange);
    await characteristic.startNotifications();

    const onDisconnect = () => handlers.onStatus('disconnected', 'The foot pod disconnected.');
    device.addEventListener('gattserverdisconnected', onDisconnect);

    handlers.onStatus('connected', device.name ?? 'Foot pod');

    return {
      deviceName: device.name ?? 'Foot pod',
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

function handleConnectError(error: unknown, handlers: FootpodHandlers): null {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancelled|canceled|user gesture|No device selected|user denied/i.test(message)) {
    handlers.onStatus('disconnected');
  } else {
    handlers.onStatus('disconnected', message);
  }
  return null;
}
