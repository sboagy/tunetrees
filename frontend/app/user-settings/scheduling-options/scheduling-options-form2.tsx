"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useMemo } from "react";
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

// Interfaces for strict typing (no any)
interface IPrefsSchedulingOptionsBase {
  user_id: number;
  acceptable_delinquency_window?: number;
  min_reviews_per_day?: number;
  max_reviews_per_day?: number;
  days_per_week?: number;
  weekly_rules?: string; // JSON string
  exceptions?: string; // JSON string
}

export type IPrefsSchedulingOptionsResponse = IPrefsSchedulingOptionsBase;
export type IPrefsSchedulingOptionsCreate = IPrefsSchedulingOptionsBase;
export type IPrefsSchedulingOptionsUpdate =
  Partial<IPrefsSchedulingOptionsBase>;

async function getPrefsSchedulingOptions(
  user_id: number,
): Promise<IPrefsSchedulingOptionsResponse | null> {
  const params = new URLSearchParams();
  params.append("user_id", String(user_id));
  const resp = await fetch(
    `/api/preferences/prefs_scheduling_options?${params.toString()}`,
  );
  if (resp.status === 404) return null;
  if (!resp.ok)
    throw new Error(`Failed to fetch scheduling options: ${resp.statusText}`);
  return (await resp.json()) as IPrefsSchedulingOptionsResponse;
}

async function createPrefsSchedulingOptions(
  prefs: IPrefsSchedulingOptionsCreate,
): Promise<IPrefsSchedulingOptionsResponse> {
  const resp = await fetch(`/api/preferences/prefs_scheduling_options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!resp.ok)
    throw new Error(`Failed to create scheduling options: ${resp.statusText}`);
  return (await resp.json()) as IPrefsSchedulingOptionsResponse;
}

async function updatePrefsSchedulingOptions(
  user_id: number,
  prefs: IPrefsSchedulingOptionsUpdate,
): Promise<IPrefsSchedulingOptionsResponse> {
  const params = new URLSearchParams();
  params.append("user_id", String(user_id));
  const resp = await fetch(
    `/api/preferences/prefs_scheduling_options?${params.toString()}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    },
  );
  if (!resp.ok)
    throw new Error(`Failed to update scheduling options: ${resp.statusText}`);
  return (await resp.json()) as IPrefsSchedulingOptionsResponse;
}

const schema = z.object({
  acceptable_delinquency_window: z.number().min(0).max(365).optional(),
  min_reviews_per_day: z.number().min(0).max(10000).optional(),
  max_reviews_per_day: z.number().min(0).max(10000).optional(),
  days_per_week: z.number().min(0).max(7).optional(),
  weekly_rules: z.string().optional(),
  exceptions: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SchedulingOptionsForm2() {
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
    defaultValues: {
      acceptable_delinquency_window: 21,
      min_reviews_per_day: undefined,
      max_reviews_per_day: undefined,
      days_per_week: undefined,
      weekly_rules: "",
      exceptions: "",
    },
  });

  useEffect(() => {
    if (userId <= 0) return;
    getPrefsSchedulingOptions(userId)
      .then((prefs) => {
        if (prefs) {
          form.reset({
            acceptable_delinquency_window: prefs.acceptable_delinquency_window,
            min_reviews_per_day: prefs.min_reviews_per_day,
            max_reviews_per_day: prefs.max_reviews_per_day,
            days_per_week: prefs.days_per_week,
            weekly_rules: prefs.weekly_rules ?? "",
            exceptions: prefs.exceptions ?? "",
          });
        }
      })
      .catch((error) => {
        console.error(error);
        toast({
          title: "Error",
          description: "Failed loading scheduling options.",
        });
      });
  }, [form, toast, userId]);

  async function onSubmit(values: FormValues) {
    if (userId <= 0) {
      toast({ title: "Error", description: "User not authenticated" });
      return;
    }
    try {
      const payload: IPrefsSchedulingOptionsUpdate = { ...values };
      // Create or update depending on whether a record exists
      const existing = await getPrefsSchedulingOptions(userId);
      const result = existing
        ? await updatePrefsSchedulingOptions(userId, payload)
        : await createPrefsSchedulingOptions({ user_id: userId, ...payload });

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
                  onChange={(e) =>
                    field.onChange(parseIntOrUndefined(e.target.value))
                  }
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
                    onChange={(e) =>
                      field.onChange(parseIntOrUndefined(e.target.value))
                    }
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
                    onChange={(e) =>
                      field.onChange(parseIntOrUndefined(e.target.value))
                    }
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
                  onChange={(e) =>
                    field.onChange(parseIntOrUndefined(e.target.value))
                  }
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          data-testid="sched-submit-button"
          className="w-full h-12"
        >
          Save Scheduling Options
        </Button>
      </form>
    </Form>
  );
}
