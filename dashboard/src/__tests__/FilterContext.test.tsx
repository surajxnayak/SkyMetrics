import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterProvider, useFilters } from "../context/FilterContext";

function Probe() {
  const { filters, setFilters } = useFilters();
  return (
    <div>
      <span data-testid="frequency">{filters.frequency}</span>
      <button onClick={() => setFilters((prev) => ({ ...prev, trendRoute: "DEL-BLR" }))}>set route</button>
      <span data-testid="trend-route">{filters.trendRoute}</span>
    </div>
  );
}

describe("FilterContext", () => {
  it("provides sensible defaults", () => {
    render(
      <FilterProvider>
        <Probe />
      </FilterProvider>
    );

    expect(screen.getByTestId("frequency").textContent).toBe("daily");
    expect(screen.getByTestId("trend-route").textContent).toBe("DEL-BOM");
  });

  it("lets a consumer update filters", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <FilterProvider>
        <Probe />
      </FilterProvider>
    );

    await userEvent.click(screen.getByText("set route"));

    expect(screen.getByTestId("trend-route").textContent).toBe("DEL-BLR");
  });

  it("correctly applies two updates fired in the same event handler", async () => {
    function DoubleUpdateProbe() {
      const { filters, setFilters } = useFilters();
      return (
        <div>
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, trendRoute: "DEL-BLR" }));
              setFilters((prev) => ({ ...prev, selectedRoutes: ["DEL-BOM"] }));
            }}
          >
            update both
          </button>
          <span data-testid="trend-route">{filters.trendRoute}</span>
          <span data-testid="selected-routes">{filters.selectedRoutes.join(",")}</span>
        </div>
      );
    }
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <FilterProvider>
        <DoubleUpdateProbe />
      </FilterProvider>
    );

    await userEvent.click(screen.getByText("update both"));

    expect(screen.getByTestId("trend-route").textContent).toBe("DEL-BLR");
    expect(screen.getByTestId("selected-routes").textContent).toBe("DEL-BOM");
  });
});
