/**
 * Practice History Route
 *
 * Displays practice records for a tune in a read-only history table with
 * lightweight FSRS analytics and an optional manual backfill form.
 *
 * @module routes/tunes/[id]/practice-history
 */

import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { Plus, Save, Trash2 } from "lucide-solid";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart, LineChart } from "@/components/ui/charts";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentRepertoire } from "@/lib/context/CurrentRepertoireContext";
import {
  deletePracticeRecord,
  getPracticeRecordsForTune,
} from "@/lib/db/queries/practice-records";
import { getTuneForUserById } from "@/lib/db/queries/tunes";
import type { PracticeRecord } from "@/lib/db/types";
import { FSRS_QUALITY_MAP } from "@/lib/scheduling/fsrs-service";
import { recordPracticeRating } from "@/lib/services/practice-recording";
import {
  buildPracticeHistoryQualityChart,
  buildPracticeHistoryStabilityChart,
  buildPracticeHistorySummary,
  formatPracticeHistoryDate,
  getPracticeHistoryQualityDisplay,
  getPracticeHistoryStateLabel,
} from "./practice-history-utils";

interface DraftPracticeRecord {
  practiced: string;
  quality: number;
}

/**
 * Practice History Page Component
 *
 * Shows immutable historical FSRS reviews and tune-specific analytics.
 */
const PracticeHistoryPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb, userIdInt } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();

  const [draftRecord, setDraftRecord] =
    createSignal<DraftPracticeRecord | null>(null);
  const [isSavingDraft, setIsSavingDraft] = createSignal(false);
  const [deletingIds, setDeletingIds] = createSignal<Set<string>>(new Set());
  const [mutationError, setMutationError] = createSignal<string | null>(null);

  const returnPath = createMemo(() => {
    const state = location.state as { from?: string } | undefined;
    return state?.from || `/tunes/${params.id}`;
  });

  const [tune] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const uid = userIdInt();
      return db && tuneId && uid ? { db, tuneId, uid } : null;
    },
    async (resource) => {
      if (!resource) return null;
      return await getTuneForUserById(
        resource.db,
        resource.tuneId,
        resource.uid
      );
    }
  );

  const [practiceRecords, { refetch }] = createResource(
    () => {
      const db = localDb();
      const tuneId = params.id;
      const repertoireId = currentRepertoireId();
      return db && tuneId && repertoireId ? { db, tuneId, repertoireId } : null;
    },
    async (resource) => {
      if (!resource) return [];
      return await getPracticeRecordsForTune(
        resource.db,
        resource.tuneId,
        resource.repertoireId
      );
    }
  );

  const summary = createMemo(() =>
    buildPracticeHistorySummary(practiceRecords() ?? [])
  );

  const qualityChart = createMemo(() =>
    buildPracticeHistoryQualityChart(practiceRecords() ?? [])
  );

  const stabilityChart = createMemo(() =>
    buildPracticeHistoryStabilityChart(practiceRecords() ?? [])
  );

  const canAddRecord = createMemo(() => {
    return (
      !!localDb() &&
      !!currentRepertoireId() &&
      !!params.id &&
      !!userIdInt() &&
      !practiceRecords.loading &&
      !draftRecord()
    );
  });

  const createDefaultDraftRecord = (): DraftPracticeRecord => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return {
      practiced: `${year}-${month}-${day}T${hours}:${minutes}`,
      quality: FSRS_QUALITY_MAP.GOOD,
    };
  };

  const parseDateTimeLocalToIso = (value: string): string | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const handleBack = () => {
    navigate(returnPath());
  };

  const handleStartAdd = () => {
    setMutationError(null);
    setDraftRecord(createDefaultDraftRecord());
  };

  const handleCancelDraft = () => {
    setMutationError(null);
    setDraftRecord(null);
  };

  const handleSaveDraft = async () => {
    const db = localDb();
    const repertoireId = currentRepertoireId();
    const tuneId = params.id;
    const uid = userIdInt();
    const draft = draftRecord();
    const practicedIso = parseDateTimeLocalToIso(draft?.practiced ?? "");

    if (!db || !repertoireId || !tuneId || !uid || !draft) {
      return;
    }

    if (!practicedIso) {
      setMutationError("Enter a valid practice date and time before saving.");
      return;
    }

    setMutationError(null);
    setIsSavingDraft(true);

    try {
      const result = await recordPracticeRating(db, uid, {
        repertoireRef: repertoireId,
        tuneRef: tuneId,
        quality: draft.quality,
        practiced: new Date(practicedIso),
        goal: "recall",
      });

      if (!result.success) {
        throw new Error(result.error || "Unable to save practice record.");
      }

      setDraftRecord(null);
      await refetch();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Failed to save practice history entry."
      );
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    const db = localDb();
    if (!db) {
      return;
    }

    setMutationError(null);
    setDeletingIds((current) => new Set(current).add(recordId));

    try {
      await deletePracticeRecord(db, recordId);
      await refetch();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Failed to delete practice history entry."
      );
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(recordId);
        return next;
      });
    }
  };

  const statTiles = createMemo(() => [
    {
      label: "Sessions",
      value: summary().totalSessions.toString(),
    },
    {
      label: "Success Rate",
      value: `${summary().successRate}%`,
    },
    {
      label: "Current Streak",
      value: `${summary().currentStreak}`,
    },
    {
      label: "Avg Interval",
      value: `${summary().averageInterval}d`,
    },
  ]);

  return (
    <div
      class="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900"
      data-testid="practice-history-container"
    >
      <div class="w-full max-w-6xl px-4 py-4">
        <Card class="shadow-lg">
          <CardHeader class="border-b border-gray-200 dark:border-gray-700">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  Practice History
                  <Show when={tune()}>
                    <span class="font-normal text-gray-500 dark:text-gray-400">
                      {" "}
                      — {tune()!.title}
                    </span>
                  </Show>
                </CardTitle>
                <CardDescription>
                  Recorded FSRS reviews for this tune, plus tune-specific
                  trends.
                </CardDescription>
              </div>

              <div class="order-first flex flex-wrap items-center gap-2 self-end lg:order-none lg:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  data-testid="practice-history-cancel-button"
                >
                  <span>Cancel</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleStartAdd}
                  disabled={!canAddRecord()}
                  data-testid="practice-history-add-button"
                >
                  <Plus class="h-4 w-4" />
                  <span>Add</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-6 p-6">
            <Show when={mutationError()}>
              <div
                class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                role="alert"
              >
                {mutationError()}
              </div>
            </Show>

            <Show when={draftRecord()}>
              {(draft) => (
                <Card
                  class="border-dashed"
                  data-testid="practice-history-add-form"
                >
                  <CardHeader class="pb-3">
                    <CardTitle class="text-base font-semibold">
                      Add Practice Entry
                    </CardTitle>
                    <CardDescription>
                      Manual backfill uses FSRS ratings and calculates the next
                      due date automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                      <label class="grid gap-1.5 text-sm">
                        <span class="font-medium text-foreground">
                          Date Practiced
                        </span>
                        <input
                          type="datetime-local"
                          value={draft().practiced}
                          onInput={(event) =>
                            setDraftRecord((current) =>
                              current
                                ? {
                                    ...current,
                                    practiced: event.currentTarget.value,
                                  }
                                : current
                            )
                          }
                          class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                          data-testid="practice-history-practiced-input"
                        />
                      </label>

                      <label class="grid gap-1.5 text-sm">
                        <span class="font-medium text-foreground">
                          FSRS Rating
                        </span>
                        <select
                          value={String(draft().quality)}
                          onChange={(event) =>
                            setDraftRecord((current) =>
                              current
                                ? {
                                    ...current,
                                    quality: Number(event.currentTarget.value),
                                  }
                                : current
                            )
                          }
                          class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                          data-testid="practice-history-quality-select"
                        >
                          <option value={FSRS_QUALITY_MAP.AGAIN}>Again</option>
                          <option value={FSRS_QUALITY_MAP.HARD}>Hard</option>
                          <option value={FSRS_QUALITY_MAP.GOOD}>Good</option>
                          <option value={FSRS_QUALITY_MAP.EASY}>Easy</option>
                        </select>
                      </label>
                    </div>

                    <div class="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelDraft}
                        disabled={isSavingDraft()}
                        data-testid="practice-history-discard-button"
                      >
                        <span>Discard</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveDraft}
                        disabled={isSavingDraft()}
                        data-testid="practice-history-save-button"
                      >
                        <Save class="h-4 w-4" />
                        <span>Save</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </Show>

            <Show
              when={!practiceRecords.loading}
              fallback={
                <div class="py-8 text-center">
                  <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  <p class="mt-4 text-gray-600 dark:text-gray-400">
                    Loading practice history...
                  </p>
                </div>
              }
            >
              <Switch>
                <Match
                  when={
                    (practiceRecords()?.length ?? 0) === 0 && !draftRecord()
                  }
                >
                  <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p>No practice records found for this tune.</p>
                    <p class="mt-2 text-sm">
                      Use &quot;Add&quot; to backfill a prior session if needed.
                    </p>
                  </div>
                </Match>

                <Match when={(practiceRecords()?.length ?? 0) > 0}>
                  <div class="space-y-6">
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-gray-200 dark:border-gray-700">
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Date Practiced
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              FSRS Rating
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Due Date
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Stability
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Difficulty
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Reps
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              Lapses
                            </th>
                            <th class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                              State
                            </th>
                            <th class="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={practiceRecords()}>
                            {(record: PracticeRecord) => {
                              const qualityDisplay =
                                getPracticeHistoryQualityDisplay(
                                  record.quality
                                );

                              return (
                                <tr class="border-b border-gray-100 dark:border-gray-700/50">
                                  <td class="px-3 py-2 text-gray-700 dark:text-gray-200">
                                    {formatPracticeHistoryDate(
                                      record.practiced
                                    )}
                                  </td>
                                  <td class="px-3 py-2">
                                    <span
                                      class={`font-medium ${qualityDisplay.colorClass}`}
                                    >
                                      {qualityDisplay.label}
                                    </span>
                                  </td>
                                  <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {formatPracticeHistoryDate(record.due)}
                                  </td>
                                  <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {record.stability?.toFixed(2) ?? "—"}
                                  </td>
                                  <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {record.difficulty?.toFixed(2) ?? "—"}
                                  </td>
                                  <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {record.repetitions ?? "—"}
                                  </td>
                                  <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {record.lapses ?? "—"}
                                  </td>
                                  <td class="px-3 py-2 text-gray-600 dark:text-gray-400">
                                    {getPracticeHistoryStateLabel(record.state)}
                                  </td>
                                  <td class="px-3 py-2 text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(record.id)}
                                      disabled={deletingIds().has(record.id)}
                                      title="Delete record"
                                    >
                                      <Trash2 class="h-4 w-4 text-red-600 dark:text-red-400" />
                                      <span class="sr-only">
                                        Delete practice history entry
                                      </span>
                                    </Button>
                                  </td>
                                </tr>
                              );
                            }}
                          </For>
                        </tbody>
                      </table>
                    </div>

                    <div
                      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                      data-testid="practice-history-summary"
                    >
                      <For each={statTiles()}>
                        {(tile) => (
                          <div class="rounded-lg border border-border bg-muted/40 p-3">
                            <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {tile.label}
                            </div>
                            <div class="mt-1 text-xl font-semibold text-foreground">
                              {tile.value}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>

                    <div
                      class="grid gap-4 lg:grid-cols-2"
                      data-testid="practice-history-analytics"
                    >
                      <Card data-testid="practice-history-quality-chart">
                        <CardHeader class="pb-2">
                          <CardTitle class="text-base font-semibold">
                            Rating Trend
                          </CardTitle>
                          <CardDescription>
                            Review outcomes across this tune&apos;s practice
                            history
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Switch>
                            <Match when={qualityChart()}>
                              {(data) => (
                                <div class="relative h-48 w-full">
                                  <BarChart
                                    data={data()}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      scales: {
                                        x: {
                                          border: { display: false },
                                          grid: { display: false },
                                          ticks: { font: { size: 11 } },
                                        },
                                        y: {
                                          min: 1,
                                          max: 4,
                                          border: { display: false },
                                          ticks: {
                                            stepSize: 1,
                                            callback: (value) =>
                                              getPracticeHistoryQualityDisplay(
                                                Number(value)
                                              ).label,
                                            font: { size: 11 },
                                          },
                                          grid: {
                                            color:
                                              "hsla(240, 3.8%, 46.1%, 0.3)",
                                          },
                                        },
                                      },
                                      plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                          enabled: true,
                                          callbacks: {
                                            label: (context) =>
                                              ` ${getPracticeHistoryQualityDisplay(context.parsed.y).label}`,
                                          },
                                        },
                                      },
                                    }}
                                  />
                                </div>
                              )}
                            </Match>
                          </Switch>
                        </CardContent>
                      </Card>

                      <Card data-testid="practice-history-stability-chart">
                        <CardHeader class="pb-2">
                          <CardTitle class="text-base font-semibold">
                            Stability Trend
                          </CardTitle>
                          <CardDescription>
                            How the tune&apos;s memory stability has changed
                            over time
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Switch>
                            <Match when={stabilityChart()}>
                              {(data) => (
                                <div class="relative h-48 w-full">
                                  <LineChart
                                    data={data()}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      scales: {
                                        x: {
                                          border: { display: false },
                                          grid: { display: false },
                                          ticks: { font: { size: 11 } },
                                        },
                                        y: {
                                          beginAtZero: true,
                                          border: { display: false },
                                          ticks: { font: { size: 11 } },
                                          grid: {
                                            color:
                                              "hsla(240, 3.8%, 46.1%, 0.3)",
                                          },
                                        },
                                      },
                                      plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                          enabled: true,
                                          callbacks: {
                                            label: (context) => {
                                              const value =
                                                typeof context.parsed.y ===
                                                "number"
                                                  ? context.parsed.y
                                                  : 0;
                                              return ` ${value.toFixed(2)} stability`;
                                            },
                                          },
                                        },
                                      },
                                    }}
                                  />
                                </div>
                              )}
                            </Match>
                            <Match when={!stabilityChart()}>
                              <div class="flex h-48 items-center justify-center text-sm text-muted-foreground">
                                Not enough stability data yet
                              </div>
                            </Match>
                          </Switch>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </Match>
              </Switch>
            </Show>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PracticeHistoryPage;
