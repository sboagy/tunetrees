/**
 * Tests for reference helper functions
 * Validates URL detection and reference type categorization
 */

import { describe, expect, it } from "vitest";
import { detectReferenceType } from "@/lib/db/queries/references";

describe("detectReferenceType", () => {
  it("should detect video platforms", () => {
    expect(detectReferenceType("https://youtube.com/watch?v=123")).toBe(
      "video"
    );
    expect(detectReferenceType("https://youtu.be/abc123")).toBe("video");
    expect(detectReferenceType("https://vimeo.com/123456")).toBe("video");
  });

  it("should detect sheet music platforms", () => {
    expect(detectReferenceType("https://thesession.org/tunes/123")).toBe(
      "sheet-music"
    );
    expect(detectReferenceType("https://example.com/tune.pdf")).toBe(
      "sheet-music"
    );
    expect(detectReferenceType("https://musescore.com/score/123")).toBe(
      "sheet-music"
    );
  });

  it("should detect audio platforms", () => {
    expect(detectReferenceType("https://soundcloud.com/artist/track")).toBe(
      "audio"
    );
    expect(detectReferenceType("https://spotify.com/track/123")).toBe("audio");
    expect(detectReferenceType("https://bandcamp.com/album/xyz")).toBe(
      "audio"
    );
    expect(detectReferenceType("https://example.com/song.mp3")).toBe("audio");
    expect(detectReferenceType("https://example.com/song.wav")).toBe("audio");
  });

  it("should detect social media platforms", () => {
    expect(detectReferenceType("https://facebook.com/page/123")).toBe(
      "social"
    );
    expect(detectReferenceType("https://instagram.com/user/post/123")).toBe(
      "social"
    );
    expect(detectReferenceType("https://twitter.com/user/status/123")).toBe(
      "social"
    );
    expect(detectReferenceType("https://x.com/user/status/123")).toBe(
      "social"
    );
  });

  it("should default to website for unknown URLs", () => {
    expect(
      detectReferenceType("https://irishbanjolessons.com/courses/jigs")
    ).toBe("website");
    expect(detectReferenceType("https://example.com")).toBe("website");
    expect(detectReferenceType("https://unknown-domain.com/page")).toBe(
      "website"
    );
  });

  it("should handle case-insensitive matching", () => {
    expect(detectReferenceType("https://YOUTUBE.COM/watch?v=123")).toBe(
      "video"
    );
    expect(detectReferenceType("https://SoundCloud.com/artist/track")).toBe(
      "audio"
    );
  });

  it("should only return valid constraint values", () => {
    // Valid values according to check_ref_type constraint
    const validTypes = [
      "website",
      "audio",
      "video",
      "sheet-music",
      "article",
      "social",
      "other",
    ];

    const testUrls = [
      "https://youtube.com/watch",
      "https://soundcloud.com/track",
      "https://thesession.org/tunes",
      "https://facebook.com/page",
      "https://example.com",
      "https://spotify.com/track",
      "https://example.com/file.pdf",
    ];

    for (const url of testUrls) {
      const detected = detectReferenceType(url);
      expect(validTypes).toContain(detected);
    }
  });
});
