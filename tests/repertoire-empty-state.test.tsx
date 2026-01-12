import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { RepertoireEmptyState } from "../src/components/repertoire/EmptyState";

describe("RepertoireEmptyState", () => {
  it("renders provided title and description", () => {
    render(() => (
      <RepertoireEmptyState
        title="No repertoire selected"
        description="Create one to organize tunes."
      />
    ));

    expect(screen.getByText("No repertoire selected")).toBeDefined();
    expect(screen.getByText("Create one to organize tunes.")).toBeDefined();
  });

  it("invokes actions when buttons are clicked", () => {
    const primary = vi.fn();
    const secondary = vi.fn();

    render(() => (
      <RepertoireEmptyState
        title="Empty repertoire"
        description="Add tunes to get started."
        primaryAction={{ label: "Create repertoire", onClick: primary }}
        secondaryAction={{ label: "Open catalog", onClick: secondary }}
      />
    ));

    fireEvent.click(screen.getByText("Create repertoire"));
    fireEvent.click(screen.getByText("Open catalog"));

    expect(primary).toHaveBeenCalled();
    expect(secondary).toHaveBeenCalled();
  });
});
