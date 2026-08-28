import { useState } from "react";
import { askQuestion } from "../api/client";
import type { ChatTurn, ToolCall } from "../api/types";

export interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCall[];
}

export function useAsk() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    setError(null);

    try {
      const response = await askQuestion(trimmed, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: response.answer, toolCalls: response.tool_calls },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, error, send };
}
