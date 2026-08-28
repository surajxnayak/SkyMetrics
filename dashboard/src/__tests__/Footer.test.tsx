import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "../components/Footer";

describe("Footer", () => {
  it("disables the newsletter form instead of pretending it's connected", () => {
    render(<Footer />);

    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Notify me" })).toBeDisabled();
    expect(screen.getByText("Coming soon -- not connected yet.")).toBeInTheDocument();
  });
});
