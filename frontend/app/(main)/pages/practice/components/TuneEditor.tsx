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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ERROR_PLAYLIST_TUNE } from "../mocks";
import {
  deleteTune,
  getPlaylistTuneOverview,
  updateTuneInPlaylistFromTuneOverview,
} from "../queries";
import type { ITuneOverview } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import "./TuneEditor.css"; // Import the CSS file
import { useRepertoireTunes } from "./TunesContextRepertoire";

const formSchema = z.object({
  id: z.number().optional(),
  title: z.string().optional(),
  type: z.string().nullable().optional(),
  structure: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
  incipit: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  learned: z.string().nullable().optional(),
  practiced: z.string().nullable().optional(),
  quality: z.number().nullable().optional(),
  easiness: z.number().nullable().optional(),
  interval: z.number().nullable().optional(),
  repetitions: z.number().nullable().optional(),
  review_date: z.string().nullable().optional(),
  backup_practiced: z.string().nullable().optional(),
  note_private: z.string().nullable().optional(),
  note_public: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  user_ref: z.number().nullable().optional(),
  playlist_ref: z.number().nullable().optional(),
});

interface ITuneEditorProps {
  userId: number;
  playlistId: number;
  tuneId: number;
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
  if (!tuneId) {
    return <div>Missing tune ID</div>;
  }
  const origBoundingClientRect = mainElement.getBoundingClientRect();
  const headerFooterHeight = window.innerHeight - origBoundingClientRect.height;
  // const buttonsHeightSortOf = headerFooterHeight / 2;
  const [height, setHeight] = useState(origBoundingClientRect.height);
  const { triggerRefresh } = useTuneDataRefresh();
  const { setCurrentView } = useMainPaneView();

  const { tunes: repertoireTunes } = useRepertoireTunes();

  const isTuneInRepertoire = (tuneId: number): boolean => {
    return repertoireTunes.some((tune) => tune.id === tuneId);
  };

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

  const [tune, setTune] = useState<ITuneOverview | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  useEffect(() => {
    const fetchTune = () => {
      getPlaylistTuneOverview(userId, playlistId, tuneId)
        .then((tuneData: ITuneOverview | { detail: string }) => {
          if (tuneData && (tuneData as ITuneOverview).id !== undefined) {
            const tuneOverview = tuneData as ITuneOverview;
            setTune(tuneOverview);
            form.reset({
              ...tuneOverview,
              title: tuneOverview.title ?? undefined,
            });
          } else {
            console.error(
              `Failed to fetch tune: ${userId} ${playlistId} ${tuneId}`,
            );
            setTune(ERROR_PLAYLIST_TUNE);
          }
        })
        .catch((error) => {
          console.error(
            `Error fetching tune (${userId} ${playlistId} ${tuneId}): ${error}`,
          );
          setTune(ERROR_PLAYLIST_TUNE);
        });
    };

    void fetchTune();
  }, [userId, playlistId, tuneId, form]);

  const { triggerCurrentTuneUpdate } = useTune();

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    console.log(data);

    const result = await updateTuneInPlaylistFromTuneOverview(
      userId,
      playlistId,
      tuneId,
      { ...data, deleted: false } as ITuneOverview,
    );
    if ("detail" in result) {
      console.error("Failed to update tune:", result.detail);
    } else {
      console.log("Tune updated successfully");
    }
    triggerRefresh();
    setCurrentView("tabs");
    triggerCurrentTuneUpdate();
  };

  const handleCancel = async () => {
    // tune.deleted = true indicates this is a new tune, so it's
    // safe and proper to delete on cancel.
    if (tune?.deleted === true) {
      const response = await deleteTune(tuneId);
      if (response && "detail" in response) {
        console.error("Failed to delete tune:", response.detail);
        alert(`Failed to delete tune: ${response.detail}`);
      } else {
        console.log("Tune deleted successfully");
      }
    }
    setCurrentView("tabs");
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
        data-testid="tt-tune-editor-form"
      >
        <h1 className="text-2xl font-bold mb-4">Tune #{tune.id}</h1>
        <div
          className="flex flex-col flex-grow"
          style={{
            height: `${height - headerFooterHeight}px`,
            overflowY: "unset",
          }}
        >
          <div
            className="flex-grow w-full rounded-md border p-4 overflow-y-scroll"
            style={{
              minHeight: "calc(100vh - 400px)",
              maxHeight: "calc(100vh - 400px)",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem
                    className="tune-form-item-style"
                    data-testid="tt-tune-editor-title"
                  >
                    <FormLabel className="tune-form-label-style">
                      Title:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="tt-tune-editor-title-input"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                data-testid="tt-tune-editor-type"
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
                name="structure"
                data-testid="tt-tune-editor-structure"
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
                name="mode"
                data-testid="tt-tune-editor-mode"
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
                name="incipit"
                data-testid="tt-tune-editor-incipit"
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
                name="genre"
                data-testid="tt-tune-editor-genre"
                render={({ field }) => (
                  <FormItem className="tune-form-item-style">
                    <FormLabel className="tune-form-label-style">
                      Genre:{" "}
                    </FormLabel>

                    <FormControl className="tune-form-control-style">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isTuneInRepertoire(tune.id ?? -987) === true && (
                <>
                  <hr className="my-4" />

                  <FormField
                    control={form.control}
                    name="learned"
                    data-testid="tt-tune-editor-learned"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Learned Date:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ""}
                            readOnly
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="practiced"
                    data-testid="tt-tune-editor-practiced"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Practiced Date:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="datetime-local"
                            {...field}
                            value={
                              field.value ? field.value.replace(" ", "T") : ""
                            }
                            readOnly
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quality"
                    data-testid="tt-tune-editor-quality"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Quality:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            {...field}
                            value={field.value || ""}
                            readOnly
                          />
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
                    <em>Quality:</em>{" "}
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
                    name="easiness"
                    data-testid="tt-tune-editor-easiness"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Easiness:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="number"
                            {...field}
                            value={field.value?.toString() || ""}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                            readOnly
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interval"
                    data-testid="tt-tune-editor-interval"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Interval:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="number"
                            {...field}
                            value={field.value?.toString() || ""}
                            readOnly
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="repetitions"
                    data-testid="tt-tune-editor-repetitions"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Repetitions:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="number"
                            {...field}
                            value={field.value?.toString() || ""}
                            readOnly
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="review_date"
                    data-testid="tt-tune-editor-review_date"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style">
                        <FormLabel className="tune-form-label-style">
                          <em>Scheduled:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            type="datetime-local"
                            {...field}
                            value={
                              field.value ? field.value.replace(" ", "T") : ""
                            }
                            readOnly
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
                    <em>Backup Practiced Date:</em>{" "}
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
                    <em>External Reference:</em>{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  </FormItem>
                )}
                /> */}

                  {/* <FormField
                control={form.control}
                name="note_private"
                render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                  <em>Private Notes:</em>{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                  <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
                )}
              /> */}

                  {/* <FormField
                control={form.control}
                name="note_public"
                render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                  <em>Public Notes:</em>{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                  <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
                )}
              /> */}

                  <FormField
                    control={form.control}
                    name="tags"
                    data-testid="tt-tune-editor-tags"
                    render={({ field }) => (
                      <FormItem className="tune-form-item-style2">
                        <FormLabel className="tune-form-label-style">
                          <em>Tags:</em>{" "}
                        </FormLabel>

                        <FormControl className="tune-form-control-style">
                          <Input
                            {...field}
                            value={field.value || ""}
                            readOnly
                          />
                        </FormControl>

                        <FormDescription>
                          Separate tags with commas
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  {/* <FormField
                control={form.control}
                name="RecallEval"
                render={({ field }) => (
                <FormItem className="tune-form-item-style2">
                  <FormLabel className="tune-form-label-style">
                  <em>Recall Evaluation:</em>{" "}
                  </FormLabel>

                  <FormControl className="tune-form-control-style">
                  <Input {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
                )}
              /> */}
                </>
              )}
            </div>
          </div>

          <hr className="my-4" />

          <div className="flex w-3/5 justify-center space-x-4 p-4">
            <Button
              type="button"
              onClick={() => {
                handleCancel()
                  .then(() => console.log("Cancelled"))
                  .catch((error) => console.error("Error cancelling:", error));
              }}
              variant="outline"
              data-testid="tt-tune-editor-cancel-button"
            >
              Cancel
            </Button>

            <Button type="submit" data-testid="tt-tune-editor-submit-button">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
