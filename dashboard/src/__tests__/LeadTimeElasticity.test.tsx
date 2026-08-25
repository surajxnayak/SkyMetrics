import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilterProvider } from "../context/FilterContext";
import LeadTimeElasticity, { aggregate } from "../components/LeadTimeElasticity";

// vi.mock's factory is hoisted above this file's body, so RECORDS must be
// defined via vi.hoisted() to be visible inside it (see Vitest docs).
const RECORDS = vi.hoisted(() => [
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    advance_window: "T+1",
    fare_class: "U1",
    total_fare: 9000,
    status: "available",
    is_outlier: false,
    collected_at: "2026-08-24T10:00:00+00:00",
  },
  {
    origin: "DEL",
    destination: "BOM",
    carrier: "QP",
    advance_window: "T+45",
    fare_class: "U1",
    total_fare: 5000,
    status: "available",
    is_outlier: false,
    collected_at: "2026-08-24T10:00:00+00:00",
  },
]);

vi.mock("../api/client", () => ({
  getFares: vi.fn().mockResolvedValue(RECORDS),
}));

const NO_DRILLDOWN = { carrier: "", fareClass: "" };

describe("aggregate", () => {
  it("orders points from farthest to nearest advance window", () => {
    const points = aggregate(RECORDS, NO_DRILLDOWN);

    expect(points.map((p) => p.advance_window)).toEqual(["T+45", "T+1"]);
    expect(points[0].meanFare).toBe(5000);
    expect(points[1].meanFare).toBe(9000);
  });

  it("excludes records that don't match the given carrier or fare class", () => {
    const points = aggregate(RECORDS, { carrier: "6E", fareClass: "" });

    expect(points).toHaveLength(0);
  });
});

describe("LeadTimeElasticity", () => {
  it("renders an export button once data loads", async () => {
    render(
      <FilterProvider>
        <LeadTimeElasticity />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());
  });

  it("plots a real curve for the mean fare line", async () => {
    const { container } = render(
      <FilterProvider>
        <LeadTimeElasticity />
      </FilterProvider>
    );

    await waitFor(() => expect(screen.getByText("Export CSV")).toBeInTheDocument());

    const curve = container.querySelector(".recharts-line-curve");
    expect(curve).not.toBeNull();
    expect(curve?.getAttribute("d")).toBeTruthy();
  });
});
