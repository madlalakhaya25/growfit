import { render, screen } from "@testing-library/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { SIMPLE_FEATURES } from "@/lib/features";

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
    for (const link of screen.getAllByRole("link", { name: /^today$/i })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    expect(screen.queryByRole("link", { name: "Players" })).not.toBeInTheDocument();
  });

  it("marks Squad active (not Today) on a nested squad route, and renders its sub-tabs", () => {
    mockPathname = "/dashboard/coach/squad";
    render(
      <DashboardShell profile={profile}>
        <p>content</p>
      </DashboardShell>
    );
    // The bug this guards: the old flat nav's home link also matched
    // via `pathname.startsWith("/dashboard/coach" + "/")`.
    const todayLinks = screen.getAllByRole("link", { name: /^today$/i });
    expect(todayLinks.every((el) => el.getAttribute("aria-current") !== "page")).toBe(true);

    const squadLinks = screen.getAllByRole("link", { name: /^squad$/i });
    expect(squadLinks.some((el) => el.getAttribute("aria-current") === "page")).toBe(true);

    expect(screen.getByRole("link", { name: "Check-ins" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Who to call" })).toBeInTheDocument();
  });

  it("drops only the feature-gated tab, keeping its sibling tab and the section itself", () => {
    // Regression test for 4.9: `tactics: false` used to remove the whole
    // section (then called Develop) -- Training along with Tactics --
    // because the feature was checked per-section rather than per-tab.
    // Tactics now sits in Matches as Plays; Matches should survive.
    mockPathname = "/dashboard/coach";
    render(
      <DashboardShell profile={profile} features={{ tactics: false }}>
        <p>content</p>
      </DashboardShell>
    );
    for (const link of screen.getAllByRole("link", { name: "Matches" })) {
      expect(link).toHaveAttribute("href", "/dashboard/coach/fixtures");
    }
  });

  it("drops only the feature-gated tab for Film too", () => {
    mockPathname = "/dashboard/coach";
    render(
      <DashboardShell profile={profile} features={{ film: false }}>
        <p>content</p>
      </DashboardShell>
    );
    for (const link of screen.getAllByRole("link", { name: "Matches" })) {
      expect(link).toHaveAttribute("href", "/dashboard/coach/fixtures");
    }
  });

  it("leaves only the weekly-loop tabs in simple mode, keeping Check-ins and Who to call", () => {
    mockPathname = "/dashboard/coach/training";
    render(
      <DashboardShell profile={profile} features={SIMPLE_FEATURES}>
        <p>content</p>
      </DashboardShell>
    );
    for (const name of ["Challenges", "Library", "Learn", "Plays", "Film"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    for (const link of screen.getAllByRole("link", { name: "Training" })) {
      expect(link).toHaveAttribute("href", "/dashboard/coach/training");
    }

    mockPathname = "/dashboard/coach/squad";
    render(
      <DashboardShell profile={profile} features={SIMPLE_FEATURES}>
        <p>content</p>
      </DashboardShell>
    );
    expect(screen.getByRole("link", { name: "Check-ins" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Who to call" })).toBeInTheDocument();
  });

  it("gives every role a Me tab that opens Settings, and shows the whole admin menu on a phone", () => {
    for (const role of ["coach", "parent", "player", "admin"]) {
      mockPathname = `/dashboard/${role}`;
      const { unmount } = render(
        <DashboardShell profile={{ ...profile, role }}>
          <p>content</p>
        </DashboardShell>
      );
      for (const link of screen.getAllByRole("link", { name: "Me" })) {
        expect(link).toHaveAttribute("href", `/dashboard/${role}/settings`);
      }
      unmount();
    }

    mockPathname = "/dashboard/admin";
    render(
      <DashboardShell profile={{ ...profile, role: "admin" }}>
        <p>content</p>
      </DashboardShell>
    );
    const phoneNav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const labels = Array.from(phoneNav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual(["Club", "People", "Paperwork", "Season", "Me"]);
  });

  it("marks Me active, with its sub-tabs, on a coach's settings page", () => {
    mockPathname = "/dashboard/coach/settings";
    render(
      <DashboardShell profile={profile}>
        <p>content</p>
      </DashboardShell>
    );
    const meLinks = screen.getAllByRole("link", { name: "Me" });
    expect(meLinks.some((el) => el.getAttribute("aria-current") === "page")).toBe(true);
    expect(screen.getByRole("link", { name: "Messages" })).toBeInTheDocument();
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
