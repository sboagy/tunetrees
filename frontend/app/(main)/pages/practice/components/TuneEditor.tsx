import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPlaylistTune } from "../queries";
import "./TuneEditor.css"; // Import the CSS file
import type { PlaylistTune } from "../types";

const formSchema = z.object({
  ID: z.number().optional(),
  Title: z.string().optional(),
  Type: z.string().optional(),
  Structure: z.string().optional(),
  Mode: z.string().optional(),
  Incipit: z.string().optional(),
  Learned: z.string().optional(),
  Practiced: z.string().optional(),
  Quality: z.number().optional(),
  Easiness: z.number().optional(),
  Interval: z.number().optional(),
  Repetitions: z.number().optional(),
  ReviewDate: z.string().optional(),
  BackupPracticed: z.string().optional(),
  NotePrivate: z.string().optional(),
  NotePublic: z.string().optional(),
  Tags: z.string().optional(),
  USER_REF: z.number().optional(),
  PLAYLIST_REF: z.number().optional(),
});

interface ITuneEditorProps {
  userId: string;
  playlistId: string;
  tuneId: string;
}

export default function TuneEditor({
  userId,
  playlistId,
  tuneId,
}: ITuneEditorProps) {
  // const squishFactorY = 0.75;
  const mainElement = document.querySelector("#main-content");
  if (!mainElement) {
    return <div>Missing main element</div>;
  }
  const origBoundingClientRect = mainElement.getBoundingClientRect();
  const headerFooterHeight = window.innerHeight - origBoundingClientRect.height;
  // const buttonsHeightSortOf = headerFooterHeight / 2;
  const [height, setHeight] = useState(origBoundingClientRect.height);

  useEffect(() => {
    // const mainElement = document.querySelector("#main-content");

    const handleResize = () => {
      if (mainElement) {
        setHeight(window.innerHeight - headerFooterHeight);
        // setHeight(mainElement.clientHeight);
        // const rect = mainElement.getBoundingClientRect();
        // setHeight(rect.height);
      }
    };

    if (mainElement) {
      setHeight(window.innerHeight - headerFooterHeight);
      // setHeight(mainElement.clientHeight);
      // const rect = mainElement.getBoundingClientRect();
      // setHeight(rect.height);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [headerFooterHeight, mainElement]);

  const [tune, setTune] = useState<PlaylistTune | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  useEffect(() => {
    const fetchTune = async () => {
      const tuneData = await getPlaylistTune(userId, playlistId, tuneId);

      if (tuneData) {
        setTune(tuneData);

        form.reset(tuneData);
      }
    };

    void fetchTune();
  }, [userId, playlistId, tuneId, form]);

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);

    // Here you would typically send the data to your backend
  };

  const router = useRouter();

  const handleCancel = () => {
    router.back();
  };

  if (!tune) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(onSubmit)(e);
        }}
        className="flex flex-col w-full space-y-4"
        style={{ height: `${height}px`, overflowY: "unset" }}
      >
        <h1 className="text-2xl font-bold mb-4">Tune #{tune.ID}</h1>
        <div
          className="flex flex-col flex-grow"
          style={{
            height: `${height - headerFooterHeight}px`,
            overflowY: "unset",
          }}
        >
          <ScrollArea
            className="flex-grow w-full rounded-md border p-4"
            style={{ height: "auto" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
              <FormField
                control={form.control}
                name="Title"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Title:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Type"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Type:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Structure"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Structure:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Mode"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Mode:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Incipit"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Incipit:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Learned"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Learned Date:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Practiced"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Practiced Date:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ? field.value.replace(" ", "T") : ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Quality"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Quality:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              {/* <FormField
                control={form.control}
                name="Quality"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Quality:{" "}
                    </FormLabel>

                    <Select
                      onValueChange={(value) =>
                        field.onChange(Number.parseInt(value))
                      }
                      value={
                        qualityList
                          .find(
                            (item) =>
                              item.int_value.toString() === field.value ||
                              item.value === field.value,
                          )
                          ?.int_value.toString() || ""
                      }
                    >
                      <FormControl className="tune-form-control-style">
                        <SelectTrigger>
                          <SelectValue placeholder="Select quality" />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        {qualityList.map((item) => (
                          <SelectItem
                            key={item.int_value}
                            value={item.int_value.toString()}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              /> */}

              <FormField
                control={form.control}
                name="Easiness"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Easiness:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        type="number"
                        {...field}
                        value={field.value?.toString() || ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Interval"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Interval:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        type="number"
                        {...field}
                        value={field.value?.toString() || ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="Repetitions"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Repetitions:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        type="number"
                        {...field}
                        value={field.value?.toString() || ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ReviewDate"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Review Date:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ? field.value.replace(" ", "T") : ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* <FormField
                control={form.control}
                name="BackupPracticed"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Backup Practiced Date:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ? field.value.replace(" ", "T") : ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              /> */}

              {/* <FormField
                control={form.control}
                name="external_ref"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style2">
                    <FormLabel className="tune-form-label-style">
                      External Reference:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              /> */}
            </div>

            <FormField
              control={form.control}
              name="NotePrivate"
              render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                    Private Notes:{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="NotePublic"
              render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                    Public Notes:{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="Tags"
              render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                    Tags:{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                    <Input {...field} value={field.value || ""} />
                  </FormControl>

                  <FormDescription>Separate tags with commas</FormDescription>
                </FormItem>
              )}
            />

            {/* <FormField
              control={form.control}
              name="RecallEval"
              render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                    Recall Evaluation:{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            /> */}
          </ScrollArea>

          <div className="flex w-3/5 justify-center space-x-4 p-4">
            <Button type="button" onClick={handleCancel} variant="outline">
              Cancel
            </Button>

            <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
