import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { GridStatusMessage } from "../src/components/grids/GridStatusMessage";

describe("GridStatusMessage", () => {
  it("renders error details and recovery hints", () => {
    render(() => (
      <GridStatusMessage
        variant="error"
        title="Unable to load"
        description="There was a problem loading tunes."
        hint="Refresh the page to try again."
        error={new Error("Network timeout")}
      />
    ));

    expect(screen.getByText("Unable to load")).toBeDefined();
    expect(screen.getByText("There was a problem loading tunes.")).toBeDefined();
    expect(screen.getByText("Refresh the page to try again.")).toBeDefined();
    expect(screen.getByText("Error details: Network timeout")).toBeDefined();
  });

  it("renders loading messaging", () => {
    render(() => (
      <GridStatusMessage
        variant="loading"
        title="Loading tunes..."
        description="Syncing your tunes."
      />
    ));

    expect(screen.getByText("Loading tunes...")).toBeDefined();
    expect(screen.getByText("Syncing your tunes.")).toBeDefined();
  });
});
