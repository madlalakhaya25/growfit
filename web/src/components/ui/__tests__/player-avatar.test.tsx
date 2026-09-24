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

  // Regression: the fetched image used to be a constant 80x80 regardless
  // of the rendered box size, wasting bandwidth on a small avatar even
  // though the actual rendered box (`size-full` in its container) was
  // always correctly sized by CSS. Each size variant now requests the
  // pixel size it actually displays at.
  it.each([
    ["sm", 36],
    ["md", 48],
    ["lg", 80],
  ] as const)("requests a %s photo at its own %dpx size, not a constant 80px", (size, px) => {
    render(<PlayerAvatar name="Sipho Ndlovu" photoUrl="/photo.jpg" size={size} />);
    const img = screen.getByAltText("Sipho Ndlovu");
    expect(img).toHaveAttribute("width", String(px));
    expect(img).toHaveAttribute("height", String(px));
  });
});
