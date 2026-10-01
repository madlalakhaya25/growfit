import { render, screen } from "@testing-library/react";
import { StatBar } from "@/components/ui/stat-bar";

describe("StatBar", () => {
  it("renders the label", () => {
    render(<StatBar label="Pace" value={80} />);
    expect(screen.getByText("Pace")).toBeInTheDocument();
  });

  it("renders the numeric value", () => {
    render(<StatBar label="Pace" value={80} />);
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("has role=meter for accessibility", () => {
    render(<StatBar label="Shooting" value={75} />);
    expect(screen.getByRole("meter")).toBeInTheDocument();
  });

  it("sets aria-valuenow correctly", () => {
    render(<StatBar label="Passing" value={65} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "65");
  });

  it("sets aria-valuemin to 0", () => {
    render(<StatBar label="Dribbling" value={90} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemin", "0");
  });

  it("sets aria-valuemax to 100", () => {
    render(<StatBar label="Defending" value={55} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value at 100", () => {
    render(<StatBar label="Pace" value={120} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "100");
  });

  it("clamps value at 0", () => {
    render(<StatBar label="Pace" value={-10} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("StatBar colour", () => {
  const fillOf = () => screen.getByRole("meter").firstElementChild as HTMLElement;

  it("bands the fill by value when no colour is given (unchanged behaviour)", () => {
    render(<StatBar label="Pace" value={90} />);
    expect(fillOf().style.backgroundColor).toBe("var(--color-rating-high)");
  });

  it("uses an explicit colour instead of the value band", () => {
    render(<StatBar label="Technical" value={10} color="var(--color-dev-technical)" />);
    expect(fillOf().style.backgroundColor).toBe("var(--color-dev-technical)");
  });
});
