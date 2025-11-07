/**
 * AlertDialog Component Tests
 */
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "../src/components/ui/alert-dialog";

describe("AlertDialog", () => {
  it("renders title and description when open", () => {
    render(() => (
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Test Title</AlertDialogTitle>
            <AlertDialogDescription>Test Description</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    ));
    
    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByText("Test Description")).toBeDefined();
  });
});
