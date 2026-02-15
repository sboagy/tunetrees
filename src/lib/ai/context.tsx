/**
 * AI Chat Context
 *
 * SolidJS context for managing AI chat state
 */

import {
  type Accessor,
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";
import { supabase } from "../supabase/client";
import type { AIResponse, ChatState, Message } from "./types";

interface ChatContextValue {
  state: Accessor<ChatState>;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
}

const ChatContext = createContext<ChatContextValue>();

export const ChatProvider: ParentComponent = (props) => {
  const [state, setState] = createSignal<ChatState>({
    messages: [],
    isLoading: false,
    error: null,
  });

  const addMessage = (message: Message) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  const sendMessage = async (message: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    addMessage(userMessage);

    // Set loading state
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get auth session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Validate session against current Supabase project.
      // This catches stale sessions after switching between local/remote envs.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        await supabase.auth.signOut();
        throw new Error(
          "Unauthorized. Your session is invalid for this Supabase environment. Please sign in again."
        );
      }

      // Get function URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/ai-chat`;

      // Build history (last 10 messages for context)
      const history = state()
        .messages.slice(-10)
        .map((msg) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        }));

      // Call Edge Function
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          history,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await supabase.auth.signOut();
          throw new Error(
            "Unauthorized. Please sign in again (local and remote Supabase sessions can get mismatched)."
          );
        }

        const responseText = await response.text();
        let errorMessage = `Failed to get AI response (${response.status})`;

        if (responseText) {
          try {
            const errorData = JSON.parse(responseText) as {
              error?: string;
              message?: string;
              details?: string;
            };
            if (errorData.error && errorData.details) {
              errorMessage = `${errorData.error}: ${errorData.details}`;
            } else {
              errorMessage =
                errorData.error ||
                errorData.message ||
                `${errorMessage}: ${responseText}`;
            }
          } catch {
            errorMessage = `${errorMessage}: ${responseText}`;
          }
        }

        throw new Error(errorMessage);
      }

      const aiResponse: AIResponse = await response.json();

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse.content || "",
        timestamp: new Date(),
        toolCall:
          aiResponse.type === "tool_call"
            ? {
                tool: aiResponse.tool!,
                args: aiResponse.args!,
              }
            : undefined,
      };
      addMessage(assistantMessage);
    } catch (error) {
      console.error("AI chat error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const clearMessages = () => {
    setState({
      messages: [],
      isLoading: false,
      error: null,
    });
  };

  const value: ChatContextValue = {
    state,
    sendMessage,
    clearMessages,
    addMessage,
  };

  return (
    <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
