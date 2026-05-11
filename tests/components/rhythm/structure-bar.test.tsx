import { cleanup, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";
import { StructureBar } from "@/components/rhythm/StructureBar";

afterEach(() => {
  cleanup();
});

describe("StructureBar", () => {
  it("renders a loop block when no structure is provided", () => {
    render(() => <StructureBar structure={null} currentMeasure={0} />);

    expect(screen.getByText("Loop").textContent).toBe("Loop");
    expect(screen.getByText("8 bars").textContent).toBe("8 bars");
  });

  it("defaults missing part lengths to eight bars", () => {
    render(() => <StructureBar structure="AB8C" currentMeasure={0} />);

    expect(screen.getByLabelText("A section, 8 bars")).toBeTruthy();
    expect(screen.getByLabelText("B section, 8 bars")).toBeTruthy();
    expect(screen.getByLabelText("C section, 8 bars")).toBeTruthy();
  });

  it("highlights the active part based on the current measure", () => {
    const [currentMeasure, setCurrentMeasure] = createSignal(1);
    render(() => (
      <StructureBar structure="A4B8C6" currentMeasure={currentMeasure()} />
    ));

    expect(
      screen.getByLabelText("A section, 4 bars").getAttribute("aria-current")
    ).toBe("step");

    setCurrentMeasure(5);

    expect(
      screen.getByLabelText("B section, 8 bars").getAttribute("aria-current")
    ).toBe("step");

    setCurrentMeasure(13);

    expect(
      screen.getByLabelText("C section, 6 bars").getAttribute("aria-current")
    ).toBe("step");
  });

  it("wraps back to the first part after the full structure length", () => {
    render(() => <StructureBar structure="A4B8C6" currentMeasure={19} />);

    expect(
      screen.getByLabelText("A section, 4 bars").getAttribute("aria-current")
    ).toBe("step");
  });
});
