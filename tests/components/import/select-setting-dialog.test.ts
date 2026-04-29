import { describe, expect, it } from "vitest";
import { buildSettingPreviewAbc } from "../../../src/components/import/SelectSettingDialog";

describe("buildSettingPreviewAbc", () => {
  it("returns only the first two measures as an ABC preview", () => {
    const abc = [
      "X:1",
      "T:Preview Test",
      "M:4/4",
      "L:1/8",
      "K:D",
      "ABcd efga|bagf e2 d2|dcBA d2 A2|",
    ].join("\n");

    expect(buildSettingPreviewAbc(abc)).toBe("ABcd efga|bagf e2 d2|");
  });

  it("returns null when there is no ABC notation to preview", () => {
    expect(buildSettingPreviewAbc("")).toBeNull();
  });
});
