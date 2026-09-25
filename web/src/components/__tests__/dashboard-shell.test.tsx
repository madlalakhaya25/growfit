import { render, screen } from "@testing-library/react";
import { DashboardShell } from "@/components/dashboard-shell";

// AskGrowfitSheet pulls in coach-assistant-panel.tsx -> the "use server"
// coach-assistant action -> @google/genai, an ESM-only package this
// project's Jest config doesn't transform (see lib/nav.ts's comment for
// the fuller story). Stubbed out here since this test is about the nav
// shell, not the assistant.
jest.mock("@/components/ai/ask-growfit-sheet", () => ({
  AskGrowfitSheet: () => null,
}));

let mockPathname = "/dashboard/coach";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const profile = { role: "coach", full_name: "Sphe Mlotshwa", avatar_url: null };

describe("DashboardShell", () => {
  afterEach(() => {
    mockPathname = "/dashboard/coach";
  });

  it("marks only Today active on the role's bare dashboard root, and renders no sub-tabs", () => {
    mockPathname = "/dashboard/coach";
    render(
      <DashboardShell profile={profile}>
        <p>content</p>
      </DashboardShell>
    );
    expect(screen.getByRole("link", { name: /overview/i })).toHaveClass("text-primary");
    expect(screen.queryByRole("link", { name: "Players" })).not.toBeInTheDocument();
  });

  it("marks Squad active (not Overview) on a nested squad route, and renders its sub-tabs", () => {
    mockPathname = "/dashboard/coach/squad";
    render(
      <DashboardShell profile={profile}>
        <p>content</p>
      </DashboardShell>
    );
    // The bug this guards: the old flat nav's Overview link also matched
    // via `pathname.startsWith("/dashboard/coach" + "/")`.
    const overviewLinks = screen.getAllByRole("link", { name: /overview/i });
    expect(overviewLinks.every((el) => !el.className.includes("text-primary"))).toBe(true);

    const squadLinks = screen.getAllByRole("link", { name: /^squad$/i });
    expect(squadLinks.some((el) => el.className.includes("text-primary"))).toBe(true);

    expect(screen.getByRole("link", { name: "Welfare" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Emergency" })).toBeInTheDocument();
  });

  it("drops only the feature-gated tab, keeping its sibling tab and the section itself", () => {
    // Regression test for 4.9: `tactics: false` used to remove the whole
    // Develop section -- Training along with Tactics -- because the
    // feature was checked per-section rather than per-tab. Develop should
    // now survive, pointing at its one remaining tab, Training.
    mockPathname = "/dashboard/coach";
    render(
      <DashboardShell profile={profile} features={{ tactics: false }}>
        <p>content</p>
      </DashboardShell>
    );
    for (const link of screen.getAllByRole("link", { name: "Develop" })) {
      expect(link).toHaveAttribute("href", "/dashboard/coach/training");
    }
  });

  it("drops only the feature-gated tab for the Matchday section too", () => {
    mockPathname = "/dashboard/coach";
    render(
      <DashboardShell profile={profile} features={{ film: false }}>
        <p>content</p>
      </DashboardShell>
    );
    for (const link of screen.getAllByRole("link", { name: "Matchday" })) {
      expect(link).toHaveAttribute("href", "/dashboard/coach/fixtures");
    }
  });

  it("shows the team switcher only with more than one team", () => {
    mockPathname = "/dashboard/coach";
    const { rerender } = render(
      <DashboardShell profile={profile} teams={[{ id: "1", name: "U13", age_group: "U13" }]}>
        <p>content</p>
      </DashboardShell>
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    rerender(
      <DashboardShell
        profile={profile}
        teams={[
          { id: "1", name: "U13", age_group: "U13" },
          { id: "2", name: "U15", age_group: "U15" },
        ]}
      >
        <p>content</p>
      </DashboardShell>
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
