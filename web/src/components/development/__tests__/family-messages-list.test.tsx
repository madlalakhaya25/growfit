import { render, screen } from "@testing-library/react";
import { FamilyMessagesList } from "../family-messages-list";

const msg = (id: string, body: string, by: string | null = "Coach K") => ({
  id, playerId: "p", kind: "match_story" as const, refKey: "f", body, status: "approved" as const, approvedByName: by, createdAt: "2026-10-01",
});

describe("FamilyMessagesList", () => {
  it("shows each shared message with who shared it", () => {
    render(<FamilyMessagesList messages={[msg("1", "The team won."), msg("2", "A good day.", null)]} />);
    expect(screen.getByText("The team won.")).toBeInTheDocument();
    expect(screen.getByText("Coach K")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "From the coaches" })).toBeInTheDocument();
  });
  it("renders nothing at all when there are none", () => {
    const { container } = render(<FamilyMessagesList messages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
