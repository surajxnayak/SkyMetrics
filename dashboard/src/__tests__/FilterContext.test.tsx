import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterProvider, useFilters } from "../context/FilterContext";

function Probe() {
  const { filters, setFilters } = useFilters();
  return (
    <div>
      <span data-testid="frequency">{filters.frequency}</span>
      <button onClick={() => setFilters((prev) => ({ ...prev, origin: "DEL" }))}>set origin</button>
      <span data-testid="origin">{filters.origin}</span>
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
    expect(screen.getByTestId("origin").textContent).toBe("");
  });

  it("lets a consumer update filters", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <FilterProvider>
        <Probe />
      </FilterProvider>
    );

    await userEvent.click(screen.getByText("set origin"));

    expect(screen.getByTestId("origin").textContent).toBe("DEL");
  });

  it("correctly applies two updates fired in the same event handler", async () => {
    function DoubleUpdateProbe() {
      const { filters, setFilters } = useFilters();
      return (
        <div>
          <button
            onClick={() => {
              setFilters((prev) => ({ ...prev, origin: "DEL" }));
              setFilters((prev) => ({ ...prev, destination: "BOM" }));
            }}
          >
            update both
          </button>
          <span data-testid="origin">{filters.origin}</span>
          <span data-testid="destination">{filters.destination}</span>
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

    expect(screen.getByTestId("origin").textContent).toBe("DEL");
    expect(screen.getByTestId("destination").textContent).toBe("BOM");
  });
});
