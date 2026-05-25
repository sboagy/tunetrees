const DEVICE_ID_STORAGE_KEY = "tunetrees_device_id";

export function getBrowserDeviceId(): string {
  if (typeof window === "undefined") {
    return "local";
  }

  try {
    const storage = globalThis.localStorage;
    let deviceId = storage.getItem(DEVICE_ID_STORAGE_KEY);

    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      storage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }

    return deviceId;
  } catch {
    return "local";
  }
}
