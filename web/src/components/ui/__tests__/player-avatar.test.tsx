import { render, screen } from "@testing-library/react";
import { PlayerAvatar } from "@/components/ui/player-avatar";

describe("PlayerAvatar", () => {
  it("shows initials from first and last name when there is no photo", () => {
    render(<PlayerAvatar name="Sipho Ndlovu" />);
    expect(screen.getByText("SN")).toBeInTheDocument();
  });

  it("shows the first two letters for a single-word name", () => {
    render(<PlayerAvatar name="Sipho" />);
    expect(screen.getByText("SI")).toBeInTheDocument();
  });

  it("falls back to a question mark for an empty name", () => {
    render(<PlayerAvatar name="   " />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders a jersey-number badge when given one", () => {
    render(<PlayerAvatar name="Sipho Ndlovu" jerseyNumber={9} />);
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("renders no badge when jerseyNumber is omitted", () => {
    render(<PlayerAvatar name="Sipho Ndlovu" />);
    expect(screen.queryByText("9")).not.toBeInTheDocument();
  });
});
