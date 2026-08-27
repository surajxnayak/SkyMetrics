import { useState } from "react";
import { useAsk } from "../hooks/useAsk";

export default function AskApix() {
  const { messages, loading, error, send } = useAsk();
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    send(input);
    setInput("");
  }

  return (
    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
      <h2 className="mb-1 text-base font-semibold text-primary">Ask APIx</h2>
      <p className="mb-4 text-sm text-on-surface-variant">
        Ask a question about real fare data or the index -- every answer is grounded in a real
        API call, shown below it.
      </p>

      <div className="mb-4 flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-secondary">
            Try: &quot;How did DEL-BOM fares move over the last month?&quot;
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={message.role === "user" ? "self-end text-right" : "self-start text-left"}
          >
            <div
              className={
                message.role === "user"
                  ? "inline-block rounded-md bg-accent-muted px-3 py-2 text-sm text-primary"
                  : "inline-block rounded-md bg-panel px-3 py-2 text-sm text-primary"
              }
            >
              {message.text}
            </div>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <details className="mt-1 text-xs text-on-surface-variant">
                <summary className="cursor-pointer">Data used</summary>
                <pre className="mt-1 overflow-x-auto rounded-sm bg-inset p-2 font-mono text-[11px]">
                  {JSON.stringify(message.toolCalls, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
        {loading && <p className="text-sm text-secondary">Thinking...</p>}
        {error && (
          <p role="alert" className="text-sm text-error">
            Failed to get an answer: {error}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about real fare data..."
          aria-label="Question"
          className="flex-1 rounded-md border border-outline-variant bg-inset px-3 py-1.5 text-sm text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-page hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent/40 disabled:text-secondary"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
