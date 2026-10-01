import { fireEvent, render, screen } from "@testing-library/react";

const mockRewrite = jest.fn();
jest.mock("@/app/actions/age-rewrite", () => ({ rewriteForAge: (...a: unknown[]) => mockRewrite(...a) }));

import { SimplifyForAge } from "../simplify-for-age";

beforeEach(() => { jest.resetAllMocks(); mockRewrite.mockResolvedValue({ text: "Come at 17:00." }); });

describe("SimplifyForAge", () => {
  it("renders nothing for a team with no age group", () => {
    const { container } = render(<SimplifyForAge ageGroup={null} getText={() => "x"} onUse={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows the simpler version and only replaces the message when chosen", async () => {
    const onUse = jest.fn();
    render(<SimplifyForAge ageGroup="U11" getText={() => "Training moves to 17:00"} onUse={onUse} />);
    fireEvent.click(screen.getByRole("button", { name: /simplify for u11/i }));
    expect(await screen.findByText("Come at 17:00.")).toBeInTheDocument();
    expect(mockRewrite).toHaveBeenCalledWith({ text: "Training moves to 17:00", ageGroup: "U11" });
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /use this version/i }));
    expect(onUse).toHaveBeenCalledWith("Come at 17:00.");
    expect(screen.queryByText("Come at 17:00.")).not.toBeInTheDocument();
  });
  it("keeps the coach's own words on 'Keep mine'", async () => {
    const onUse = jest.fn();
    render(<SimplifyForAge ageGroup="U11" getText={() => "x"} onUse={onUse} />);
    fireEvent.click(screen.getByRole("button", { name: /simplify/i }));
    fireEvent.click(await screen.findByRole("button", { name: /keep mine/i }));
    expect(onUse).not.toHaveBeenCalled();
    expect(screen.queryByText("Come at 17:00.")).not.toBeInTheDocument();
  });
  it("warns about figures the rewrite lost", async () => {
    mockRewrite.mockResolvedValue({ text: "Come later.", missing: ["17:00"] });
    render(<SimplifyForAge ageGroup="U11" getText={() => "x"} onUse={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /simplify/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("17:00");
  });
  it("shows an error", async () => {
    mockRewrite.mockResolvedValue({ error: "Write the message first, then simplify it." });
    render(<SimplifyForAge ageGroup="U11" getText={() => ""} onUse={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /simplify/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Write the message first/);
  });
});
