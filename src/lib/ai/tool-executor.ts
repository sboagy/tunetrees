/**
 * AI Tool Executor
 *
 * Executes tool calls returned by the AI assistant.
 * This is the "hands" that connect AI decisions to app actions.
 */

import type { SqliteDatabase } from "../db/client-sqlite";
import { createNote, getNotesByTune, updateNote } from "../db/queries/notes";
import { createPracticeRecord } from "../db/queries/practice-records";
import { searchTunes } from "../db/queries/tunes";
import type {
  AddNoteArgs,
  FilterTunesArgs,
  GetTuneDetailsArgs,
  LogPracticeArgs,
  ToolCall,
} from "./types";

interface ToolExecutorContext {
  localDb: SqliteDatabase;
  userId: string;
  currentRepertoireId?: string;
  setSelectedTypes?: (types: string[]) => void;
  setSelectedModes?: (modes: string[]) => void;
  setSelectedGenres?: (genres: string[]) => void;
  setFilterStatus?: (status: string | null) => void;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Execute a tool call from the AI
 */
export async function executeToolCall(
  toolCall: ToolCall,
  context: ToolExecutorContext
): Promise<ToolExecutionResult> {
  try {
    switch (toolCall.tool) {
      case "filter_tunes":
        return await filterTunes(toolCall.args as FilterTunesArgs, context);

      case "log_practice":
        return await logPractice(toolCall.args as LogPracticeArgs, context);

      case "add_note":
        return await addNote(toolCall.args as AddNoteArgs, context);

      case "get_tune_details":
        return await getTuneDetails(
          toolCall.args as GetTuneDetailsArgs,
          context
        );

      default:
        return {
          success: false,
          message: `Unknown tool: ${toolCall.tool}`,
        };
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Tool execution failed",
    };
  }
}

/**
 * Filter tunes by various criteria
 */
async function filterTunes(
  args: FilterTunesArgs,
  context: ToolExecutorContext
): Promise<ToolExecutionResult> {
  const filters: string[] = [];

  // Apply type filter
  if (args.type && context.setSelectedTypes) {
    context.setSelectedTypes([args.type]);
    filters.push(`Type: ${args.type}`);
  }

  // Apply mode filter
  if (args.mode && context.setSelectedModes) {
    context.setSelectedModes([args.mode]);
    filters.push(`Mode: ${args.mode}`);
  }

  // Apply genre filter
  if (args.genre && context.setSelectedGenres) {
    context.setSelectedGenres([args.genre]);
    filters.push(`Genre: ${args.genre}`);
  }

  // Apply status filter (practice state)
  if (args.status && context.setFilterStatus) {
    context.setFilterStatus(args.status);
    filters.push(`Status: ${args.status}`);
  }

  return {
    success: true,
    message:
      filters.length > 0
        ? `Applied filters: ${filters.join(", ")}`
        : "No filters applied",
  };
}

/**
 * Log a practice session
 */
async function logPractice(
  args: LogPracticeArgs,
  context: ToolExecutorContext
): Promise<ToolExecutionResult> {
  const { localDb, userId, currentRepertoireId } = context;

  // Find tune by title
  const tunes = await searchTunes(localDb, {
    query: args.tune_title,
    userId,
  });

  if (!tunes || tunes.length === 0) {
    return {
      success: false,
      message: `Tune "${args.tune_title}" not found in your repertoire`,
    };
  }

  const tune = tunes.find(
    (t) => t.title?.toLowerCase() === args.tune_title.toLowerCase()
  );
  if (!tune) {
    return {
      success: false,
      message: `Tune "${args.tune_title}" not found. Did you mean "${tunes[0]?.title || "unknown"}"?`,
    };
  }

  // Use current repertoire or return error if none available
  if (!currentRepertoireId) {
    return {
      success: false,
      message: "No active repertoire. Please select a repertoire first.",
    };
  }

  // Create practice record
  const recordId = await createPracticeRecord(
    localDb,
    currentRepertoireId,
    tune.id,
    {
      practiced: new Date().toISOString(),
      quality: args.quality ?? 3,
    }
  );

  return {
    success: true,
    message: `Practice session logged for "${tune.title}"${args.quality ? ` (Quality: ${args.quality}/4)` : ""}`,
    data: { recordId },
  };
}

/**
 * Add or update a note for a tune
 */
async function addNote(
  args: AddNoteArgs,
  context: ToolExecutorContext
): Promise<ToolExecutionResult> {
  const { localDb, userId } = context;

  // Find tune by title
  const tunes = await searchTunes(localDb, {
    query: args.tune_title,
    userId,
  });

  if (!tunes || tunes.length === 0) {
    return {
      success: false,
      message: `Tune "${args.tune_title}" not found in your repertoire`,
    };
  }

  const tune = tunes.find(
    (t) => t.title?.toLowerCase() === args.tune_title.toLowerCase()
  );
  if (!tune) {
    return {
      success: false,
      message: `Tune "${args.tune_title}" not found. Did you mean "${tunes[0]?.title || "unknown"}"?`,
    };
  }

  // Check if note already exists
  const existingNotes = await getNotesByTune(localDb, tune.id);

  if (existingNotes && existingNotes.length > 0) {
    // Update first note
    await updateNote(localDb, existingNotes[0].id, {
      noteText: args.note_content,
    });

    return {
      success: true,
      message: `Note updated for "${tune.title}"`,
    };
  }

  // Create new note
  const note = await createNote(localDb, {
    tuneRef: tune.id,
    noteText: args.note_content,
    userRef: userId,
  });

  return {
    success: true,
    message: `Note added to "${tune.title}"`,
    data: { noteId: note.id },
  };
}

/**
 * Get detailed information about a tune
 */
async function getTuneDetails(
  args: GetTuneDetailsArgs,
  context: ToolExecutorContext
): Promise<ToolExecutionResult> {
  const { localDb, userId } = context;

  // Find tune by title
  const tunes = await searchTunes(localDb, {
    query: args.tune_title,
    userId,
  });

  if (!tunes || tunes.length === 0) {
    return {
      success: false,
      message: `Tune "${args.tune_title}" not found in your repertoire`,
    };
  }

  const tune = tunes.find(
    (t) => t.title?.toLowerCase() === args.tune_title.toLowerCase()
  );
  if (!tune) {
    return {
      success: false,
      message: `Tune "${args.tune_title}" not found. Did you mean "${tunes[0]?.title || "unknown"}"?`,
    };
  }

  // Get notes for this tune
  const notes = await getNotesByTune(localDb, tune.id);

  // Format details
  const details = {
    title: tune.title,
    type: tune.type,
    mode: tune.mode,
    structure: tune.structure,
    incipit: tune.incipit,
    composer: tune.composer,
    genre: tune.genre,
    notes: notes?.map((n) => n.noteText),
  };

  return {
    success: true,
    message: `Details for "${tune.title}":
• Type: ${tune.type || "unknown"}
• Mode: ${tune.mode || "unknown"}
${tune.structure ? `• Structure: ${tune.structure}` : ""}
${tune.composer ? `• Composer: ${tune.composer}` : ""}
${notes && notes.length > 0 ? `• Notes: ${notes[0].noteText}` : ""}`,
    data: details,
  };
}
