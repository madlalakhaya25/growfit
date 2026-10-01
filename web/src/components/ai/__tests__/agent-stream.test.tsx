import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockStream = jest.fn();
jest.mock("../agent-sse", () => ({ streamAgent: (...a: unknown[]) => mockStream(...a) }));

import { AgentStream } from "../agent-stream";

async function* events(...evs: object[]) {
  for (const e of evs) yield e;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockStream.mockImplementation(() => events({ type: "text", delta: "Pressing is…" }));
});

describe("AgentStream", () => {
  it("offers starters, sends the tapped one with the page, then hides them", async () => {
    render(<AgentStream teamId="t1" page="tactics" starters={["Explain pressing"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain pressing" }));
    await waitFor(() => expect(screen.getByText("Pressing is…")).toBeInTheDocument());
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ question: "Explain pressing", page: "tactics", teamId: "t1" }),
      expect.anything()
    );
    expect(screen.queryByRole("button", { name: "Explain pressing" })).not.toBeInTheDocument();
  });

  it("shows no starter row when none are given", () => {
    render(<AgentStream teamId="t1" />);
    expect(screen.queryByRole("button", { name: /explain/i })).not.toBeInTheDocument();
  });

  it("shows a friendly error when the stream fails", async () => {
    mockStream.mockImplementation(() => events({ type: "error", message: "slow down" }));
    render(<AgentStream teamId="t1" starters={["Hi"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Hi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("slow down");
  });
});
