import type { Locator, Page, Response } from "@playwright/test";
import { TuneTreesPageObject } from "./tunetrees.po";

// await ttPO.ffTitle.fill("Boyne Hunt x");
type FormFieldUpdate = {
  label: string;
  locator: Locator;
  modification: string;
  original: string;
  cellId?: string;
};

export class TuneEditorPageObject extends TuneTreesPageObject {
  readonly sidebarButton: Locator;
  readonly form: Locator;
  readonly IdTitle: Locator;
  readonly ffTitle: Locator;
  readonly ffType: Locator;
  readonly ffStructure: Locator;
  readonly ffMode: Locator;
  readonly ffIncipit: Locator;
  readonly ffGenre: Locator;
  readonly ffLearned: Locator;
  readonly ffPracticed: Locator;
  readonly ffQuality: Locator;
  readonly ffEasiness: Locator;
  readonly ffInterval: Locator;
  readonly ffRepetitions: Locator;
  readonly ffReviewDate: Locator;
  readonly ffTags: Locator;

  readonly allFormFields: Locator[];

  readonly sampleBoyneHunt: FormFieldUpdate[];

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

    this.sampleBoyneHunt = [
      {
        label: "Title",
        locator: this.ffTitle.locator("input"),
        modification: "Boyne Hunt x",
        original: "Boyne Hunt",
        cellId: "200_title",
      },
      {
        label: "Type",
        locator: this.ffType.locator("input"),
        modification: "Jig",
        original: "Reel",
        cellId: "200_type",
      },
      {
        label: "Structure",
        locator: this.ffStructure.locator("input"),
        modification: "AABB",
        original: "AB",
        cellId: "200_structure",
      },
      {
        label: "Mode",
        locator: this.ffMode.locator("input"),
        modification: "G Major",
        original: "D Major",
      },
      {
        label: "Incipit",
        locator: this.ffIncipit.locator("input"),
        modification: "|ABC DEF|",
        original: "|A2FA DAFA|DAFA BEeB|",
      },
      {
        label: "Genre",
        locator: this.ffGenre.locator("input"),
        modification: "FADO",
        original: "ITRAD",
      },
      {
        label: "Learned Date",
        locator: this.ffLearned.locator("input"),
        modification: "2010-11-24",
        original: "2010-11-20",
      },
      {
        label: "Practiced Date",
        locator: this.ffPracticed.locator("input"),
        modification: "2023-06-06T10:25:16",
        original: "2023-06-06T22:25:16",
        // TODO: Have to factor out date formatting and maybe (?) time zone issues
        // cellId: "200_practiced",
      },
      {
        label: "Quality",
        locator: this.ffQuality.locator("input"),
        modification: "2",
        original: "1",
      },
      {
        label: "Easiness",
        locator: this.ffEasiness.locator("input"),
        modification: "1.99",
        original: "1.96",
      },
      {
        label: "Interval",
        locator: this.ffInterval.locator("input"),
        modification: "2",
        original: "1",
      },
      {
        label: "Repetitions",
        locator: this.ffRepetitions.locator("input"),
        modification: "3",
        original: "0",
      },
      {
        label: "Scheduled",
        locator: this.ffReviewDate.locator("input"),
        modification: "2023-06-07T10:25:16",
        original: "2023-06-07T22:25:16",
        // TODO: Have to factor out date formatting and maybe (?) time zone issues
        // cellId: "200_review_date",
      },
    ];
  }

  findUpdateByLabel(
    label: string,
    updates: FormFieldUpdate[],
  ): FormFieldUpdate | undefined {
    return updates.find((update) => update.label === label);
  }

  async openTuneEditorForCurrentTune(): Promise<void> {
    await this.sidebarButton.waitFor({
      state: "attached",
      timeout: 60000,
    });
    await this.sidebarButton.waitFor({
      state: "visible",
      timeout: 60000,
    });
    await this.sidebarButton.isEnabled();

    await this.sidebarButton.click();
    await this.form.waitFor({ state: "visible" });
    await this.IdTitle.waitFor({ state: "visible" });

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
    await this.page.getByRole("button", { name: buttonName }).click();
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
