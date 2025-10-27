/**
 * Flashcard Field Visibility Types
 *
 * Defines the available fields that can be shown/hidden in flashcard mode.
 * Fields are separated by face (front/back) to allow different visibility per side.
 *
 * @module components/practice/flashcard-fields
 */

export type FlashcardField =
  | "type"
  | "mode"
  | "structure"
  | "incipit"
  | "note_public"
  | "note_private"
  | "favorite_url"
  | "goal"
  | "technique"
  | "practice_history";

export type FlashcardFace = "front" | "back";

export interface FlashcardFieldConfig {
  id: FlashcardField;
  label: string;
  defaultVisibleFront: boolean;
  defaultVisibleBack: boolean;
}

export const FLASHCARD_FIELDS: FlashcardFieldConfig[] = [
  {
    id: "type",
    label: "Type",
    defaultVisibleFront: true,
    defaultVisibleBack: true,
  },
  {
    id: "mode",
    label: "Mode",
    defaultVisibleFront: true,
    defaultVisibleBack: true,
  },
  {
    id: "structure",
    label: "Structure",
    defaultVisibleFront: false,
    defaultVisibleBack: true,
  },
  {
    id: "incipit",
    label: "Incipit",
    defaultVisibleFront: false,
    defaultVisibleBack: true,
  },
  {
    id: "note_public",
    label: "Public Notes",
    defaultVisibleFront: false,
    defaultVisibleBack: true,
  },
  {
    id: "note_private",
    label: "Private Notes",
    defaultVisibleFront: false,
    defaultVisibleBack: true,
  },
  {
    id: "favorite_url",
    label: "Reference URL",
    defaultVisibleFront: false,
    defaultVisibleBack: true,
  },
  {
    id: "goal",
    label: "Goal",
    defaultVisibleFront: false,
    defaultVisibleBack: true,
  },
  {
    id: "technique",
    label: "Technique",
    defaultVisibleFront: false,
    defaultVisibleBack: false,
  },
  {
    id: "practice_history",
    label: "Practice History",
    defaultVisibleFront: false,
    defaultVisibleBack: false,
  },
];

export type FlashcardFieldVisibility = Record<FlashcardField, boolean>;

export interface FlashcardFieldVisibilityByFace {
  front: FlashcardFieldVisibility;
  back: FlashcardFieldVisibility;
}

export const getDefaultFieldVisibility = (): FlashcardFieldVisibilityByFace => {
  const front = FLASHCARD_FIELDS.reduce((acc, field) => {
    acc[field.id] = field.defaultVisibleFront;
    return acc;
  }, {} as FlashcardFieldVisibility);

  const back = FLASHCARD_FIELDS.reduce((acc, field) => {
    acc[field.id] = field.defaultVisibleBack;
    return acc;
  }, {} as FlashcardFieldVisibility);

  return { front, back };
};
