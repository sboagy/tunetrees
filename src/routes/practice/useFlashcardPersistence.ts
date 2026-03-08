import {
  type Accessor,
  createEffect,
  createSignal,
  onMount,
  type Setter,
} from "solid-js";
import {
  type FlashcardFieldVisibilityByFace,
  getDefaultFieldVisibility,
} from "../../components/practice/flashcard-fields";

const FLASHCARD_MODE_STORAGE_KEY = "TT_PRACTICE_FLASHCARD_MODE";
const FLASHCARD_FIELDS_STORAGE_KEY = "TT_FLASHCARD_FIELD_VISIBILITY";

export interface FlashcardPersistenceState {
  flashcardMode: Accessor<boolean>;
  setFlashcardMode: Setter<boolean>;
  flashcardFieldVisibility: Accessor<FlashcardFieldVisibilityByFace>;
  setFlashcardFieldVisibility: Setter<FlashcardFieldVisibilityByFace>;
}

export function useFlashcardPersistence(): FlashcardPersistenceState {
  const [flashcardMode, setFlashcardMode] = createSignal(false);
  const [flashcardFieldVisibility, setFlashcardFieldVisibility] =
    createSignal<FlashcardFieldVisibilityByFace>(getDefaultFieldVisibility());

  onMount(() => {
    const storedMode = localStorage.getItem(FLASHCARD_MODE_STORAGE_KEY);
    if (storedMode !== null) {
      setFlashcardMode(storedMode === "true");
    }

    const storedFields = localStorage.getItem(FLASHCARD_FIELDS_STORAGE_KEY);
    if (!storedFields) {
      return;
    }

    try {
      const parsed = JSON.parse(storedFields);

      if (parsed.type !== undefined && !parsed.front) {
        console.info(
          "Migrating old flashcard field visibility format to new front/back structure"
        );
        setFlashcardFieldVisibility({
          front: { ...parsed },
          back: { ...parsed },
        });
        return;
      }

      if (parsed.front && parsed.back) {
        setFlashcardFieldVisibility(parsed);
        return;
      }

      console.warn(
        "Unrecognized flashcard field visibility format, using defaults"
      );
    } catch (error) {
      console.error("Failed to parse flashcard field visibility:", error);
    }
  });

  createEffect(() => {
    localStorage.setItem(FLASHCARD_MODE_STORAGE_KEY, String(flashcardMode()));
  });

  createEffect(() => {
    localStorage.setItem(
      FLASHCARD_FIELDS_STORAGE_KEY,
      JSON.stringify(flashcardFieldVisibility())
    );
  });

  return {
    flashcardMode,
    setFlashcardMode,
    flashcardFieldVisibility,
    setFlashcardFieldVisibility,
  };
}
