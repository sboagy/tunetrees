const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
]);

const EXTENSIONS = /\.(mp3|wav|m4a)$/i;

export function validateByosAudioFile(file: File): string | null {
  if (!MIME_TYPES.has(file.type) && !EXTENSIONS.test(file.name)) {
    return "Choose an MP3, WAV, or M4A audio file.";
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return "Audio files must be 50 MB or smaller.";
  }
  return null;
}
