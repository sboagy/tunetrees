/**
 * Shared styles for all grid components (Catalog, Repertoire, Practice)
 *
 * This file centralizes the styling for headers, rows, and containers
 * to ensure consistency across all grids.
 *
 * To customize:
 * - Adjust header height via HEADER_CLASSES (py-2 controls padding)
 * - Change borders by modifying border classes in HEADER_CLASSES and CONTAINER_CLASSES
 * - Update colors in HEADER_CLASSES (bg-gray-100, border-gray-300, etc.)
 */

/**
 * Header row classes - controls header appearance and height
 * Border-top provides visual separation from toolbar
 */
export const HEADER_CLASSES =
  "sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border-t-2 border-t-gray-400 dark:border-t-gray-600 border-b border-gray-300 dark:border-gray-600";

/**
 * Individual header cell classes
 * Explicit height ensures consistency across all grids
 */
export const HEADER_CELL_BASE_CLASSES =
  "px-3 h-[36px] text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider relative group";

/**
 * Header cell border (right border between columns)
 * Set to empty string to remove borders between columns
 */
export const HEADER_CELL_BORDER_CLASSES =
  "border-r border-gray-200 dark:border-gray-700";

/**
 * Table container classes - controls outer container appearance
 * Remove border classes here to eliminate outer borders
 */
export const CONTAINER_CLASSES = "flex-1 overflow-auto relative touch-pan-y";

/**
 * Table element classes
 */
export const TABLE_CLASSES = "w-full border-collapse";

/**
 * Table body classes
 */
export const TBODY_CLASSES = "bg-white dark:bg-gray-900";

/**
 * Row classes for data rows
 */
export const ROW_CLASSES =
  "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors";

/**
 * Cell classes for data cells
 */
export const CELL_CLASSES =
  "px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

/**
 * Helper to combine header cell classes
 */
export const getHeaderCellClasses = (additionalClasses = "") => {
  return `${HEADER_CELL_BASE_CLASSES} ${HEADER_CELL_BORDER_CLASSES} ${additionalClasses}`.trim();
};
