import type { Locator, Page, Response } from "@playwright/test";
import { TuneTreesPageObject } from "./tunetrees.po";

export class TuneEditorPageObject extends TuneTreesPageObject {
  readonly tuneEditSidebarButton;
  readonly ttTuneEditorForm;
  readonly tuneEditorIDTitle;

  constructor(page: Page) {
    super(page);

    this.tuneEditSidebarButton = page.getByTestId("tt-sidebar-edit-tune");
    this.ttTuneEditorForm = this.page.getByTestId("tt-tune-editor-form");
    this.tuneEditorIDTitle = this.page.getByRole("heading", { name: "Tune #" });
  }

  async openTuneEditorForCurrentTune(): Promise<void> {
    await this.tuneEditSidebarButton.waitFor({
      state: "attached",
      timeout: 60000,
    });
    await this.tuneEditSidebarButton.waitFor({
      state: "visible",
      timeout: 60000,
    });
    await this.tuneEditSidebarButton.isEnabled();

    await this.tuneEditSidebarButton.click();
    await this.ttTuneEditorForm.waitFor({ state: "visible" });
    await this.tuneEditorIDTitle.waitFor({ state: "visible" });

    console.log("===> tune-editor.po.ts:32 ~ ");
  }

  async navigateToFormField(formFieldTestId: string): Promise<Locator> {
    console.log("===> tune-editor.po.ts:17 ~ ");

    // const titleFormFieldLocator = page.getByTestId("tt-tune-editor-title");
    // const titleFormFieldLocator = page.getByLabel("Title:");
    const formFieldLocator = this.ttTuneEditorForm.getByTestId(formFieldTestId);
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
