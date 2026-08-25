import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import TrendView from "../components/TrendView";

vi.mock("../api/client", () => ({
  getIndex: vi.fn().mockResolvedValue({
    comparison_id: "abc123",
    frequency: "daily",
    series: [
      { period: "2026-08-24", base_period: "2026-08-24", routes: ["DEL-BOM"], simple_relative: 100.0 },
      {
        period: "2026-08-25",
        base_period: "2026-08-24",
        routes: ["DEL-BOM"],
        simple_relative: 106.7,
        laspeyres: 106.9,
        paasche: 106.7,
        fisher: 106.8,
      },
    ],
  }),
}));

describe("TrendView", () => {
  it("shows the base period once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    expect(screen.getByText("Loading trend data...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Base period: 2026-08-24/)).toBeInTheDocument());
  });

  it("renders an export button once data loads", async () => {
    render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });

  it("plots a line for each index series key", async () => {
    const { container } = render(
      <FilterProvider>
        <TrendView />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());

    // Recharts' Line uses its dataKey as the legend label when no `name` is
    // given, so a mistyped dataKey (e.g. laspeyres -> laspeyeres) shows up
    // here as a wrong label rather than passing silently.
    for (const key of ["simple_relative", "laspeyres", "paasche", "fisher"]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(4);
  });
});
