import { describe, expect, it } from "vitest";
import { validateByosAudioFile } from "@/lib/byos/audio-validation";

describe("BYOS audio input boundaries", () => {
  it.each([
    ["recording.mp3", "audio/mpeg"],
    ["recording.wav", "audio/wav"],
    ["recording.m4a", "audio/mp4"],
    ["recording.m4a", "audio/x-m4a"],
    ["RECORDING.MP3", ""],
    ["recording.wav", "application/octet-stream"],
  ])("accepts %s (%s)", (name, type) => {
    expect(
      validateByosAudioFile(new File(["audio"], name, { type }))
    ).toBeNull();
  });

  it("rejects unsupported audio formats", () => {
    expect(
      validateByosAudioFile(
        new File(["audio"], "recording.ogg", { type: "audio/ogg" })
      )
    ).toBe("Choose an MP3, WAV, or M4A audio file.");
  });

  it.each([
    50 * 1024 * 1024 - 1,
    50 * 1024 * 1024,
  ])("accepts %i bytes", (size) => {
    const file = new File([], "recording.mp3", { type: "audio/mpeg" });
    // Size metadata is sufficient here; avoid allocating 50 MB per boundary case.
    Object.defineProperty(file, "size", { value: size });
    expect(validateByosAudioFile(file)).toBeNull();
  });

  it("rejects one byte over 50 MB", () => {
    const file = new File([], "recording.mp3", { type: "audio/mpeg" });
    Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
    expect(validateByosAudioFile(file)).toBe(
      "Audio files must be 50 MB or smaller."
    );
  });
});
