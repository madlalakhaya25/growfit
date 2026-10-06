import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockThink = jest.fn();
jest.mock("@/app/actions/copilot", () => ({ thinkItThrough: (...a: unknown[]) => mockThink(...a) }));

import { ThinkItThrough } from "../think-it-through";

beforeEach(() => jest.clearAllMocks());

describe("ThinkItThrough", () => {
  it("is disabled until a problem is named", () => {
    render(<ThinkItThrough problem="  " ageGroup="U13" />);
    expect(screen.getByRole("button", { name: /think it through/i })).toBeDisabled();
    expect(screen.getByText(/name the problem above first/i)).toBeInTheDocument();
  });

  it("sends the problem and age, shows the sections, and closes", async () => {
    mockThink.mockResolvedValue({ sections: [{ key: "causes", title: "Possible causes", body: "Too far apart." }] });
    render(<ThinkItThrough problem="We bunch up." ageGroup="U13" />);
    fireEvent.click(screen.getByRole("button", { name: /think it through/i }));
    expect(await screen.findByText("Possible causes")).toBeInTheDocument();
    expect(screen.getByText("Too far apart.")).toBeInTheDocument();
    expect(screen.getByText(/not shared with anyone/i)).toBeInTheDocument();
    expect(mockThink).toHaveBeenCalledWith({ problem: "We bunch up.", ageGroup: "U13" });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText("Possible causes")).not.toBeInTheDocument();
  });

  it("shows an error as an alert", async () => {
    mockThink.mockResolvedValue({ error: "Try again." });
    render(<ThinkItThrough problem="p" ageGroup={null} />);
    fireEvent.click(screen.getByRole("button", { name: /think it through/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again."));
  });
});
