/**
 * AI Chat Drawer Component
 *
 * Slide-out drawer for conversational AI assistant.
 * Allows users to query their repertoire and control the app via natural language.
 *
 * @module components/ai/AIChatDrawer
 */

import { Loader2, MessageCircle, Music, Send, X } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal, For, Show } from "solid-js";
import { toast } from "solid-sonner";
import { useChat } from "../../lib/ai/context";
import { executeToolCall } from "../../lib/ai/tool-executor";
import { useAuth } from "../../lib/auth/AuthContext";

export interface AIChatDrawerProps {
  /** Whether drawer is open */
  isOpen: boolean;
  /** Callback when user closes drawer */
  onClose: () => void;
  /** Optional filter setters for tool execution */
  setSelectedTypes?: (types: string[]) => void;
  setSelectedModes?: (modes: string[]) => void;
  setSelectedGenres?: (genres: string[]) => void;
  currentRepertoireId?: string;
}

export const AIChatDrawer: Component<AIChatDrawerProps> = (props) => {
  const { state, sendMessage, clearMessages, addMessage } = useChat();
  const { localDb, user } = useAuth();
  const [input, setInput] = createSignal("");
  const [messagesEndRef, setMessagesEndRef] = createSignal<HTMLDivElement>();
  const [processedToolMessageIds, setProcessedToolMessageIds] = createSignal<
    Set<string>
  >(new Set());

  let inputRef: HTMLTextAreaElement | undefined;

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    const messages = state().messages;
    if (messages.length > 0) {
      messagesEndRef()?.scrollIntoView({ behavior: "smooth" });
    }
  });

  // Focus input when drawer opens
  createEffect(() => {
    if (props.isOpen) {
      setTimeout(() => inputRef?.focus(), 100);
    }
  });

  // Handle tool calls
  createEffect(() => {
    const messages = state().messages;
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage?.toolCall &&
      lastMessage.role === "assistant" &&
      !processedToolMessageIds().has(lastMessage.id)
    ) {
      setProcessedToolMessageIds((prev) => {
        const next = new Set(prev);
        next.add(lastMessage.id);
        return next;
      });

      executeToolCall(lastMessage.toolCall, {
        localDb: localDb()!,
        userId: user()?.id || "",
        currentRepertoireId: props.currentRepertoireId,
        setSelectedTypes: props.setSelectedTypes,
        setSelectedModes: props.setSelectedModes,
        setSelectedGenres: props.setSelectedGenres,
      })
        .then((result) => {
          if (result.success) {
            toast.success(result.message);

            // Add system message to chat
            addMessage({
              id: crypto.randomUUID(),
              role: "system",
              content: result.message,
              timestamp: new Date(),
            });
          } else {
            toast.error(result.message);
          }
        })
        .catch((error) => {
          console.error("Tool execution failed:", error);
          toast.error("Failed to execute action");
        });
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const message = input().trim();
    if (!message || state().isLoading) return;

    setInput("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };

  const handleClearConversation = () => {
    clearMessages();
    setProcessedToolMessageIds(new Set<string>());
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <button
        type="button"
        class="fixed inset-0 bg-black/30 z-40"
        onClick={props.onClose}
        aria-label="Close chat"
      />

      {/* Drawer */}
      <div
        class="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <MessageCircle class="text-blue-500" size={24} />
            <h2
              id="chat-title"
              class="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Practice Assistant
            </h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <Show when={state().messages.length === 0}>
            <div class="text-center text-gray-500 dark:text-gray-400 mt-8">
              <Music class="mx-auto mb-2" size={32} />
              <p class="text-sm">
                Ask me about your tunes, filter your list, or log practice
                sessions.
              </p>
              <div class="mt-4 space-y-2 text-xs text-left max-w-xs mx-auto">
                <p class="text-gray-400">Try asking:</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>"Show me my reels in D major"</li>
                  <li>"What key is The Kesh in?"</li>
                  <li>"Log practice for Morrison's Jig"</li>
                  <li>"Suggest a set starting with a jig"</li>
                </ul>
              </div>
            </div>
          </Show>

          <For each={state().messages}>
            {(message) => (
              <div
                class={
                  message.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  class={
                    message.role === "user"
                      ? "bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[80%]"
                      : message.role === "system"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg px-4 py-2 max-w-[80%] text-sm"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 max-w-[80%]"
                  }
                >
                  <p class="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <Show when={message.toolCall}>
                    <p class="text-xs mt-1 opacity-70">
                      🛠️ Executing: {message.toolCall?.tool}
                    </p>
                  </Show>
                </div>
              </div>
            )}
          </For>

          <Show when={state().isLoading}>
            <div class="flex justify-start">
              <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                <Loader2 class="animate-spin text-gray-500" size={16} />
              </div>
            </div>
          </Show>

          <Show when={state().error}>
            <div class="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg px-4 py-2 text-sm">
              Error: {state().error}
            </div>
          </Show>

          {/* Scroll anchor */}
          <div ref={setMessagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          class="p-4 border-t border-gray-200 dark:border-gray-700"
        >
          <div class="flex gap-2">
            <textarea
              ref={inputRef}
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your tunes..."
              class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              disabled={state().isLoading}
            />
            <button
              type="submit"
              disabled={!input().trim() || state().isLoading}
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </div>

          <Show when={state().messages.length > 0}>
            <button
              type="button"
              onClick={handleClearConversation}
              class="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear conversation
            </button>
          </Show>
        </form>
      </div>
    </Show>
  );
};
