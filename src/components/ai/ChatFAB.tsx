/**
 * AI Chat FAB (Floating Action Button)
 *
 * A floating button that opens the AI chat drawer.
 * Positioned in the bottom-right corner of the screen.
 *
 * @module components/ai/ChatFAB
 */

import { Sparkles } from "lucide-solid";
import type { Component } from "solid-js";

export interface ChatFABProps {
  /** Callback when button is clicked */
  onClick: () => void;
}

export const ChatFAB: Component<ChatFABProps> = (props) => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
      aria-label="Open AI Practice Assistant"
    >
      <Sparkles size={20} />
      <span class="font-medium hidden sm:inline">AI Assistant</span>
    </button>
  );
};
