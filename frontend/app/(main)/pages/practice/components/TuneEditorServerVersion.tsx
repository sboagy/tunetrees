"use server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { NextRequest } from "next/server";
import type { JSX } from "react";
import * as z from "zod";
import { getTuneStagedAction } from "../actions/practice-actions";

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  type: z.string().nullable(),
  structure: z.string().nullable(),
  mode: z.string().nullable(),
  incipit: z.string().nullable(),
  genre: z.string().nullable(),
  learned: z.string().nullable(),
  practiced: z.string().nullable(),
  quality: z.string().nullable(),
  easiness: z.number().nullable(),
  interval: z.number().nullable(),
  repetitions: z.number().nullable(),
  review_date: z.string().nullable(),
  backup_practiced: z.string().nullable(),
  external_ref: z.string().nullable(),
  notes_private: z.string().nullable(),
  notes_public: z.string().nullable(),
  tags: z.string().nullable(),
  recall_eval: z.string().nullable(),
});

interface ITuneEditorProps {
  userId: string;
  playlistId: string;
  tuneId: string;
}

export default async function TuneEditor({
  userId,
  playlistId,
  tuneId,
  returnUrl,
}: ITuneEditorProps & { returnUrl: string }): Promise<JSX.Element> {
  const tuneData = await getTuneStagedAction(userId, playlistId, tuneId);
  if (tuneData.length > 1) {
    return <div>Error: multiple tunes found that match ID {tuneId}</div>;
  }
  if (tuneData.length === 0) {
    return <div>Error: no tunes found that match ID {tuneId}</div>;
  }
  const tune = tuneData[0];

  if (!tune) {
    return <div>Loading...</div>;
  }

  const handleSubmit = async (request: NextRequest) => {
    try {
      // 1. Parse form data
      const formData = await request.formData();
      const data = Object.fromEntries(formData);

      // 2. Validate with Zod
      const validatedData = formSchema.parse(data);

      // 3. Process the data (e.g., send to your backend)
      console.log("Validated data:", validatedData);
      // ... your backend interaction logic ...

      // 4. Redirect after successful submission
      Response.redirect("/pages/practice"); // Or wherever you want to redirect
    } catch (error) {
      // Handle validation errors or other errors
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        // You can pass these errors back to the client if needed
      } else {
        console.error("An error occurred:", error);
      }
    }
  };

  const handleCancel = (request: NextRequest) => {
    // Get the current URL as a string
    // console.log("handleCancel: event.currentTarget: ", event.currentTarget);
    // const currentUrl = window.location.href;

    // Create NextRequest with the URL string
    // const request = new NextRequest(currentUrl);

    if (returnUrl) {
      request.nextUrl.pathname = returnUrl;
      return Response.redirect(request.nextUrl);
    }
    request.nextUrl.pathname = "/pages/practice";
    return Response.redirect(request.nextUrl);
  };

  return (
    <div className="flex flex-col h-full">
      {" "}
      {/* Make the outer container a flex column */}
      <ScrollArea className="h-full w-full rounded-md border p-4">
        <h1 className="text-2xl font-bold mb-4">Tune #{tune.id}</h1>

        <div className="flex-1 overflow-y-auto">
          {" "}
          {/* Make this div scrollable */}
          <form
            action={() => {
              void handleSubmit(new NextRequest(window.location.href));
            }} // Wrap in IIFE
            method="POST" // Important for form submission
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-1 gap-1">
              <div className="flex flex-row items-center space-y-0 space-x-2">
                <label htmlFor="title" className="w-1/3">
                  Title
                </label>
                <div className="w-2/3">
                  <Input type="text" id="title" name="title" />
                </div>
              </div>
              {/* ... other similar fields ... */}
            </div>

            <label htmlFor="notes_private">Private Notes</label>
            <Textarea id="notes_private" name="notes_private" />

            {/* ... other similar fields ... */}
          </form>
        </div>

        <div className="flex justify-end space-x-4 mt-4">
          {" "}
          {/* Keep buttons outside the scrollable div */}
          <Button
            type="button"
            onClick={() => {
              handleCancel(new NextRequest(window.location.href));
            }}
            variant="outline"
          >
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </ScrollArea>
    </div>
  );
}
