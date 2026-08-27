import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AskApix from "../components/AskApix";

vi.mock("../api/client", () => ({
  askQuestion: vi.fn().mockResolvedValue({
    answer: "DEL-BOM's mean fare over the last month is Rs 8,000.",
    tool_calls: [
      {
        name: "get_fare_records",
        args: { route: ["DEL-BOM"] },
        result: { mean_total_fare: 8000 },
      },
    ],
  }),
}));

describe("AskApix", () => {
  it("shows the placeholder prompt when there are no messages yet", () => {
    render(<AskApix />);

    expect(screen.getByText(/Try: /)).toBeInTheDocument();
  });

  it("sends a question and renders the grounded answer with its data-used disclosure", async () => {
    render(<AskApix />);

    await userEvent.type(
      screen.getByPlaceholderText("Ask a question about real fare data..."),
      "How did DEL-BOM fares move?"
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(screen.getByText("How did DEL-BOM fares move?")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("DEL-BOM's mean fare over the last month is Rs 8,000.")).toBeInTheDocument()
    );
    expect(screen.getByText("Data used")).toBeInTheDocument();
  });

  it("clears the input after sending", async () => {
    render(<AskApix />);
    const input = screen.getByPlaceholderText(
      "Ask a question about real fare data..."
    ) as HTMLInputElement;

    await userEvent.type(input, "A question");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(input.value).toBe("");
  });
});
