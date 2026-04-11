import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { ScheduledOverridePicker } from "../../../src/components/grids/ScheduledOverridePicker";

afterEach(() => {
  cleanup();
});

describe("ScheduledOverridePicker icon affordance", () => {
  it("adds an underline to the calendar icon when an override is active", () => {
    render(() => (
      <ScheduledOverridePicker
        tuneId="tune-with-override"
        value="2026-04-25T12:00:00.000Z"
        onChange={() => undefined}
      />
    ));

    const icon = screen.getByTestId(
      "scheduled-override-icon-tune-with-override"
    );
    expect(icon.className).toContain("border-b-2");
    expect(icon.className).toContain("border-current");
  });

  it("keeps the calendar icon underline transparent when no override is active", () => {
    render(() => (
      <ScheduledOverridePicker
        tuneId="tune-without-override"
        value=""
        onChange={() => undefined}
      />
    ));

    const icon = screen.getByTestId(
      "scheduled-override-icon-tune-without-override"
    );
    expect(icon.className).toContain("border-b-2");
    expect(icon.className).toContain("border-transparent");
  });
});
