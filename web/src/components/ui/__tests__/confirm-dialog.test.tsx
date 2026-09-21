import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConfirm } from "../confirm-dialog";

/** Minimal host mirroring how every real call site uses the hook. */
function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      {dialog}
      <button
        type="button"
        onClick={async () => {
          onResult(
            await confirm({
              title: "Remove Sipho from the squad?",
              body: "They stay on the academy's books.",
              confirmLabel: "Remove",
            })
          );
        }}
      >
        Open remove dialog
      </button>
    </>
  );
}

describe("useConfirm", () => {
  it("shows nothing until the action is triggered", () => {
    render(<Harness onResult={() => {}} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("resolves true when confirmed", async () => {
    const onResult = jest.fn();
    const user = userEvent.setup();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves false when cancelled, so the caller aborts", async () => {
    const onResult = jest.fn();
    const user = userEvent.setup();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("resolves false on Escape", async () => {
    const onResult = jest.fn();
    const user = userEvent.setup();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("focuses Cancel, not the destructive button", async () => {
    const user = userEvent.setup();
    render(<Harness onResult={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it("shows the consequence, not just the question", async () => {
    const user = userEvent.setup();
    render(<Harness onResult={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    expect(
      await screen.findByText("They stay on the academy's books.")
    ).toBeInTheDocument();
  });

  it("closes after resolving so a second action gets a fresh dialog", async () => {
    const onResult = jest.fn();
    const user = userEvent.setup();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Open remove dialog" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });
});
