import type { Locator, Page, Response } from "@playwright/test";
import { expect } from "@playwright/test";
import { TuneTreesPageObject } from "./tunetrees.po";

// await ttPO.ffTitle.fill("Boyne Hunt x");
type FormFieldUpdate = {
  label: string;
  locator: Locator;
  modification: string;
  select_modification?: string;
  original: string;
  cellId?: string;
};

export class TuneEditorPageObject extends TuneTreesPageObject {
  readonly sidebarButton: Locator;
  readonly ffGenre: Locator;
  readonly form: Locator;
  readonly IdTitle: Locator;
  readonly ffTitle: Locator;
  readonly ffType: Locator;
  readonly ffStructure: Locator;
  readonly ffMode: Locator;
  readonly ffIncipit: Locator;
  readonly ffLearned: Locator;
  readonly ffPracticed: Locator;
  readonly ffQuality: Locator;
  readonly ffEasiness: Locator;
  readonly ffInterval: Locator;
  readonly ffRepetitions: Locator;
  readonly ffReviewDate: Locator;
  readonly ffTags: Locator;

  readonly allFormFields: Locator[];

  readonly iffGenre!: number;
  readonly iffTitle!: number;
  readonly iffType!: number;
  readonly iffStructure!: number;
  readonly iffMode!: number;
  readonly iffIncipit!: number;
  readonly iffLearned!: number;
  readonly iffPracticed!: number;
  readonly iffQuality!: number;
  readonly iffEasiness!: number;
  readonly iffInterval!: number;
  readonly iffRepetitions!: number;
  readonly iffReviewDate!: number;
  readonly iffTags!: number;

  readonly sampleBoyneHunt: FormFieldUpdate[];
  readonly sampleSiBheagSiMhorShort: FormFieldUpdate[];

  constructor(page: Page) {
    super(page);

    this.sidebarButton = page.getByTestId("tt-sidebar-edit-tune");
    this.form = this.page.getByTestId("tt-tune-editor-form");
    this.IdTitle = this.page.getByRole("heading", { name: "Tune #" });

    this.ffTitle = this.form.getByTestId("tt-tune-editor-title");
    this.ffType = this.page.getByTestId("tt-tune-editor-type");
    this.ffStructure = this.page.getByTestId("tt-tune-editor-structure");
    this.ffMode = this.form.getByTestId("tt-tune-editor-mode");
    this.ffIncipit = this.form.getByTestId("tt-tune-editor-incipit");
    this.ffGenre = this.form.getByTestId("tt-tune-editor-genre");
    this.ffLearned = this.form.getByTestId("tt-tune-editor-learned");
    this.ffPracticed = this.form.getByTestId("tt-tune-editor-practiced");
    this.ffQuality = this.form.getByTestId("tt-tune-editor-quality");
    this.ffEasiness = this.form.getByTestId("tt-tune-editor-easiness");
    this.ffInterval = this.form.getByTestId("tt-tune-editor-interval");
    this.ffRepetitions = this.form.getByTestId("tt-tune-editor-repetitions");
    this.ffReviewDate = this.form.getByTestId("tt-tune-editor-due");
    this.ffTags = this.form.getByTestId("tt-tune-editor-tags");

    this.allFormFields = [
      this.ffTitle,
      this.ffType,
      this.ffStructure,
      this.ffMode,
      this.ffIncipit,
      this.ffGenre,
      this.ffLearned,
      this.ffPracticed,
      this.ffQuality,
      this.ffEasiness,
      this.ffInterval,
      this.ffRepetitions,
      this.ffReviewDate,
      // this.ffTags,
    ];

    const tuneEditorFieldsBase: { [key: string]: FormFieldUpdate } = {
      genre: {
        label: "Genre",
        locator: this.ffGenre.locator("select"),
        modification: "",
        original: "",
      },
      title: {
        label: "Title",
        locator: this.ffTitle.locator("input"),
        modification: "",
        original: "",
        cellId: "200_title",
      },
      type: {
        label: "Type",
        locator: this.ffType.locator("select"),
        modification: "",
        original: "",
        cellId: "200_type",
      },
      structure: {
        label: "Structure",
        locator: this.ffStructure.locator("input"),
        modification: "",
        original: "",
        cellId: "200_structure",
      },
      mode: {
        label: "Mode",
        locator: this.ffMode.locator("input"),
        modification: "",
        original: "",
      },
      incipit: {
        label: "Incipit",
        locator: this.ffIncipit.locator("input"),
        modification: "",
        original: "",
      },
      learned: {
        label: "Learned Date",
        locator: this.ffLearned.locator("input"),
        modification: "",
        original: "",
      },
      practiced: {
        label: "Practiced Date",
        locator: this.ffPracticed.locator("input"),
        modification: "",
        original: "",
        // TODO: Have to factor out date formatting and maybe (?) time zone issues
        // cellId: "200_practiced",
      },
      quality: {
        label: "Quality",
        locator: this.ffQuality.locator("input"),
        modification: "",
        original: "",
      },
      easiness: {
        label: "Easiness",
        locator: this.ffEasiness.locator("input"),
        modification: "",
        original: "",
      },
      interval: {
        label: "Interval",
        locator: this.ffInterval.locator("input"),
        modification: "",
        original: "",
      },
      repetitions: {
        label: "Repetitions",
        locator: this.ffRepetitions.locator("input"),
        modification: "",
        original: "",
      },
      scheduled: {
        label: "Scheduled",
        locator: this.ffReviewDate.locator("input"),
        modification: "",
        original: "",
        // TODO: Have to factor out date formatting and maybe (?) time zone issues
        // cellId: "200_due",
      },
    };

    const fieldKeys = Object.keys(tuneEditorFieldsBase);
    for (const [index, key] of fieldKeys.entries()) {
      (this as unknown as Record<string, number>)[
        `iff${key.charAt(0).toUpperCase() + key.slice(1)}`
      ] = index;
    }

    this.sampleBoyneHunt = [
      {
        ...tuneEditorFieldsBase.genre,
        modification: "FADO",
        original: "ITRAD",
      },
      {
        ...tuneEditorFieldsBase.title,
        modification: "Boyne Hunt x",
        original: "Boyne Hunt",
      },
      {
        ...tuneEditorFieldsBase.type,
        modification: "FadoCorrido",
        select_modification: "Fado (Corrido)",
        original: "Reel",
      },
      {
        ...tuneEditorFieldsBase.structure,
        modification: "AABB",
        original: "AB",
      },
      {
        ...tuneEditorFieldsBase.mode,
        modification: "G Major",
        original: "D Major",
      },
      {
        ...tuneEditorFieldsBase.incipit,
        modification: "|ABC DEF|",
        original: "|A2FA DAFA|DAFA BEeB|",
      },

      {
        ...tuneEditorFieldsBase.learned,
        modification: "2010-11-24",
        original: "2010-11-20",
      },
      // {
      //   ...tuneEditorFieldsBase.practiced,
      //   modification: "2023-06-06T18:25:16",
      //   original: "2023-06-06T18:25:16",
      //   // TODO: Have to factor out date formatting and maybe (?) time zone issues
      //   // cellId: "200_practiced",
      // },
      {
        ...tuneEditorFieldsBase.quality,
        modification: "2",
        original: "1",
      },
      {
        ...tuneEditorFieldsBase.easiness,
        modification: "1.99",
        original: "1.96",
      },
      {
        ...tuneEditorFieldsBase.interval,
        modification: "2",
        original: "1",
      },
      {
        ...tuneEditorFieldsBase.repetitions,
        modification: "3",
        original: "0",
      },
      // {
      //   ...tuneEditorFieldsBase.scheduled,
      //   modification: "2023-06-07T18:25:16",
      //   original: "2023-06-07T18:25:16",
      //   // TODO: Have to factor out date formatting and maybe (?) time zone issues
      //   // cellId: "200_due",
      // },
    ];

    // For new tune creation
    this.sampleSiBheagSiMhorShort = [
      {
        ...tuneEditorFieldsBase.genre,
        modification: "ITRAD",
      },
      {
        ...tuneEditorFieldsBase.title,
        modification: "Sí Bheag, Sí Mhór",
      },
      {
        ...tuneEditorFieldsBase.type,
        modification: "waltz",
        select_modification: "Waltz (3/4)",
      },
      {
        ...tuneEditorFieldsBase.structure,
        modification: "AABB",
      },
      {
        ...tuneEditorFieldsBase.mode,
        modification: "D Major",
      },
      {
        ...tuneEditorFieldsBase.incipit,
        modification: "de|:f3e d2|d2 de d2|B4 A2|F4 A2|",
      },
    ];
  }

  async doFormFieldValueMod(formField: FormFieldUpdate): Promise<void> {
    const tagName = await formField.locator.evaluate((node) =>
      node.tagName.toLowerCase(),
    );
    if (tagName === "input") {
      // Fill with resilience against React re-renders wiping the field
      const fillAndVerify = async () => {
        await expect(formField.locator).toBeAttached();
        await expect(formField.locator).toBeVisible();
        await expect(formField.locator).toBeEditable();
        await formField.locator.fill(formField.modification);
        // Brief pause to allow any onChange handlers to run
        await this.page.waitForTimeout(50);
        await formField.locator.press("Tab");
        await this.page.waitForTimeout(10);
        // Verify the value stuck; if not, retry below
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
          try {
            const v = await formField.locator.inputValue();
            if (v === formField.modification) return true;
          } catch {
            // ignore transient detach during render
          }
          await this.page.waitForTimeout(100);
        }
        return false;
      };

      let ok = await fillAndVerify();
      if (!ok) {
        // One targeted retry after a short delay
        await this.page.waitForTimeout(200);
        ok = await fillAndVerify();
      }
      if (!ok) {
        // As a last resort, assert current value equals desired to surface clear error in tests
        await expect(formField.locator).toHaveValue(formField.modification, {
          timeout: 1000,
        });
      }
    } else if (tagName === "select") {
      const selectedOption =
        formField.select_modification !== undefined
          ? formField.select_modification
          : formField.modification;
      await formField.locator.selectOption(selectedOption);
    } else {
      throw new Error(`Unsupported form field type: ${tagName}`);
    }
  }

  findUpdateByLabel(
    label: string,
    updates: FormFieldUpdate[],
  ): FormFieldUpdate | undefined {
    return updates.find((update) => update.label === label);
  }

  async openTuneEditorForCurrentTune(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
    const waitForSidebar = async () => {
      await this.sidebarButton.waitFor({
        state: "attached",
        timeout: 60_000,
      });
      await this.sidebarButton.waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await this.sidebarButton.isEnabled();
    };
    try {
      await waitForSidebar();
    } catch (error) {
      // Recover from a transient full page reload/closure in Next.js dev
      if (this.page.isClosed()) {
        throw error; // cannot recover without a page
      }
      try {
        await this.page.reload({ waitUntil: "domcontentloaded" });
      } catch {
        // ignore
      }
      // Ensure main UI is available again
      try {
        await this.navigateToRepertoireTabDirectly(0);
      } catch {
        // best-effort, continue
      }
      await waitForSidebar();
    }

    // Click and wait for the editor form to appear with a self-healing retry
    const tryOpen = async (): Promise<boolean> => {
      try {
        await this.sidebarButton.click();
        await this.form.waitFor({ state: "visible", timeout: 12_000 });
        return true;
      } catch {
        return false;
      }
    };

    let opened = await tryOpen();
    if (!opened) {
      console.warn(
        "[TuneEditor] Edit form failed to appear. Reloading and retrying once...",
      );
      try {
        await this.page.reload({ waitUntil: "domcontentloaded" });
      } catch {
        // ignore reload errors
      }
      await this.sidebarButton.waitFor({ state: "visible", timeout: 15_000 });
      await this.sidebarButton.isEnabled();
      opened = await tryOpen();
    }
    if (!opened) {
      throw new Error("Tune editor form did not appear after retry");
    }

    await this.IdTitle.waitFor({ state: "visible", timeout: 15_000 });

    console.log("===> tune-editor.po.ts:32 ~ ");
  }

  /**
   * Opens the tune editor by double-clicking the current tune row in the grid.
   * This method assumes a tune is already selected (highlighted) in the grid.
   */
  async openTuneEditorByDoubleClick(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");

    // Find the currently selected row (has outline-blue-500 class)
    const selectedRow = this.page
      .locator("tr.outline.outline-blue-500")
      .first();

    // Wait for the row to be available and visible
    await selectedRow.waitFor({ state: "attached", timeout: 15_000 });
    await selectedRow.waitFor({ state: "visible", timeout: 15_000 });

    // Double-click the row and wait for the editor form to appear
    const tryOpen = async (): Promise<boolean> => {
      try {
        await selectedRow.dblclick();
        await this.form.waitFor({ state: "visible", timeout: 12_000 });
        return true;
      } catch {
        return false;
      }
    };

    let opened = await tryOpen();
    if (!opened) {
      console.warn(
        "[TuneEditor] Edit form failed to appear after double-click. Retrying once...",
      );
      await this.page.waitForTimeout(500);
      opened = await tryOpen();
    }
    if (!opened) {
      throw new Error("Tune editor form did not appear after double-click");
    }

    await this.IdTitle.waitFor({ state: "visible", timeout: 15_000 });
    console.log("===> tune-editor.po.ts: Opened editor via double-click");
  }

  async navigateToFormFieldById(formFieldTestId: string): Promise<Locator> {
    console.log("===> tune-editor.po.ts:17 ~ ");

    // const titleFormFieldLocator = page.getByTestId("tt-tune-editor-title");
    // const titleFormFieldLocator = page.getByLabel("Title:");
    let formFieldLocator = this.form.getByTestId(formFieldTestId);

    await formFieldLocator.waitFor({ state: "attached" });
    await formFieldLocator.waitFor({ state: "visible" });

    let formFieldTextBox: Locator = formFieldLocator.getByRole("textbox");

    await formFieldTextBox.waitFor({ state: "attached" });
    await formFieldTextBox.waitFor({ state: "visible" });

    // Try a short, bounded wait for server-action hydration to populate the input value.
    // This improves stability when the first fetch briefly fails and retries.
    const tryHydration = async (deadlineMs: number): Promise<string> => {
      let value = "";
      const deadline = Date.now() + deadlineMs;
      while (Date.now() < deadline) {
        // Bail out cleanly if the page is closing/closed to avoid post-test timeouts
        const state = this.page.context()?.browser()?.isConnected?.() ?? true;
        if (!state) break;
        if (this.page.isClosed()) break;
        try {
          value = await formFieldTextBox.inputValue();
          if (value !== "") break;
        } catch {
          // ignore transient detach/errors during render
        }
        try {
          await this.page.waitForTimeout(200);
        } catch {
          break; // test likely ended
        }
      }
      return value;
    };

    let observedValue = await tryHydration(8_000);

    // Final recovery: if still empty, reload page, reselect current tune, reopen editor, and retry once more
    if (observedValue === "") {
      console.warn(
        "[TuneEditor] Field still empty after reopen. Performing full recovery: reload page, reselect tune, reopen editor...",
      );
      // Capture the current tune title to reselect after reload
      const currentTitle = await this.currentTuneTitle
        .textContent()
        .then((t) => t?.trim())
        .catch(() => null);
      // Close editor if visible
      try {
        const cancelBtn = this.page.getByRole("button", { name: "Cancel" });
        await expect(cancelBtn).toBeVisible();
        if (await cancelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await this.clickWithTimeAfter(cancelBtn);
          await this.form
            .waitFor({ state: "hidden", timeout: 5_000 })
            .catch(() => undefined);
        }
      } catch {
        // ignore
      }
      try {
        await this.page.reload({ waitUntil: "domcontentloaded" });
      } catch {
        // ignore
      }
      // Navigate back to Repertoire and reselect the tune if we know it
      await this.navigateToRepertoireTabDirectly(0);
      if (currentTitle) {
        try {
          await this.filterInput.fill("");
          await this.filterInput.fill(currentTitle);
          await this.waitForTablePopulationToStart();
          // Click the first matching row/cell
          const row = this.page
            .getByRole("row", { name: currentTitle })
            .first();
          if (await row.isVisible().catch(() => false)) {
            await this.clickWithTimeAfter(row);
          }
          await expect(this.currentTuneTitle).toContainText(currentTitle, {
            timeout: 10_000,
          });
        } catch {
          // best-effort
        }
      }
      // Reopen editor and retry hydration
      await this.openTuneEditorForCurrentTune();
      const finalFormField = this.form.getByTestId(formFieldTestId);
      await finalFormField.waitFor({ state: "attached" });
      await finalFormField.waitFor({ state: "visible" });
      const finalTextBox: Locator = finalFormField.getByRole("textbox");
      await finalTextBox.waitFor({ state: "attached" });
      await finalTextBox.waitFor({ state: "visible" });
      formFieldLocator = finalFormField;
      formFieldTextBox = finalTextBox;
      observedValue = await tryHydration(8_000);
    }
    console.log(
      "===> test-edit-1.spec.ts:57 ~ formFieldText3 (post-hydration)",
      observedValue,
    );

    await formFieldTextBox.isEditable();
    await formFieldTextBox.click();

    return formFieldTextBox;
  }

  async navigateToFormInput(formFieldLocator: Locator): Promise<Locator> {
    console.log("===> tune-editor.po.ts:59 ~ ");

    await formFieldLocator.waitFor({ state: "attached" });
    await formFieldLocator.waitFor({ state: "visible" });

    const formFieldTextBox: Locator = formFieldLocator.getByRole("textbox");
    await formFieldTextBox.waitFor({ state: "attached" });
    await formFieldTextBox.waitFor({ state: "visible" });

    const formFieldText4 = await formFieldTextBox.inputValue();
    console.log("===> test-edit-1.spec.ts:57 ~ formFieldText3", formFieldText4);

    await formFieldTextBox.isEditable();
    await formFieldTextBox.click();

    return formFieldTextBox;
  }

  // async fillField(formFieldLocator: Locator, fillText: string) {
  //   const formFieldTextBox = await this.navigateToFormField(formFieldTestId);
  //   await formFieldTextBox.fill(fillText);
  //   return formFieldTextBox;
  // }

  async pressButton(buttonName: string): Promise<Response> {
    // Be protocol/baseURL agnostic; the editor posts to /home on save/cancel
    const responsePromise: Promise<Response> = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/home" &&
        response.status() === 200 &&
        response.request().method() === "POST",
    );
    await this.clickWithTimeAfter(
      this.page.getByRole("button", { name: buttonName }),
    );
    return responsePromise;
  }

  async pressSave(): Promise<Response> {
    const response = await this.pressButton("Save");
    await this.page.waitForTimeout(500);
    try {
      // Wait for the editor form to be fully removed from the DOM after save
      await this.form.waitFor({ state: "detached", timeout: 15_000 });
    } catch {
      // Best-effort: if it didn't detach, log and continue so tests can surface a clear failure later
      console.warn("[TuneEditor] form did not detach after save (continuing)");
    }
    return response;
  }

  async pressCancel(): Promise<Response> {
    const cancelButton = this.page.getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeAttached();
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toBeEnabled();
    const response = await this.pressButton("Cancel");
    try {
      // Wait for the editor form to be fully removed from the DOM after save
      await this.form.waitFor({ state: "detached", timeout: 15_000 });
    } catch {
      // Best-effort: if it didn't detach, log and continue so tests can surface a clear failure later
      console.warn("[TuneEditor] form did not detach after save (continuing)");
    }
    await this.page.waitForTimeout(500);
    return response;
  }
}
