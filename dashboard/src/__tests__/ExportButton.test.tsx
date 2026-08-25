import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportButton, { toCsv } from "../components/ExportButton";

describe("ExportButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is disabled when there is no data", () => {
    render(<ExportButton data={[]} filename="empty.csv" />);
    expect(screen.getByText("Export CSV")).toBeDisabled();
  });

  it("builds a CSV blob and triggers a download when clicked", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportButton data={[{ a: 1, b: 2 }]} filename="test.csv" />);
    await userEvent.click(screen.getByText("Export CSV"));

    expect(createObjectURL).toHaveBeenCalled();
    const [blob] = createObjectURL.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(clickSpy).toHaveBeenCalled();
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url"));
  });
});

describe("toCsv", () => {
  it("includes the union of keys across all rows as headers, even when the first row is missing some", () => {
    const csv = toCsv([
      { period: "2026-07", simple_relative: 1.05 },
      { period: "2026-08", simple_relative: 1.08, laspeyres: 1.1 },
    ]);

    const lines = csv.split("\n");
    expect(lines[0].split(",")).toEqual(["period", "simple_relative", "laspeyres"]);
  });

  it("correctly escapes values containing commas and double quotes", () => {
    const csv = toCsv([{ note: 'Economy "Saver", nonstop' }]);

    const dataLine = csv.split("\n")[1];
    expect(dataLine).toBe('"Economy ""Saver"", nonstop"');
  });
});
