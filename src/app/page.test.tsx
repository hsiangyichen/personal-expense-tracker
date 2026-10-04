import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/page";

const listTransactionsForMonth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/repositories/transactions", () => ({
  listTransactionsForMonth,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    listTransactionsForMonth.mockResolvedValue([]);
  });

  it("shows the empty dashboard state for the selected month", async () => {
    render(
      await DashboardPage({
        searchParams: Promise.resolve({ month: "2026-08" }),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Spending summary for August 2026.")).toBeVisible();
    expect(screen.getByText("$0.00 CAD")).toBeVisible();
    expect(screen.getByText("No positive spending this month")).toBeVisible();
    expect(listTransactionsForMonth).toHaveBeenCalledWith("2026-08");
  });
});
