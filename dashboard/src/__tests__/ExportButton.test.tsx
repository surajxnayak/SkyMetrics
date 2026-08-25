import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportButton from "../components/ExportButton";

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
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
