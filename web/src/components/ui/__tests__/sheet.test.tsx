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
});
