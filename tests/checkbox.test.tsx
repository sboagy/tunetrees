/**
 * Checkbox Component Tests
 */
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import {
  Checkbox,
  CheckboxControl,
  CheckboxIndicator,
  CheckboxLabel,
} from "../src/components/ui/checkbox";

describe("Checkbox", () => {
  it("renders with label", () => {
    render(() => (
      <Checkbox>
        <CheckboxControl>
          <CheckboxIndicator />
        </CheckboxControl>
        <CheckboxLabel>Accept terms</CheckboxLabel>
      </Checkbox>
    ));
    expect(screen.getByText("Accept terms")).toBeDefined();
  });
});
