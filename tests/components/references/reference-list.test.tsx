import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { ReferenceList } from "../../../src/components/references/ReferenceList";

describe("ReferenceList", () => {
  it("shows shared visibility badges and hides actions for read-only references", () => {
    render(() => (
      <ReferenceList
        references={[
          {
            id: "ref-1",
            url: "https://example.com/shared",
            refType: "video",
            tuneRef: "tune-1",
            userRef: "other-user",
            comment: null,
            title: "Shared Clip",
            public: 1,
            favorite: 0,
            deleted: 0,
            syncVersion: 1,
            lastModifiedAt: "2026-04-28T00:00:00.000Z",
            deviceId: "test",
            displayOrder: 0,
          },
        ]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
        canEditReference={() => false}
        canReorder={false}
      />
    ));

    expect(
      screen.getByTestId("reference-visibility-badge-ref-1").textContent
    ).toBe("Public");
    expect(screen.queryByTestId("reference-edit-button-ref-1")).toBeNull();
    expect(screen.queryByTestId("reference-delete-button-ref-1")).toBeNull();
    expect(screen.queryByTestId("reference-drag-handle-ref-1")).toBeNull();
  });
});
