import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterProvider, useFilters } from "../context/FilterContext";
import Sidebar from "../components/Sidebar";

function RoutesProbe() {
  const { filters } = useFilters();
  return <span data-testid="routes-value">{filters.selectedRoutes.join(",")}</span>;
}

function FrequencyProbe() {
  const { filters } = useFilters();
  return <span data-testid="frequency-value">{filters.frequency}</span>;
}

describe("Sidebar", () => {
  it("updates the shared filter state when a route checkbox changes", async () => {
    render(
      <FilterProvider>
        <Sidebar />
        <RoutesProbe />
      </FilterProvider>
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Delhi (DEL) - Bengaluru (BLR)" }));

    expect(screen.getByTestId("routes-value").textContent).toBe("DEL-BOM,BOM-BLR");
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

    expect(screen.getByRole("checkbox", { name: "Akasa Air (live)" })).toBeChecked();
  });

  it("shows carrier names alongside carrier codes, for every real carrier", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    expect(screen.getByText("Akasa Air (QP)")).toBeInTheDocument();
    expect(screen.getByText("IndiGo (6E)")).toBeInTheDocument();
    expect(screen.getByText("Air India (AI)")).toBeInTheDocument();
    expect(screen.getByText("Vistara (UK)")).toBeInTheDocument();
    expect(screen.getByText("SpiceJet (SG)")).toBeInTheDocument();
    expect(screen.getByText("Go First (G8)")).toBeInTheDocument();
    expect(screen.getByText("AirAsia India (I5)")).toBeInTheDocument();
  });

  it("offers fare class as a dropdown of real values, not free text", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    const select = screen.getByLabelText("Fare class") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toContain("business");
    expect(values).toContain("economy");
    expect(values).toContain("U1");
  });

  it("offers all three real historical/live sources as checkboxes", () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    expect(screen.getByRole("checkbox", { name: "Akasa Air (live)" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Historical public airfare (2022)" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Goibibo historical (2023)" })).toBeInTheDocument();
  });

  it("shows custom date pickers only for the custom time range", async () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    expect(screen.queryByLabelText("Start")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Time range"), "custom");

    expect(screen.getByLabelText("Start")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("End")).toHaveAttribute("type", "date");
  });

  it("shows search feedback after applying changed filters", async () => {
    render(
      <FilterProvider>
        <Sidebar />
      </FilterProvider>
    );

    await userEvent.selectOptions(screen.getByLabelText("Frequency"), "weekly");
    expect(screen.getByText("Filters changed. Search to refresh.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Search changes" }));

    expect(screen.getAllByText("Search sent").length).toBeGreaterThan(0);
  });
});
