import type { Locator, Page, Response } from "@playwright/test";
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
    this.ffReviewDate = this.form.getByTestId("tt-tune-editor-review_date");
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
        // cellId: "200_review_date",
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
      //   // cellId: "200_review_date",
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
      await formField.locator.fill(formField.modification);
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
    await this.sidebarButton.waitFor({
      state: "attached",
      timeout: 60000,
    });
    await this.sidebarButton.waitFor({
      state: "visible",
      timeout: 60000,
    });
    await this.sidebarButton.isEnabled();

    // Click and wait deterministically for the editor form to appear
    await Promise.all([
      this.form.waitFor({ state: "visible", timeout: 15_000 }),
      this.sidebarButton.click(),
    ]);
    await this.IdTitle.waitFor({ state: "visible", timeout: 15_000 });

    console.log("===> tune-editor.po.ts:32 ~ ");
  }

  async navigateToFormFieldById(formFieldTestId: string): Promise<Locator> {
    console.log("===> tune-editor.po.ts:17 ~ ");

    // const titleFormFieldLocator = page.getByTestId("tt-tune-editor-title");
    // const titleFormFieldLocator = page.getByLabel("Title:");
    const formFieldLocator = this.form.getByTestId(formFieldTestId);
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
    const responsePromise: Promise<Response> = this.page.waitForResponse(
      (response) =>
        response.url() === "https://localhost:3000/home" &&
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
    return response;
  }

  async pressCancel(): Promise<Response> {
    const response = await this.pressButton("Cancel");
    return response;
  }
}
