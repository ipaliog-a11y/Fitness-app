/**
 * Shared BLE helpers for Capacitor (Android/iOS) vs Web Bluetooth (Chrome).
 *
 * Android System WebView has no Web Bluetooth, so native BLE via
 * @capacitor-community/bluetooth-le is required for straps and foot pods.
 */

import { Capacitor } from '@capacitor/core';
import {
  BleClient,
  numberToUUID,
  numbersToDataView,
  type BleService,
  type ScanResult,
} from '@capacitor-community/bluetooth-le';

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
  // neverForLocation: scan without forcing location permission on Android 12+.
  await BleClient.initialize({ androidNeverForLocation: true });
  try {
    await BleClient.requestEnable();
  } catch {
    /* user declined; connect may still work if BT already on */
  }
  nativeInitialized = true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normalize UUID comparison (short or 128-bit, any case). */
export function uuidMatch(a: string, b: string): boolean {
  const norm = (u: string) => u.toLowerCase().replace(/-/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  // 16-bit forms: 180d vs 0000180d00001000800000805f9b34fb
  if (na.length === 4 && nb.includes(na)) return true;
  if (nb.length === 4 && na.includes(nb)) return true;
  return false;
}

/**
 * Ensure value from the plugin is a real DataView (native often sends hex string).
 */
export function asDataView(value: unknown): DataView {
  if (value instanceof DataView) return value;
  if (value instanceof ArrayBuffer) return new DataView(value);
  if (ArrayBuffer.isView(value)) {
    const v = value as ArrayBufferView;
    return new DataView(v.buffer, v.byteOffset, v.byteLength);
  }
  if (typeof value === 'string') {
    // hex string e.g. "00 01 02" or "000102"
    const bin: number[] = [];
    let empty = 1;
    let buffer = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if ((c > 47 && c < 58) || (c > 64 && c < 71) || (c > 96 && c < 103)) {
        buffer = (buffer << 4) ^ ((c > 64 ? c + 9 : c) & 15);
        if ((empty ^= 1) === 0) bin.push(buffer & 0xff);
      }
    }
    return new DataView(Uint8Array.from(bin).buffer);
  }
  if (Array.isArray(value)) {
    return new DataView(Uint8Array.from(value as number[]).buffer);
  }
  return new DataView(new ArrayBuffer(0));
}

function resolveServiceAndChar(
  services: BleService[],
  serviceUuid: string,
  characteristicUuid: string,
): { service: string; characteristic: string } | null {
  for (const s of services) {
    if (!uuidMatch(s.uuid, serviceUuid)) continue;
    for (const c of s.characteristics ?? []) {
      if (uuidMatch(c.uuid, characteristicUuid)) {
        return { service: s.uuid, characteristic: c.uuid };
      }
    }
  }
  // Fallback: use requested UUIDs (plugin will parse them).
  return { service: serviceUuid, characteristic: characteristicUuid };
}

/**
 * Request a device that advertises `serviceUuid` and subscribe to notifications
 * on that service's characteristic.
 *
 * Android: discover services before enabling notifications — many pods
 * (including Zwift RunPod) otherwise stay "connected" with zero packets.
 */
export async function connectNativeNotify(options: {
  serviceUuid: string;
  characteristicUuid: string;
  /** Extra optional services so broader device pickers still allow GATT access. */
  optionalServices?: string[];
  nameHint?: string;
  /** Optional name substrings for a second-chance device picker. */
  nameHints?: string[];
  onValue(data: DataView): void;
  onDisconnected(): void;
}): Promise<{ deviceId: string; deviceName: string; disconnect(): Promise<void> }> {
  await ensureNativeBle();

  const serviceUuid = options.serviceUuid.includes('-')
    ? options.serviceUuid
    : numberToUUID(parseInt(options.serviceUuid, 16));
  const charUuid = options.characteristicUuid.includes('-')
    ? options.characteristicUuid
    : numberToUUID(parseInt(options.characteristicUuid, 16));

  const optional = [
    serviceUuid,
    ...(options.optionalServices ?? []).map((u) =>
      u.includes('-') ? u : numberToUUID(parseInt(u, 16)),
    ),
  ];

  let device;
  try {
    device = await BleClient.requestDevice({
      services: [serviceUuid],
      optionalServices: optional,
    });
  } catch (first) {
    // Broader chooser: pods sometimes advertise incompletely.
    try {
      device = await BleClient.requestDevice({
        optionalServices: optional,
        ...(options.nameHints?.length
          ? { namePrefix: undefined } // show all; user picks Zwift/RunPod
          : {}),
      });
    } catch {
      throw first;
    }
  }

  const deviceId = device.deviceId;
  const deviceName = device.name?.trim() || options.nameHint || 'Bluetooth device';

  await BleClient.connect(deviceId, () => {
    options.onDisconnected();
  }, { timeout: 30_000 });

  // Critical on Android: populate the GATT cache before CCCD writes.
  try {
    await BleClient.discoverServices(deviceId);
  } catch {
    /* some stacks auto-discover on connect */
  }
  await sleep(250);

  let services: BleService[] = [];
  try {
    services = await BleClient.getServices(deviceId);
  } catch {
    services = [];
  }

  const resolved = resolveServiceAndChar(services, serviceUuid, charUuid);
  if (!resolved) {
    await BleClient.disconnect(deviceId).catch(() => {});
    throw new Error(
      'Connected, but the expected BLE service was not found on this device. Try waking the pod (move it) and reconnect.',
    );
  }

  try {
    // 1 = high priority on Android (plugin enum ConnectionPriority)
    await BleClient.requestConnectionPriority(deviceId, 1 as never);
  } catch {
    /* optional */
  }

  await BleClient.startNotifications(
    deviceId,
    resolved.service,
    resolved.characteristic,
    (value) => {
      options.onValue(asDataView(value));
    },
  );

  // Some sensors only push after the first read attempt / subscription settles.
  try {
    const once = await BleClient.read(deviceId, resolved.service, resolved.characteristic);
    const dv = asDataView(once);
    if (dv.byteLength > 0) options.onValue(dv);
  } catch {
    /* measurement may be notify-only */
  }

  return {
    deviceId,
    deviceName,
    disconnect: async () => {
      try {
        await BleClient.stopNotifications(deviceId, resolved.service, resolved.characteristic);
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

export type { ScanResult };

export function toDataView(bytes: number[]): DataView {
  return numbersToDataView(bytes);
}
