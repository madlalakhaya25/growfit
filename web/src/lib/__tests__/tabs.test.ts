import { pickTab, tabHref } from "../tabs";

const TABS = [{ id: "plan", label: "Plan" }, { id: "register", label: "Register" }, { id: "notes", label: "Notes" }] as const;

describe("tabs in the URL", () => {
  it("opens the tab the URL names", () => {
    expect(pickTab(TABS, "register")).toBe("register");
  });

  it("falls back to the first tab when the value is missing, repeated badly or unknown", () => {
    expect(pickTab(TABS, undefined)).toBe("plan");
    expect(pickTab(TABS, "nope")).toBe("plan");
    expect(pickTab(TABS, "")).toBe("plan");
    expect(pickTab(TABS, ["notes", "register"])).toBe("notes");
    expect(pickTab(TABS, ["nope"])).toBe("plan");
  });

  it("links the first tab to the bare page and the rest with ?tab=", () => {
    expect(tabHref("/dashboard/coach/training/1", TABS, "plan")).toBe("/dashboard/coach/training/1");
    expect(tabHref("/dashboard/coach/training/1", TABS, "notes")).toBe("/dashboard/coach/training/1?tab=notes");
  });
});
