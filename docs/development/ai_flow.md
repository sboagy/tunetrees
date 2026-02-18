# AI Assistant Flow

- Tool definitions exposed to the model are in index.ts (`TOOLS` with `filter_tunes`, `log_practice`, `add_note`, `get_tune_details`).
- The model is told to use those tools and receives them in the Gemini request in index.ts.
- Tool calls returned by the model are parsed and sent back as `type: "tool_call"` in index.ts.
- Actual tool behavior (“what happens in app”) is implemented in tool-executor.ts and handlers below: tool-executor.ts, tool-executor.ts, tool-executor.ts, tool-executor.ts.
- The chat drawer that executes returned tool calls is in AIChatDrawer.tsx.
- Shared tool-call types are in types.ts.

```mermaid
flowchart TD
    A[User clicks Ask Assistant icon in TopNav] --> B[TopNav dispatches tt-open-ai-assistant event]

    B --> C1[Practice route listener]
    B --> C2[Analysis route listener]
    B --> C3[Catalog/Repertoire route listener]

    C1 --> D[AIChatDrawer opens]
    C2 --> D
    C3 --> D

    D --> E[User sends prompt]
    E --> F[ChatContext sendMessage]

    F --> G[Supabase Edge Function: ai-chat]
    G --> H[Build system prompt + user context]
    H --> I[Gemini generateContent with TOOLS]

    I --> J{Gemini response type}
    J -->|text| K[Return plain assistant text]
    J -->|tool_call| L[Return tool name + args]

    K --> M[Chat UI renders assistant response]

    L --> N[AIChatDrawer detects toolCall]
    N --> O[executeToolCall]

    O --> P{Tool selected}
    P -->|filter_tunes| Q[Apply route filters via setters]
    P -->|log_practice| R[Create practice record in local DB]
    P -->|add_note| S[Create/update note in local DB]
    P -->|get_tune_details| T[Query tune + notes from local DB]

    Q --> U[Toast + system message]
    R --> U
    S --> U
    T --> U

    U --> V[Updated UI state/data visible to user]
```

## Key implementation files

- TopNav event dispatch: `src/components/layout/TopNav.tsx`
- Drawer + tool-call trigger: `src/components/ai/AIChatDrawer.tsx`
- Chat API call + response shaping: `src/lib/ai/context.tsx`
- Tool execution handlers: `src/lib/ai/tool-executor.ts`
- Tool schema + model invocation: `supabase/functions/ai-chat/index.ts`

## Sequence view

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant TN as TopNav
    participant RT as Active Route (Practice/Analysis/Catalog/Repertoire)
    participant DR as AIChatDrawer
    participant CX as ChatContext
    participant EF as Edge Function (ai-chat)
    participant GM as Gemini API
    participant EX as Tool Executor
    participant DB as Local SQLite

    U->>TN: Click Ask Assistant icon
    TN->>RT: dispatch "tt-open-ai-assistant"
    RT->>DR: setIsChatOpen(true)

    U->>DR: Send prompt
    DR->>CX: sendMessage(prompt)
    CX->>EF: POST /functions/v1/ai-chat (message + history)
    EF->>GM: generateContent(system prompt + context + TOOLS)
    GM-->>EF: text OR functionCall

    alt Text response
        EF-->>CX: { type: "text", content }
        CX-->>DR: assistant message
        DR-->>U: Render assistant text
    else Tool call response
        EF-->>CX: { type: "tool_call", tool, args }
        CX-->>DR: assistant message with toolCall
        DR->>EX: executeToolCall(tool, args, context)
        alt filter_tunes
            EX-->>RT: apply setters (types/modes/genres/status)
        else log_practice / add_note / get_tune_details
            EX->>DB: query/mutate local data
            DB-->>EX: result
        end
        EX-->>DR: success/failure message
        DR-->>U: toast + system message + updated UI
    end
```

## Legend

- `U`: User
- `TN`: TopNav UI control that dispatches `tt-open-ai-assistant`
- `RT`: Active route component (Practice, Analysis, Catalog, Repertoire)
- `DR`: `AIChatDrawer` UI component
- `CX`: Chat context (`sendMessage`, message state)
- `EF`: Supabase Edge Function (`ai-chat`)
- `GM`: Gemini model API (returns text or function call)
- `EX`: Client-side tool executor (`executeToolCall`)
- `DB`: Local SQLite via Drizzle/sql.js
- `text` response: assistant message only (no local side effects)
- `tool_call` response: executes local app action (filters, practice log, notes, details)
