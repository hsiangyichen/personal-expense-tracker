import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPage from "@/app/page";

describe("DashboardPage", () => {
  it("shows the empty dashboard state", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
  });
});
