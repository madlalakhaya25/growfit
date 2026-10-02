import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SessionConstraintFields } from "../session-constraint-fields";
import type { KitValue, SpaceValue } from "@/lib/session-constraints";

function Harness() {
  const [space, setSpace] = useState<SpaceValue | "">("");
  const [kit, setKit] = useState<KitValue[] | null>(null);
  return (
    <>
      <SessionConstraintFields idPrefix="t" space={space} onSpace={setSpace} kit={kit} onKit={setKit} />
      <output data-testid="state">{JSON.stringify({ space, kit })}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!) as { space: string; kit: string[] | null };

describe("SessionConstraintFields", () => {
  it("starts unspecified for both", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Space")).toHaveValue("");
    expect(state().kit).toBeNull();
    expect(screen.queryByRole("button", { name: /don't limit/i })).not.toBeInTheDocument();
  });
  it("picks a space", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Space"), { target: { value: "tight" } });
    expect(state().space).toBe("tight");
  });
  it("ticking kit limits it to the ticked list, and 'don't limit' goes back to unspecified", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Balls"));
    fireEvent.click(screen.getByLabelText("Cones"));
    expect(state().kit).toEqual(["balls", "cones"]);
    fireEvent.click(screen.getByLabelText("Balls"));
    expect(state().kit).toEqual(["cones"]);
    fireEvent.click(screen.getByRole("button", { name: /don't limit/i }));
    expect(state().kit).toBeNull();
  });
});
