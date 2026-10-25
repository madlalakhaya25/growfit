import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChip, ResultCount } from "../filter-chip";

describe("FilterChip", () => {
  it("reports whether it's on and shows its count", () => {
    render(<FilterChip active count={3}>Below 75%</FilterChip>);
    const chip = screen.getByRole("button", { name: "Below 75% 3" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("can't be pressed when disabled", async () => {
    const onClick = jest.fn();
    render(<FilterChip active={false} count={0} disabled onClick={onClick}>Not assessed</FilterChip>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ResultCount", () => {
  it("says how many of the list are showing and links to clear", () => {
    render(<ResultCount shown={6} total={45} noun={["player", "players"]} clearHref="/squad" />);
    expect(screen.getByText(/Showing 6 of 45 players/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/squad");
  });

  it("uses the singular for a list of one", () => {
    render(<ResultCount shown={0} total={1} noun={["player", "players"]} clearHref="/squad" />);
    expect(screen.getByText(/Showing 0 of 1 player\./)).toBeInTheDocument();
  });
});
