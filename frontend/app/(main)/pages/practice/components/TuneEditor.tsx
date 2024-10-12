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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTuneStaged } from "../queries";

type Tune = {
  id: number;
  title: string;
  type: string | null;
  structure: string | null;
  mode: string | null;
  incipit: string | null;
  learned: string | null;
  practiced: string | null;
  quality: string | null;
  easiness: number | null;
  interval: number | null;
  repetitions: number | null;
  review_date: string | null;
  backup_practiced: string | null;
  external_ref?: string | null;
  notes_private?: string | null;
  notes_public?: string | null;
  tags?: string | null;
  recall_eval?: string | null;
};

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  type: z.string().nullable(),
  structure: z.string().nullable(),
  mode: z.string().nullable(),
  incipit: z.string().nullable(),
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

  const [tune, setTune] = useState<Tune | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  useEffect(() => {
    const fetchTune = async () => {
      const tuneData = await getTuneStaged(userId, playlistId, tuneId);

      if (tuneData.length > 0) {
        setTune(tuneData[0]);

        form.reset(tuneData[0]);
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
        <h1 className="text-2xl font-bold mb-4">Tune #{tune.id}</h1>
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
            <div className="grid grid-cols-1 md:grid-cols-1 gap-1">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">Title: </FormLabel>

                    <FormControl className="w-1/5">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">Type: </FormLabel>

                    <FormControl className="w-1/5">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="structure"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Structure:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">Mode: </FormLabel>

                    <FormControl className="w-1/5">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="incipit"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Incipit:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="learned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Learned Date:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="practiced"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Practiced Date:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quality"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Quality:{" "}
                    </FormLabel>

                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl className="w-1/5">
                        <SelectTrigger>
                          <SelectValue placeholder="Select quality" />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        <SelectItem value="Poor">Poor</SelectItem>

                        <SelectItem value="Fair">Fair</SelectItem>

                        <SelectItem value="Good">Good</SelectItem>

                        <SelectItem value="Excellent">Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="easiness"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Easiness:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
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
                name="interval"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Interval:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
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
                name="repetitions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Repetitions:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
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
                name="review_date"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Review Date:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="backup_practiced"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      Backup Practiced Date:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="external_ref"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormLabel className="w-1/5 text-right">
                      External Reference:{" "}
                    </FormLabel>

                    <FormControl className="w-1/5">
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes_private"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                  <FormLabel className="w-1/5 text-right">
                    Private Notes:{" "}
                  </FormLabel>

                  <FormControl className="w-1/5">
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes_public"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                  <FormLabel className="w-1/5 text-right">
                    Public Notes:{" "}
                  </FormLabel>

                  <FormControl className="w-1/5">
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                  <FormLabel className="w-1/5 text-right">Tags: </FormLabel>

                  <FormControl className="w-1/5">
                    <Input {...field} value={field.value || ""} />
                  </FormControl>

                  <FormDescription>Separate tags with commas</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recall_eval"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                  <FormLabel className="w-1/5 text-right">
                    Recall Evaluation:{" "}
                  </FormLabel>

                  <FormControl className="w-1/5">
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                </FormItem>
              )}
            />
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
