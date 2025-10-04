# Why is ScheduledTunesGrid rerendering so many times when I switch tabs?

The `ScheduledTunesGrid` component is re-rendering multiple times when you switch tabs because some of its dependencies cause state changes or effects to re-run upon tab change. Here are the potential reasons:

1. **`useTuneDataRefresh` Context Changes**:
   - The `refreshId` from the `useTuneDataRefresh` context might be updating when you switch tabs. This can happen if the context provider triggers a refresh based on tab visibility changes.
   - The `useEffect` hook that depends on `refreshId` and other variables will re-run whenever `refreshId` changes, causing a state update and re-render.

   ```tsx
   // ...existing code...
   useEffect(() => {
     if (tunesRefreshId !== refreshId && !isRefreshing.current) {
       // ...existing code...
       refreshTunes(userId, playlistId, refreshId)
         .then((result: Tune[]) => {
           // ...existing code...
         })
         .catch((error) => {
           // ...existing code...
         });
     }
   }, [refreshId, tunesRefreshId, userId, playlistId, refreshTunes]);
   // ...existing code...
   ```

2. **Component Unmounting and Remounting**:
   - If the parent component or routing logic unmounts `ScheduledTunesGrid` when you switch tabs, it will remount when you return, triggering all `useEffect` hooks marked to run on mount.
   - The `useEffect` that sets `isClient` will run on each mount, causing at least one re-render.

   ```tsx
   // ...existing code...
   useEffect(() => {
     setIsClient(true);
   }, []);
   // ...existing code...
   ```

3. **State Updates from `useScheduledTunes` Context**:
   - If the `tunes` array from `useScheduledTunes` changes when you switch tabs, it will cause re-renders due to state updates.
   - Any side effects or computations based on `tunes` will re-run.

   ```tsx
   // ...existing code...
   const { tunes, setTunes, tunesRefreshId, setTunesRefreshId } = useScheduledTunes();
   // ...existing code...
   useEffect(() => {
     const hasNonEmptyRecallEval = tunes.some((tune) => tune.recall_eval);
     setIsSubmitEnabled(hasNonEmptyRecallEval);
   }, [tunes]);
   // ...existing code...
   ```

4. **Visibility Change Events Triggering State Changes**:
   - If there are event listeners elsewhere in your application that respond to `visibilitychange` events (when you switch tabs), they might be updating context or global state that `ScheduledTunesGrid` depends on.

**Suggestions to Mitigate Re-renders**:

- **Inspect Context Providers**: Check if `useTuneDataRefresh` or `useScheduledTunes` providers are updating values on tab switches.
- **Optimize `useEffect` Dependencies**: Ensure that `useEffect` hooks only depend on necessary variables to prevent unnecessary re-runs.
- **Use `React.memo`**: Wrap the `ScheduledTunesGrid` export with `React.memo` to prevent re-renders when props haven’t changed.

  ```tsx
  // filepath: /Users/sboag/gittt/tunetrees/frontend/app/(main)/pages/practice/components/ScheduledTunesGrid.tsx
  import React from "react";
  // ...existing code...
  export default React.memo(ScheduledTunesGrid);
  ```

- **Debug with Console Logs**: Add console logs inside `useEffect` hooks and render bodies to trace when and why re-renders occur.

By pinpointing which state or context changes are causing the re-renders when you switch tabs, you can adjust your component or context logic to prevent unnecessary updates.
