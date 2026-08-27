import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterProvider, useFilters } from "../context/FilterContext";
import Sidebar from "../components/Sidebar";

function TrendRouteProbe() {
  const { filters } = useFilters();
  return <span data-testid="trend-route-value">{filters.trendRoute}</span>;
}

function FrequencyProbe() {
  const { filters } = useFilters();
  return <span data-testid="frequency-value">{filters.frequency}</span>;
}

describe("Sidebar", () => {
  it("updates the shared filter state when the trend route select changes", async () => {
    render(
      <FilterProvider>
        <Sidebar />
        <TrendRouteProbe />
      </FilterProvider>
    );

    await userEvent.selectOptions(screen.getByLabelText("Trend route"), "DEL-BLR");

    expect(screen.getByTestId("trend-route-value").textContent).toBe("DEL-BLR");
  });

  it("updates the shared filter state when the frequency select changes", async () => {
    render(
      <FilterProvider>
        <Sidebar />
        <FrequencyProbe />
      </FilterProvider>
    );

    await userEvent.selectOptions(screen.getByLabelText("Frequency"), "weekly");

    expect(screen.getByTestId("frequency-value").textContent).toBe("weekly");
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

  it("shows full names alongside route codes", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    expect(screen.getAllByText("Delhi (DEL) - Mumbai (BOM)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delhi (DEL) - Bengaluru (BLR)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mumbai (BOM) - Bengaluru (BLR)").length).toBeGreaterThan(0);
  });

  it("renders source filters as checkboxes", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    expect(screen.getByRole("checkbox", { name: "Akasa Air" })).toBeChecked();
  });

  it("shows carrier names alongside carrier codes", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    expect(screen.getByText("Akasa Air (QP)")).toBeInTheDocument();
  });
});
