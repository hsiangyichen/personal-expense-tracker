"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/import", label: "Import CSV" },
  { href: "/categories", label: "Categories & budgets" },
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link className="text-xl font-semibold tracking-tight" href="/">
            Personal Expense Tracker
          </Link>
          <nav aria-label="Main navigation">
            <ul className="flex flex-wrap gap-1">
              {navigation.map((item) => {
                const isCurrent =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
