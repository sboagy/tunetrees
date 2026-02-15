# AI Practice Assistant

A conversational AI assistant powered by Google Gemini that helps users manage their musical repertoire through natural language.

## Features

- **Natural Language Queries**: Ask questions about your tunes in plain English
- **Smart Filtering**: "Show me my reels in D major" - AI applies filters automatically
- **Practice Logging**: "Log practice for Morrison's Jig" - AI records practice sessions
- **Note Taking**: "Add a note to The Kesh: remember to use double stops"
- **Tune Details**: "What key is The Kesh in?" - AI retrieves tune information
- **Set Suggestions**: "Suggest a set starting with a jig" - AI recommends compatible tunes

## Architecture

### Backend (Supabase Edge Function)
- **Location**: `supabase/functions/ai-chat/index.ts`
- **Role**: Secure proxy and context manager
- **Flow**:
  1. Validates user authentication via JWT
  2. Fetches user's repertoire metadata from Supabase
  3. Injects system prompt + context + tool definitions
  4. Calls Google Gemini API (Flash 1.5 model)
  5. Returns text response OR tool call JSON

### Frontend (SolidJS)
- **Context**: `src/lib/ai/context.tsx` - Chat state management
- **Types**: `src/lib/ai/types.ts` - TypeScript interfaces
- **Tool Executor**: `src/lib/ai/tool-executor.ts` - Executes AI commands
- **UI Components**:
  - `ChatFAB.tsx` - Floating action button
  - `AIChatDrawer.tsx` - Slide-out chat panel

## Setup

### 1. Gemini API Key

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to Supabase secrets:

```bash
supabase secrets set GEMINI_API_KEY=your_api_key_here
```

### 2. Deploy Edge Function

```bash
supabase functions deploy ai-chat
```

### 3. Environment Variables

The frontend automatically uses your existing Supabase configuration:
- `VITE_SUPABASE_URL` (already configured)
- `VITE_SUPABASE_ANON_KEY` (already configured)

No additional frontend env vars needed!

## Usage

### Opening the Chat

Look for the **AI Assistant** button in the bottom-right corner on:
- Catalog page
- Repertoire page

Click to open the chat drawer.

### Example Queries

**Filtering**:
- "Show me my reels"
- "Find all tunes in D major"
- "Show neglected tunes"

**Information**:
- "What key is The Kesh in?"
- "Tell me about Morrison's Jig"
- "What type is The Butterfly?"

**Practice**:
- "Log practice for The Kesh"
- "Mark The Butterfly as practiced with quality 4"

**Notes**:
- "Add note to The Kesh: play with ornamentation"
- "Remember to practice Morrison's slowly"

**Suggestions**:
- "Suggest a set starting with a jig"
- "What reels go well in D major?"

## Tool Definitions

The AI can execute these tools on your behalf:

### `filter_tunes`
Filters the tune list by:
- `genre` (Irish, Scottish, etc.)
- `type` (Reel, Jig, Hornpipe, etc.)
- `mode` (Major, Minor, Dorian, etc.)
- `status` (new, learning, review, relearning)

### `log_practice`
Logs a practice session:
- `tune_title` (required)
- `quality` (1-4, optional)

### `add_note`
Adds/updates a note:
- `tune_title` (required)
- `note_content` (required)

### `get_tune_details`
Retrieves full tune information:
- `tune_title` (required)

## Security

- **Stateless**: Chat logs are ephemeral (not stored in DB)
- **Data Minimization**: Only sends tune metadata (title, type, mode), not full ABC notation
- **Authentication**: All requests validated via JWT
- **API Key Protection**: Gemini API key stored in Supabase Secrets (never exposed to client)

## Troubleshooting

### "Gemini API key not configured"
Run: `supabase secrets set GEMINI_API_KEY=your_key`

### "Failed to get AI response"
Check Edge Function logs:
```bash
supabase functions logs ai-chat
```

### Chat drawer not appearing
1. Ensure you're on the Catalog or Repertoire page
2. Look for the blue/purple gradient FAB in bottom-right
3. Check browser console for errors

## Development

### Local Testing

1. Start Supabase locally:
```bash
supabase start
```

2. Set local secret:
```bash
supabase secrets set GEMINI_API_KEY=your_key --env-file .env.local
```

3. Serve Edge Function:
```bash
supabase functions serve ai-chat
```

4. Start dev server:
```bash
npm run dev
```

### Adding New Tools

1. Define tool schema in `supabase/functions/ai-chat/index.ts` (`TOOLS` array)
2. Add TypeScript types in `src/lib/ai/types.ts`
3. Implement handler in `src/lib/ai/tool-executor.ts`
4. Update this README

## Future Enhancements

- [ ] Streaming responses for better UX
- [ ] Multi-turn conversations with memory
- [ ] Voice input support
- [ ] Playlist management tools
- [ ] Advanced set suggestions based on FSRS data
- [ ] Export conversation history
