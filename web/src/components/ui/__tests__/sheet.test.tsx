import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "@/components/ui/sheet";

// Regression test for a real bug caught by review on PR3: the panel's
// focus-management effect depended directly on `onClose`. Every caller so
// far passes an inline `onClose={() => setOpen(false)}` — a fresh function
// on every render of *that caller*, not just when the sheet opens or
// closes (ask-growfit-sheet.tsx re-renders while open as its loading
// state changes). That re-ran the effect's cleanup and setup on every
// such render, forcing focus back onto the panel and away from whatever
// the user was doing inside it (e.g. typing). Holding onClose in a ref
// and depending only on `open` fixes it.
describe("Sheet", () => {
  it("does not steal focus back to the panel when the parent re-renders with a new onClose while open", () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}} title="Test">
        <input placeholder="type here" />
      </Sheet>
    );

    const input = screen.getByPlaceholderText("type here");
    input.focus();
    expect(document.activeElement).toBe(input);

    // A new inline onClose, as any real caller would pass on a re-render.
    rerender(
      <Sheet open onClose={() => {}} title="Test">
        <input placeholder="type here" />
      </Sheet>
    );

    expect(document.activeElement).toBe(input);
  });

  it("still calls the latest onClose on Escape after such a re-render", () => {
    const firstOnClose = jest.fn();
    const secondOnClose = jest.fn();
    const { rerender } = render(
      <Sheet open onClose={firstOnClose} title="Test">
        <p>content</p>
      </Sheet>
    );

    rerender(
      <Sheet open onClose={secondOnClose} title="Test">
        <p>content</p>
      </Sheet>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnClose).not.toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Test">
        <p>content</p>
      </Sheet>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Regression: the focus trap's selector matched a disabled button too --
  // Tab could land on it (a disabled element is never really focusable, so
  // the wrap-around check below never saw it as "active" and let focus walk
  // straight out of the panel on the next Tab).
  it("skips a disabled button when wrapping focus with Tab", () => {
    render(
      <Sheet open onClose={() => {}} title="Test">
        <button disabled>Disabled</button>
        <button>Last real button</button>
      </Sheet>
    );

    const last = screen.getByText("Last real button");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // Wraps to the Close button (the first real focusable element), never
    // to the disabled one in between.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  // Regression: nothing marked the rest of the page `inert` while the sheet
  // was open, so a screen reader's virtual cursor (which the Tab-key trap
  // above never governs) could still reach content behind it.
  it("marks sibling content inert while open, and restores it on close", () => {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);

    const { unmount } = render(
      <Sheet open onClose={() => {}} title="Test">
        <p>content</p>
      </Sheet>
    );
    expect(outside).toHaveAttribute("inert");

    unmount();
    expect(outside).not.toHaveAttribute("inert");

    document.body.removeChild(outside);
  });
});
