import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockGenerate = jest.fn();
const mockApprove = jest.fn();
jest.mock("@/app/actions/play-roles", () => ({
  generatePlayRoles: (...a: unknown[]) => mockGenerate(...a),
  approvePlayRoles: (...a: unknown[]) => mockApprove(...a),
}));

import { PlayRolesPanel } from "../play-roles-panel";

const draft = { status: "draft", artefactId: "a1", persisted: true, roles: [{ playerId: "p1", name: "Sipho", text: "Run down the left." }] };

beforeEach(() => { jest.resetAllMocks(); mockGenerate.mockResolvedValue(draft); mockApprove.mockResolvedValue({ success: true }); });

describe("PlayRolesPanel", () => {
  it("writes the jobs for the saved play and shows them with an Approve button", async () => {
    render(<PlayRolesPanel playId="pl1" />);
    fireEvent.click(screen.getByRole("button", { name: /write each player/i }));
    expect(await screen.findByText(/Run down the left/)).toBeInTheDocument();
    expect(mockGenerate).toHaveBeenCalledWith({ playId: "pl1", force: false });
    expect(screen.getByText(/Players see nothing until you approve/)).toBeInTheDocument();
  });
  it("approves, then shows the approved state and tells the coach", async () => {
    const onNotice = jest.fn();
    render(<PlayRolesPanel playId="pl1" onNotice={onNotice} />);
    fireEvent.click(screen.getByRole("button", { name: /write each player/i }));
    fireEvent.click(await screen.findByRole("button", { name: /approve for players/i }));
    await waitFor(() => expect(screen.getByText(/Approved for players/)).toBeInTheDocument());
    expect(mockApprove).toHaveBeenCalledWith("a1");
    expect(onNotice).toHaveBeenCalled();
  });
  it("offers no approval for an already approved set", async () => {
    mockGenerate.mockResolvedValue({ ...draft, status: "approved" });
    render(<PlayRolesPanel playId="pl1" />);
    fireEvent.click(screen.getByRole("button", { name: /write each player/i }));
    expect(await screen.findByText(/Approved for players/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve for players/i })).not.toBeInTheDocument();
  });
  it("can't be approved when it wasn't saved", async () => {
    mockGenerate.mockResolvedValue({ ...draft, artefactId: undefined, persisted: false });
    render(<PlayRolesPanel playId="pl1" />);
    fireEvent.click(screen.getByRole("button", { name: /write each player/i }));
    expect(await screen.findByText(/migration 049/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve for players/i })).not.toBeInTheDocument();
  });
  it("shows an error from the action", async () => {
    mockGenerate.mockResolvedValue({ error: "Draw a run first." });
    render(<PlayRolesPanel playId="pl1" />);
    fireEvent.click(screen.getByRole("button", { name: /write each player/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Draw a run first.");
  });
});
