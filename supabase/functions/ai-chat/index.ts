/**
 * AI Chat Edge Function
 *
 * Secure proxy for Google Gemini API that:
 * 1. Validates user authentication
 * 2. Fetches user's repertoire metadata from Supabase
 * 3. Injects system prompt + context + tool definitions
 * 4. Calls Gemini API
 * 5. Returns streaming response with text or tool calls
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// Tool definitions for Gemini Function Calling
const TOOLS = [
  {
    name: "filter_tunes",
    description:
      "Filter the user's tune list by genre, key, mode, type, or practice status. Use this when the user wants to see a specific subset of their repertoire.",
    parameters: {
      type: "object",
      properties: {
        genre: {
          type: "string",
          description: "Filter by genre (e.g., 'Irish', 'Scottish', 'Klezmer')",
        },
        key: {
          type: "string",
          description: "Filter by musical key (e.g., 'D', 'G', 'A')",
        },
        mode: {
          type: "string",
          description: "Filter by mode (e.g., 'Major', 'Minor', 'Dorian')",
        },
        type: {
          type: "string",
          description:
            "Filter by tune type (e.g., 'Reel', 'Jig', 'Hornpipe', 'Polka')",
        },
        status: {
          type: "string",
          description:
            "Filter by practice status. Options: 'new' (never practiced), 'learning' (actively learning), 'review' (maintaining), 'relearning' (forgotten, needs refresh)",
          enum: ["new", "learning", "review", "relearning"],
        },
      },
    },
  },
  {
    name: "log_practice",
    description:
      "Log a practice session for a specific tune. Use when the user mentions they practiced a tune or wants to mark it as practiced.",
    parameters: {
      type: "object",
      properties: {
        tune_title: {
          type: "string",
          description: "The title of the tune that was practiced",
        },
        quality: {
          type: "integer",
          description:
            "Practice quality rating from 1-4. 1=Hard (many mistakes), 2=Good (some mistakes), 3=Easy (few mistakes), 4=Perfect (no mistakes)",
          minimum: 1,
          maximum: 4,
        },
      },
      required: ["tune_title"],
    },
  },
  {
    name: "add_note",
    description:
      "Add or update a note for a specific tune. Use when the user wants to remember something about a tune.",
    parameters: {
      type: "object",
      properties: {
        tune_title: {
          type: "string",
          description: "The title of the tune to add a note to",
        },
        note_content: {
          type: "string",
          description: "The content of the note",
        },
      },
      required: ["tune_title", "note_content"],
    },
  },
  {
    name: "get_tune_details",
    description:
      "Get full details for a specific tune, including ABC notation, structure, and metadata. Use when the user asks specific questions about a tune.",
    parameters: {
      type: "object",
      properties: {
        tune_title: {
          type: "string",
          description: "The title of the tune to get details for",
        },
      },
      required: ["tune_title"],
    },
  },
];

// System prompt for the AI
const SYSTEM_PROMPT = `You are a helpful practice assistant for TuneTrees, a music practice tracking app.

Your role:
- Help users manage and practice their musical repertoire
- Answer questions about their tunes
- Suggest practice strategies and tune combinations
- Execute actions like filtering lists or logging practice

Guidelines:
- Be concise and friendly
- When suggesting sets, consider tune type, key, and mode compatibility
- Encourage consistent practice and spaced repetition
- Use tool calls to perform actions when appropriate
- If you need to filter or search, use the filter_tunes tool
- If the user practiced something, use log_practice to record it

The user's current repertoire is provided in the context below.`;

interface RequestBody {
  message: string;
  history?: Array<{ role: string; content: string }>;
}

Deno.serve(async (req) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // Get JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { message, history = [] } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch user's repertoire metadata (minimal for context)
    const { data: tunes, error: tunesError } = await supabase
      .from("tune")
      .select(
        `
        id,
        title,
        type,
        mode,
        genre,
        tune_override!left(key_override)
      `
      )
      .or(`private_for.eq.${user.id},private_for.is.null`)
      .order("title");

    if (tunesError) {
      console.error("Error fetching tunes:", tunesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch repertoire" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch practice records to determine status
    const { data: practiceRecords } = await supabase
      .from("practice_record")
      .select("tune_ref, state")
      .eq("user_ref", user.id)
      .order("practiced", { ascending: false });

    // Build status map (latest state per tune)
    const statusMap = new Map<string, number>();
    if (practiceRecords) {
      for (const record of practiceRecords) {
        if (!statusMap.has(record.tune_ref)) {
          statusMap.set(record.tune_ref, record.state);
        }
      }
    }

    // Format repertoire context
    const repertoireContext = tunes
      ?.map((tune) => {
        const state = statusMap.get(tune.id);
        const statusLabel =
          state === 0
            ? "new"
            : state === 1
              ? "learning"
              : state === 2
                ? "review"
                : state === 3
                  ? "relearning"
                  : "new";

        return `- ${tune.title} (${tune.type || "unknown type"}, ${tune.mode || "unknown mode"}, Genre: ${tune.genre || "unknown"}, Status: ${statusLabel})`;
      })
      .join("\n");

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build messages for Gemini
    const messages = [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\n## Current Repertoire:\n${repertoireContext || "No tunes in repertoire yet."}`,
          },
        ],
      },
      ...history.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages,
          tools: [{ functionDeclarations: TOOLS }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract response
    const candidate = geminiData.candidates?.[0];
    if (!candidate) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check for function calls
    const functionCall = candidate.content?.parts?.find(
      (part: any) => part.functionCall
    );

    if (functionCall) {
      // Return tool call for client to execute
      return new Response(
        JSON.stringify({
          type: "tool_call",
          tool: functionCall.functionCall.name,
          args: functionCall.functionCall.args,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Return text response
    const textPart = candidate.content?.parts?.find((part: any) => part.text);
    const text = textPart?.text || "I'm not sure how to respond to that.";

    return new Response(
      JSON.stringify({
        type: "text",
        content: text,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
