/**
 * Foot pods over Web Bluetooth.
 *
 * Structurally identical to the heart-rate strap — a standard SIG service, a
 * notifying characteristic, no vendor SDK — which is the whole argument for
 * having built against the standard profiles in the first place.
 */

import { parseRscMeasurement, type RscMeasurement } from '../core/footpod';

const RSC_SERVICE = 'running_speed_and_cadence';
const RSC_MEASUREMENT = 'rsc_measurement';
const RSC_FEATURE = 'rsc_feature';

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
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Open the chooser and start streaming.
 *
 * Must be called straight from a click — Chrome refuses `requestDevice`
 * without a user gesture, and an await beforehand can lose it.
 */
export async function connectFootpod(handlers: FootpodHandlers): Promise<FootpodConnection | null> {
  if (!bluetoothSupported()) {
    handlers.onStatus('unsupported', 'This browser has no Web Bluetooth. Chrome on Android works.');
    return null;
  }

  handlers.onStatus('connecting');

  try {
    const bluetooth = (navigator as Navigator & { bluetooth: any }).bluetooth;
    const device = await bluetooth.requestDevice({
      filters: [{ services: [RSC_SERVICE] }],
      optionalServices: [RSC_FEATURE],
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(RSC_SERVICE);
    const characteristic = await service.getCharacteristic(RSC_MEASUREMENT);

    const onChange = (event: Event) => {
      const value = (event.target as unknown as { value: DataView }).value;
      const measurement = parseRscMeasurement(value);
      if (measurement) handlers.onMeasurement(measurement);
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
          if (device.gatt.connected) device.gatt.disconnect();
        } catch {
          // Already gone.
        }
        handlers.onStatus('disconnected');
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancelled|user gesture|No device selected/i.test(message)) {
      handlers.onStatus('disconnected');
    } else {
      handlers.onStatus('disconnected', message);
    }
    return null;
  }
}
