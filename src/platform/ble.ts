/**
 * Shared BLE helpers for Capacitor (Android/iOS) vs Web Bluetooth (Chrome).
 *
 * Android System WebView does not implement Web Bluetooth, so native BLE via
 * @capacitor-community/bluetooth-le is required for straps and foot pods in the
 * Capacitor APK. The browser path keeps using navigator.bluetooth.
 */

import { Capacitor } from '@capacitor/core';
import { BleClient, numbersToDataView, type ScanResult } from '@capacitor-community/bluetooth-le';

let nativeInitialized = false;

export function isNativeBle(): boolean {
  return Capacitor.isNativePlatform();
}

export function webBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** True if we can open a BLE chooser on this host (native plugin or Web Bluetooth). */
export function bleSupported(): boolean {
  return isNativeBle() || webBluetoothSupported();
}

export async function ensureNativeBle(): Promise<void> {
  if (!isNativeBle()) return;
  if (nativeInitialized) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  nativeInitialized = true;
}

/**
 * Request a device that advertises `serviceUuid` and subscribe to notifications
 * on that service's characteristic.
 */
export async function connectNativeNotify(options: {
  serviceUuid: string;
  characteristicUuid: string;
  nameHint?: string;
  onValue(data: DataView): void;
  onDisconnected(): void;
}): Promise<{ deviceId: string; deviceName: string; disconnect(): Promise<void> }> {
  await ensureNativeBle();

  const device = await BleClient.requestDevice({
    services: [options.serviceUuid],
    optionalServices: [options.serviceUuid],
  });

  const deviceId = device.deviceId;
  const deviceName = device.name?.trim() || options.nameHint || 'Bluetooth device';

  await BleClient.connect(deviceId, () => {
    options.onDisconnected();
  });

  await BleClient.startNotifications(
    deviceId,
    options.serviceUuid,
    options.characteristicUuid,
    (value) => {
      options.onValue(value);
    },
  );

  return {
    deviceId,
    deviceName,
    disconnect: async () => {
      try {
        await BleClient.stopNotifications(
          deviceId,
          options.serviceUuid,
          options.characteristicUuid,
        );
      } catch {
        /* already gone */
      }
      try {
        await BleClient.disconnect(deviceId);
      } catch {
        /* already gone */
      }
    },
  };
}

/** Re-export for callers that need scan results typed. */
export type { ScanResult };

/** Unused helper kept for future write paths (e.g. HR control point). */
export function toDataView(bytes: number[]): DataView {
  return numbersToDataView(bytes);
}
