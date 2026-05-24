import type { SampleKitSyntheticEntry } from "@/lib/services/rhythm-service/kits";

export function buildSampleUrl(
  baseUrl: string,
  sampleKit: string,
  fileName: string
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const assetPath = `audio/kits/${sampleKit}/${fileName}`;
  return normalizedBase ? `${normalizedBase}/${assetPath}` : `/${assetPath}`;
}

export function msToSeconds(value: number): number {
  return value / 1000;
}

export function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function getAudioContextConstructor():
  | (new () => AudioContext)
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: new () => AudioContext })
      .webkitAudioContext
  );
}

export function getAudioElementConstructor():
  | (new (
      src?: string
    ) => HTMLAudioElement)
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.Audio;
}

export function clampPremiumLoopPlaybackRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.min(2, Math.max(0.5, value));
}

export async function decodeSample(
  audioContext: AudioContext,
  fetchImpl: typeof fetch,
  url: string
): Promise<AudioBuffer> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch rhythm sample: ${url}`);
  }

  const buffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(buffer);
}

export function createSyntheticClickBuffer(
  audioContext: AudioContext,
  entry: SampleKitSyntheticEntry
): AudioBuffer {
  const frameCount = Math.max(
    1,
    Math.round((audioContext.sampleRate * entry.durationMs) / 1000)
  );
  const buffer = audioContext.createBuffer(
    1,
    frameCount,
    audioContext.sampleRate
  );
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / audioContext.sampleRate;
    const envelope = Math.exp((-8 * index) / frameCount);
    channelData[index] =
      Math.sin(2 * Math.PI * entry.frequency * time) * envelope;
  }

  return buffer;
}
