import { render, screen, fireEvent } from "@testing-library/react";
import { InfoTip } from "@/components/ui/info-tip";

describe("InfoTip", () => {
  it("hides the tooltip content until opened, and does not reference it via aria before then", () => {
    render(<InfoTip>Explanation</InfoTip>);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "More information" });
    // aria-controls/aria-describedby must not point at an id no element
    // has yet — a real finding from review, since the tooltip <span> only
    // exists once open.
    expect(button).not.toHaveAttribute("aria-controls");
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("shows the tooltip and wires aria-controls/aria-describedby to it once opened", () => {
    render(<InfoTip>Explanation</InfoTip>);
    const button = screen.getByRole("button", { name: "More information" });
    fireEvent.click(button);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Explanation");
    expect(button).toHaveAttribute("aria-controls", tooltip.id);
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
  });
});
