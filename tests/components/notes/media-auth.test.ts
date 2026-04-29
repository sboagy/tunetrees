import { describe, expect, it } from "vitest";
import {
  attachMediaAuthToken,
  attachMediaAuthTokenToUrl,
  buildMediaViewUrl,
  stripMediaAuthToken,
} from "../../../src/components/notes/media-auth";

describe("note media auth helpers", () => {
  it("adds a runtime token to managed media URLs without changing the stored key", () => {
    const mediaUrl = buildMediaViewUrl("users/user-1/notes/example.png");

    expect(attachMediaAuthTokenToUrl(mediaUrl, "runtime-token")).toBe(
      `${mediaUrl}&token=runtime-token`
    );
  });

  it("adds and removes runtime media tokens inside note HTML", () => {
    const mediaUrl = buildMediaViewUrl("users/user-1/notes/example.png");
    const html = `<p><img src="${mediaUrl}"></p>`;

    const hydratedHtml = attachMediaAuthToken(html, "runtime-token");
    const hydratedTemplate = document.createElement("template");
    hydratedTemplate.innerHTML = hydratedHtml;
    expect(
      hydratedTemplate.content.querySelector("img")?.getAttribute("src")
    ).toBe(`${mediaUrl}&token=runtime-token`);

    expect(stripMediaAuthToken(hydratedHtml)).toBe(html);
  });
});
