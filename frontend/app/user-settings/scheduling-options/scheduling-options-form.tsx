"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "next-auth/react";
import {
  updateSchedulingOptionsAction,
  type IPrefsSchedulingOptionsUpdate,
  type IPrefsSchedulingOptionsResponse,
} from "./actions/scheduling-options-actions";

// Helpers for validating optional JSON strings
const optionalJsonObjectString = z
  .string()
  .optional()
  .refine(
    (s) => {
      const str = (s ?? "").trim();
      if (str === "") return true;
      try {
        const parsed = JSON.parse(str);
        return (
          parsed !== null &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        );
      } catch {
        return false;
      }
    },
    { message: "Must be valid JSON object (or leave blank)" },
  );

const optionalJsonArrayString = z
  .string()
  .optional()
  .refine(
    (s) => {
      const str = (s ?? "").trim();
      if (str === "") return true;
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    },
    { message: "Must be valid JSON array (or leave blank)" },
  );

const schema = z.object({
  acceptable_delinquency_window: z.number().min(0).max(365).optional(),
  min_reviews_per_day: z.number().min(0).max(10000).optional(),
  max_reviews_per_day: z.number().min(0).max(10000).optional(),
  days_per_week: z.number().min(0).max(7).optional(),
  weekly_rules: optionalJsonObjectString,
  exceptions: optionalJsonArrayString,
});

type FormValues = z.infer<typeof schema>;

interface ISchedulingOptionsFormProps {
  initialPrefs: IPrefsSchedulingOptionsResponse | null;
}

export default function SchedulingOptionsForm({
  initialPrefs,
}: ISchedulingOptionsFormProps) {
  const { toast } = useToast();
  const { data: session } = useSession();
  const userId = useMemo(
    () => (session?.user?.id ? Number.parseInt(session.user.id) : -1),
    [session?.user?.id],
  );

  const parseIntOrUndefined = (value: string): number | undefined => {
    if (value === "" || value === null || value === undefined) return undefined;
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? undefined : n;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      acceptable_delinquency_window: 21,
      min_reviews_per_day: undefined,
      max_reviews_per_day: undefined,
      days_per_week: undefined,
      weekly_rules: "",
      exceptions: "",
    },
  });

  const { isSubmitting, isValid, errors } =
    form.formState as typeof form.formState & {
      errors: Record<string, unknown>;
    };
  // Workaround: Playwright test observed RHF isDirty not transitioning to true reliably after field edits
  // for this form (likely due to reset timing). We track a simple touched flag once any user change occurs.
  const [touched, setTouched] = useState(false);
  const markTouched = () => {
    if (!touched) setTouched(true);
  };

  useEffect(() => {
    if (initialPrefs) {
      form.reset({
        acceptable_delinquency_window:
          initialPrefs.acceptable_delinquency_window,
        min_reviews_per_day: initialPrefs.min_reviews_per_day,
        max_reviews_per_day: initialPrefs.max_reviews_per_day,
        days_per_week: initialPrefs.days_per_week,
        weekly_rules: initialPrefs.weekly_rules ?? "",
        exceptions: initialPrefs.exceptions ?? "",
      });
    }
  }, [form, initialPrefs]);

  async function onSubmit(values: FormValues) {
    if (userId <= 0) {
      toast({ title: "Error", description: "User not authenticated" });
      return;
    }
    try {
      const payload: IPrefsSchedulingOptionsUpdate = { ...values };
      const result = await updateSchedulingOptionsAction(userId, {
        user_id: userId,
        ...payload,
      });
      toast({
        title: "Saved",
        description: `Scheduling options updated for user ${result.user_id}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Unable to save scheduling options",
      });
    }
  }

  return (
    <Form {...form}>
      <form
        data-testid="sched-options-form"
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="acceptable_delinquency_window"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Acceptable Delinquency Window (days)</FormLabel>
              <FormDescription>
                How many days late a review can be without penalty.
              </FormDescription>
              <FormControl>
                <Input
                  type="number"
                  placeholder="21"
                  data-testid="sched-acceptable-delinquency-input"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    markTouched();
                    field.onChange(parseIntOrUndefined(e.target.value));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="min_reviews_per_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Reviews Per Day</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    data-testid="sched-min-per-day-input"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      markTouched();
                      field.onChange(parseIntOrUndefined(e.target.value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="max_reviews_per_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Reviews Per Day</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g. 50"
                    data-testid="sched-max-per-day-input"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      markTouched();
                      field.onChange(parseIntOrUndefined(e.target.value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="days_per_week"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Days per Week</FormLabel>
              <FormDescription>
                How many days you aim to practice each week.
              </FormDescription>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g. 5"
                  data-testid="sched-days-per-week-input"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    markTouched();
                    field.onChange(parseIntOrUndefined(e.target.value));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="weekly_rules"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weekly Rules (JSON)</FormLabel>
              <FormDescription>
                Describe weekly practice rules (e.g., which weekdays to
                practice).
              </FormDescription>
              <FormControl>
                <Textarea
                  placeholder='{"mon": true, "wed": true, "fri": true}'
                  data-testid="sched-weekly-rules-input"
                  {...field}
                  className="min-h-[60px]"
                  onChange={(e) => {
                    markTouched();
                    field.onChange(e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="exceptions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Exceptions (JSON)</FormLabel>
              <FormDescription>
                Specific date overrides (YYYY-MM-DD).
              </FormDescription>
              <FormControl>
                <Textarea
                  placeholder='["2025-08-15", "2025-08-22"]'
                  data-testid="sched-exceptions-input"
                  {...field}
                  className="min-h-[60px]"
                  onChange={(e) => {
                    markTouched();
                    field.onChange(e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          data-testid="sched-submit-button"
          variant="secondary"
          className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
          // Enable when user touched something AND there are no validation errors
          disabled={!touched || isSubmitting || Object.keys(errors).length > 0}
        >
          {isSubmitting ? "Saving..." : "Update scheduling options"}
        </Button>
      </form>
    </Form>
  );
}
