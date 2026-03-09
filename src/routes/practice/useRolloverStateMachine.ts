import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Resource,
} from "solid-js";
import { getPracticeDate } from "../../lib/utils/practice-date";

interface RolloverStatus {
  ready: boolean;
  showBanner: boolean;
  shouldAutoAdvance: boolean;
  shouldClearManual: boolean;
  dateChanged: boolean;
  wallClockDate: Date;
}

export interface RolloverStateMachineProps {
  queueDate: Accessor<Date>;
  isManual: Accessor<boolean>;
  isQueueCompleted: Accessor<boolean>;
  queueReady: Resource<true>;
  onAutoAdvance: () => Promise<void> | void;
  onClearManual: () => void;
}

export interface RolloverStateMachineState {
  rolloverStatus: Accessor<RolloverStatus>;
  wallClockDate: Accessor<Date>;
}

function getRolloverIntervalMs(): number {
  if (typeof window !== "undefined") {
    const override = (
      window as unknown as {
        __TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__?: number;
      }
    ).__TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__;
    const parsed = Number(override);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 60000;
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function useRolloverStateMachine(
  props: RolloverStateMachineProps
): RolloverStateMachineState {
  const [wallClockDate, setWallClockDate] = createSignal(getPracticeDate(), {
    equals: (left, right) => isSameDay(left, right),
  });

  const intervalMs = getRolloverIntervalMs();
  const timer = setInterval(
    () => setWallClockDate(getPracticeDate()),
    intervalMs
  );
  onCleanup(() => clearInterval(timer));

  const rolloverStatus = createMemo<RolloverStatus>(() => {
    const ready = props.queueReady() === true && !props.queueReady.loading;
    const manual = props.isManual();
    const completed = props.isQueueCompleted();
    const queueDay = props.queueDate();
    const today = wallClockDate();
    const dateChanged = !isSameDay(queueDay, today);

    if (!ready) {
      return {
        ready: false,
        showBanner: false,
        shouldAutoAdvance: false,
        shouldClearManual: false,
        dateChanged: false,
        wallClockDate: today,
      };
    }

    return {
      ready,
      showBanner: !manual && dateChanged && !completed,
      shouldAutoAdvance: !manual && dateChanged && completed,
      shouldClearManual: manual && isSameDay(queueDay, today),
      dateChanged,
      wallClockDate: today,
    };
  });

  createEffect<boolean>((didAutoAdvance) => {
    const shouldAutoAdvance = rolloverStatus().shouldAutoAdvance;
    if (shouldAutoAdvance && !didAutoAdvance) {
      void props.onAutoAdvance();
    }
    return shouldAutoAdvance;
  }, false);

  createEffect<boolean>((didClearManual) => {
    const shouldClearManual = rolloverStatus().shouldClearManual;
    if (shouldClearManual && !didClearManual) {
      props.onClearManual();
    }
    return shouldClearManual;
  }, false);

  return {
    rolloverStatus,
    wallClockDate,
  };
}
