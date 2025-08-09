"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useCallback } from "react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getPrefsSpacedRepetitionForUser } from "@/app/(main)/pages/practice/preferences";
import { useSession } from "next-auth/react";

const spacedRepetitionSchema = z.object({
  alg_type: z.enum(["SM2", "FSRS"], {
    required_error: "Algorithm type is required.",
  }),
  fsrs_weights: z.string().optional(),
  request_retention: z
    .number()
    .min(0, "Retention rate must be at least 0")
    .max(1, "Retention rate must not exceed 1")
    .optional(),
  maximum_interval: z
    .number()
    .int("Maximum interval must be a whole number")
    .positive("Maximum interval must be positive")
    .optional(),
});

type SpacedRepetitionFormValues = z.infer<typeof spacedRepetitionSchema>;

const staticDefaultValues: Partial<SpacedRepetitionFormValues> = {
  alg_type: "FSRS",
  fsrs_weights:
    "0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621",
  request_retention: 0.9,
  maximum_interval: 365,
};

const SpacedRepetitionForm = () => {
  const [defaultValues, setDefaultValues] =
    useState<Partial<SpacedRepetitionFormValues>>(staticDefaultValues);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const { toast } = useToast();

  const logAndToastError = useCallback(
    (error: unknown, toastMessage: string) => {
      console.error(toastMessage, error);
      toast({
        title: "Error",
        description: toastMessage,
      });
    },
    [toast],
  );

  const { data: session } = useSession();
  const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const prefs = await getPrefsSpacedRepetitionForUser(userId);
        if (prefs.length > 0) {
          const {
            algorithm: algType,
            fsrs_weights: fsrsWeights,
            request_retention: requestRetention,
            maximum_interval: maximumInterval,
          } = prefs[0];
          setDefaultValues({
            alg_type: algType,
            fsrs_weights: fsrsWeights,
            request_retention: requestRetention,
            maximum_interval: maximumInterval,
          });
        }
      } catch (error) {
        logAndToastError(
          error,
          "Failed to fetch preferences. Using static defaults.",
        );
      }
    };

    fetchPreferences().catch((error) => {
      logAndToastError(
        error,
        "An unexpected error occurred while fetching preferences.",
      );
    });
  }, [logAndToastError, userId]);

  const form = useForm<SpacedRepetitionFormValues>({
    resolver: zodResolver(spacedRepetitionSchema),
    defaultValues,
  });

  function onSubmit(data: SpacedRepetitionFormValues) {
    toast({
      title: "Saved spaced repetition preferences:",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  const handleOptimizeParams = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
      });
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch(
        `/api/preferences/optimize_fsrs?user_id=${userId}&alg_type=FSRS&force_optimization=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      form.setValue("fsrs_weights", result.optimized_parameters.join(", "));

      toast({
        title: "Success",
        description: `FSRS parameters optimized! Used ${result.review_count} review records. Loss: ${result.loss.toFixed(
          4,
        )}`,
      });
    } catch (error) {
      logAndToastError(error, "Failed to optimize FSRS parameters");
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={void form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="maximum_interval"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Interval (days)</FormLabel>
                <FormDescription>
                  Maximum number of days between reviews
                </FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="365"
                    {...field}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="alg_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Algorithm Type</FormLabel>
                <FormDescription>
                  Choose your preferred spaced repetition algorithm
                </FormDescription>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select algorithm type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="SM2">SM2</SelectItem>
                    <SelectItem value="FSRS">FSRS</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("alg_type") === "FSRS" && (
            <>
              <FormField
                control={form.control}
                name="fsrs_weights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FSRS Initial Weights</FormLabel>
                    <FormDescription>
                      Custom weights for FSRS algorithm (comma-separated
                      values). The algorithm will adjust these significantly
                      based on your actual performance. The initial weights
                      influence how quickly stability increases and how
                      intervals are initially set.
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 0.40255, 1.18385, 3.173, 15.69105, ..."
                        {...field}
                        className="min-h-[60px] max-h-[200px]"
                        style={{ resize: "vertical" }}
                      />
                    </FormControl>
                    <FormDescription>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isOptimizing || !session?.user?.id}
                        onClick={() => void handleOptimizeParams()}
                        className="mt-2"
                        data-testid="optimize-params-inline-button"
                      >
                        {isOptimizing
                          ? "Optimizing..."
                          : "Auto-Optimize Parameters"}
                      </Button>
                      <span className="ml-2 text-sm">
                        Automatically optimize weights based on your practice
                        history
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="request_retention"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Retention Rate</FormLabel>
                    <FormDescription>
                      Your desired memory retention rate (0-1)
                    </FormDescription>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        placeholder="0.9"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                onClick={() => void handleOptimizeParams()}
                variant="outline"
                disabled={isOptimizing}
                className="w-full h-12"
                data-testid="optimize-params-main-button"
              >
                {isOptimizing ? "Optimizing..." : "Optimize FSRS Parameters"}
              </Button>
            </>
          )}

          <Button
            type="submit"
            variant="secondary"
            disabled={
              !form.getValues("alg_type") ||
              !form.getValues("fsrs_weights") ||
              !form.getValues("request_retention") ||
              !form.getValues("maximum_interval")
            }
            className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
            data-testid="spaced-rep-update-button"
          >
            Update
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default SpacedRepetitionForm;
