import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/logo";
import { PoweredByGrowfit } from "@/components/powered-by-growfit";

describe("Logo", () => {
  it("says Growfit when no academy name is given (signed out)", () => {
    render(<Logo />);
    expect(screen.getByText("Growfit")).toBeInTheDocument();
    expect(screen.queryByText(/Powered by/)).toBeNull();
  });

  it("renders the brand mark", () => {
    render(<Logo />);
    expect(screen.getByAltText("Growfit")).toHaveAttribute("src", expect.stringContaining(encodeURIComponent("/growfit.png")));
  });

  it("shows the academy's own name with Powered by Growfit beneath it", () => {
    render(<Logo name="Umlazi Lions FC" />);
    expect(screen.getByText("Umlazi Lions FC")).toBeInTheDocument();
    expect(screen.getByText("Powered by Growfit")).toBeInTheDocument();
    expect(screen.getByAltText("Umlazi Lions FC")).toBeInTheDocument();
  });

  it("does not say Powered by Growfit under Growfit itself", () => {
    render(<Logo name="Growfit" />);
    expect(screen.queryByText(/Powered by/)).toBeNull();
  });

  it("accepts a custom className", () => {
    const { container } = render(<Logo className="my-logo" />);
    expect(container.firstChild).toHaveClass("my-logo");
  });
});

describe("PoweredByGrowfit", () => {
  it("renders the line", () => {
    render(<PoweredByGrowfit />);
    expect(screen.getByText("Powered by Growfit")).toBeInTheDocument();
  });
});
