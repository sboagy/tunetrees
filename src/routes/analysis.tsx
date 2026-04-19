/**
 * Analysis Page
 *
 * Practice statistics, charts, and FSRS analytics.
 * Shows progress over time, retention rates, and scheduling insights.
 *
 * Charts:
 * 1. FSRS Retention Curve — area chart, predicted memory decay
 * 2. Staleness Factor     — bar chart, tunes grouped by days overdue
 * 3. Practice Heatmap     — 365-day calendar grid
 * 4. Repertoire Coverage  — donut chart, tune types
 *
 * @module routes/analysis
 */

import {
  type Component,
  createEffect,
  createSignal,
  Match,
  onCleanup,
  Switch,
} from "solid-js";
import { AIChatDrawer } from "../components/ai/AIChatDrawer";
import { FsrsRetentionChart } from "../components/analysis/FsrsRetentionChart";
import { PracticeHeatmap } from "../components/analysis/PracticeHeatmap";
import { RepertoireCoverageChart } from "../components/analysis/RepertoireCoverageChart";
import { StalenessChart } from "../components/analysis/StalenessChart";
import { useCurrentRepertoire } from "../lib/context/CurrentRepertoireContext";

/**
 * Analysis Page Component
 *
 * Four data-driven chart cards displayed in a responsive 2-column grid on
 * larger screens and stacked on mobile.
 *
 * @example
 * ```tsx
 * <Route path="/analysis" component={AnalysisPage} />
 * ```
 */
const AnalysisPage: Component = () => {
  const [isChatOpen, setIsChatOpen] = createSignal(false);
  const { currentRepertoireId } = useCurrentRepertoire();

  createEffect(() => {
    const handleOpenAssistant = () => setIsChatOpen(true);
    window.addEventListener("tt-open-ai-assistant", handleOpenAssistant);
    onCleanup(() => {
      window.removeEventListener("tt-open-ai-assistant", handleOpenAssistant);
    });
  });

  return (
    <div class="flex h-full flex-col" data-testid="analysis-page">
      {/* Page Header */}
      <div class="mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-foreground">Analysis</h2>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Practice statistics and FSRS insights
          </p>
        </div>
      </div>

      {/* Charts — scrollable area, shown only when a repertoire is selected */}
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Switch>
          <Match when={!currentRepertoireId()}>
            <div class="flex h-full items-center justify-center">
              <p class="text-sm text-muted-foreground">
                Select a repertoire to view analysis charts
              </p>
            </div>
          </Match>
          <Match when={currentRepertoireId()}>
            {(rid) => (
              /* True 2×2 grid so all four charts fit in one viewport on sm+ */
              <div class="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
                {/* 1. FSRS Retention Curve */}
                <FsrsRetentionChart repertoireId={rid()} />

                {/* 2. Staleness Factor */}
                <StalenessChart repertoireId={rid()} />

                {/* 3. Practice Heatmap (internal overflow-x-auto handles narrow cells) */}
                <PracticeHeatmap repertoireId={rid()} />

                {/* 4. Repertoire Coverage */}
                <RepertoireCoverageChart repertoireId={rid()} />
              </div>
            )}
          </Match>
        </Switch>
      </div>

      <AIChatDrawer
        isOpen={isChatOpen()}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};

export default AnalysisPage;
