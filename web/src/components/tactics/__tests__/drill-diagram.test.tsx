import { render, screen } from "@testing-library/react";
import { DrillDiagramView } from "../drill-diagram";
import { validateDiagram } from "@/lib/drill-diagram";

const diagram = validateDiagram({
  pitch: "half",
  tokens: [
    { role: "keeper", x: 50, y: 8 }, { role: "team", x: 40, y: 50 }, { role: "opponent", x: 52, y: 30 }, { role: "ball", x: 44, y: 50 },
  ],
  equipment: [{ kind: "mini-goal", x: 50, y: 4 }],
  moves: [{ kind: "shot", from: 1, x: 50, y: 6 }],
  zones: [{ points: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 40 }], hatch: true }],
})!;

describe("DrillDiagramView", () => {
  it("is a labelled image a screen reader can read", () => {
    render(<DrillDiagramView diagram={diagram} />);
    expect(screen.getByRole("img", { name: "Drill diagram: 1 player, 1 goalkeeper, 1 opponent, 1 piece of kit, 1 movement marked." })).toBeInTheDocument();
  });
  it("draws one disc per player and opponent, and the ball", () => {
    const { container } = render(<DrillDiagramView diagram={diagram} />);
    // each token is a translated group; three discs plus a ball
    expect(container.querySelectorAll("g[transform^='translate(']").length).toBeGreaterThanOrEqual(4);
  });
  it("gives each diagram on a page its own gradient ids", () => {
    const { container } = render(<><DrillDiagramView diagram={diagram} /><DrillDiagramView diagram={diagram} /></>);
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("sizes the frame to the pitch it is drawn on", () => {
    const { container } = render(<DrillDiagramView diagram={diagram} />);
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe("100 / 75");
  });
});
