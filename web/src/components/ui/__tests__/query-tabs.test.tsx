import { render, screen } from "@testing-library/react";
import { QueryTabs } from "../query-tabs";

const TABS = [{ id: "plan", label: "Plan" }, { id: "register", label: "Register" }];

describe("QueryTabs", () => {
  it("links each tab to its own URL and marks the open one", () => {
    render(<QueryTabs tabs={TABS} active="register" basePath="/x" />);
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute("href", "/x");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/x?tab=register");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Plan" })).not.toHaveAttribute("aria-current");
  });
});
