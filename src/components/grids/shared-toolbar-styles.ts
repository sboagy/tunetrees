/**
 * Shared Toolbar Styles
 *
 * Centralized styling constants for all toolbar components across tabs.
 * Ensures visual consistency between Practice, Repertoire, and Catalog toolbars.
 *
 * Usage:
 * ```tsx
 * import { TOOLBAR_CONTAINER_CLASSES, TOOLBAR_BUTTON_BASE } from './shared-toolbar-styles';
 *
 * <div class={TOOLBAR_CONTAINER_CLASSES}>
 *   <button class={TOOLBAR_BUTTON_BASE}>...</button>
 * </div>
 * ```
 *
 * @module components/grids/shared-toolbar-styles
 */

/**
 * Container for the entire toolbar section
 * - Sticky positioning at top
 * - z-10 to stay above grid content
 * - Consistent background and border
 */
export const TOOLBAR_CONTAINER_CLASSES =
  "sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200/30 dark:border-gray-700/30";

/**
 * Inner wrapper for toolbar content
 * - Responsive padding
 * - Explicit height for consistency across all toolbars
 */
export const TOOLBAR_INNER_CLASSES =
  "px-2 sm:px-3 lg:px-4 h-[46px] flex items-center";

/**
 * Flexbox container for toolbar buttons
 * - Gap between items
 * - Horizontal layout
 */
export const TOOLBAR_BUTTON_GROUP_CLASSES =
  "flex items-center gap-1.5 sm:gap-2";

/**
 * Base button styling (shared across all button types)
 * - Compact size (text-xs, px-2, py-0.5)
 * - Rounded corners
 * - Border
 * - Transition effects
 */
export const TOOLBAR_BUTTON_BASE =
  "flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap border";

/**
 * Primary action button (e.g., Submit, Add To Repertoire)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_PRIMARY =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 disabled:text-gray-400 disabled:border-gray-200 dark:disabled:text-gray-600 dark:disabled:border-gray-700 disabled:cursor-not-allowed";

/**
 * Success/Add button (e.g., Add Tune)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_SUCCESS =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600";

/**
 * Danger/Delete button (e.g., Delete Tunes)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_DANGER =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 disabled:text-gray-400 disabled:border-gray-200 dark:disabled:text-gray-600 dark:disabled:border-gray-700 disabled:cursor-not-allowed";

/**
 * Warning/Remove button (e.g., Remove From Repertoire)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_WARNING =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 disabled:text-gray-400 disabled:border-gray-200 dark:disabled:text-gray-600 dark:disabled:border-gray-700 disabled:cursor-not-allowed";

/**
 * Accent button (e.g., Add Tunes to queue - purple)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_ACCENT =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600";

/**
 * Neutral/Default button (e.g., Columns, Queue)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_NEUTRAL =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600";

/**
 * Neutral variant 2 (slightly different appearance)
 * Apply with TOOLBAR_BUTTON_BASE
 * Ghost/outline style - transparent background with border
 */
export const TOOLBAR_BUTTON_NEUTRAL_ALT =
  "text-gray-700 dark:text-gray-300 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 border-gray-300 dark:border-gray-600";

/**
 * Search input container
 * - Responsive width
 * - Relative positioning for icon
 */
export const TOOLBAR_SEARCH_CONTAINER =
  "relative hidden md:flex items-center flex-1 min-w-[12ch] max-w-xs";

/**
 * Search input field
 * - Consistent styling
 * - Left padding for icon
 * - Focus ring
 */
export const TOOLBAR_SEARCH_INPUT =
  "w-full px-3 py-1.5 pl-9 text-sm bg-white dark:bg-gray-900 border border-gray-200/50 dark:border-gray-700/50 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors";

/**
 * Search icon positioning
 */
export const TOOLBAR_SEARCH_ICON =
  "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none";

/**
 * Icon size for toolbar buttons
 */
export const TOOLBAR_ICON_SIZE = "w-3.5 h-3.5 flex-shrink-0";

/**
 * Flexbox spacer to push items to right
 */
export const TOOLBAR_SPACER = "flex-1";

/**
 * Badge for counts (e.g., evaluations count on Submit button)
 */
export const TOOLBAR_BADGE =
  "text-[10px] px-1 py-0 rounded-full bg-blue-600 dark:bg-blue-500 text-white";

/**
 * Grid content container (below toolbar)
 * - Fills remaining space
 * - Handles overflow
 */
export const GRID_CONTENT_CONTAINER = "flex-1 overflow-hidden";
