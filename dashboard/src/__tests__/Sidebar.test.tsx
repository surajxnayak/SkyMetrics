import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterProvider, useFilters } from "../context/FilterContext";
import Sidebar from "../components/Sidebar";

function OriginProbe() {
  const { filters } = useFilters();
  return <span data-testid="origin-value">{filters.origin}</span>;
}

describe("Sidebar", () => {
  it("updates the shared filter state when the origin input changes", async () => {
    render(
      <FilterProvider>
        <Sidebar />
        <OriginProbe />
      </FilterProvider>
    );

    await userEvent.type(screen.getByLabelText("Origin"), "DEL");

    expect(screen.getByTestId("origin-value").textContent).toBe("DEL");
  });

  it("offers the five fixed advance-window options", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    const select = screen.getByLabelText("Advance window") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["", "T+1", "T+7", "T+15", "T+30", "T+45"]);
  });
});
