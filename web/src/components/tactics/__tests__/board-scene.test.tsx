import { render } from "@testing-library/react";
import { BoardScene } from "../board-scene";
import { getPitch, type Token } from "@/lib/board-model";

const tok = (id: string, x: number, y: number): Token => ({ id, kind: "player", label: id, x, y } as Token);

describe("BoardScene", () => {
  const pitch = getPitch("full");

  it("draws every token at its own position", () => {
    const { container } = render(<BoardScene pitch={pitch} tokens={[tok("a", 10, 20), tok("b", 30, 40)]} shapes={[]} objects={[]} prefix="t" />);
    const moved = Array.from(container.querySelectorAll("g[transform]")).map((g) => g.getAttribute("transform"));
    expect(moved).toEqual(expect.arrayContaining(["translate(10 20)", "translate(30 40)"]));
  });

  it("sizes its viewBox to the pitch", () => {
    const { container } = render(<BoardScene pitch={pitch} tokens={[]} shapes={[]} objects={[]} prefix="t" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(`0 0 ${pitch.w} ${pitch.h}`);
  });

  it("is announced as an image only when given a label", () => {
    const labelled = render(<BoardScene pitch={pitch} tokens={[]} shapes={[]} objects={[]} prefix="t" label="Rondo" />);
    expect(labelled.getByRole("img", { name: "Rondo" })).toBeInTheDocument();
    const plain = render(<BoardScene pitch={pitch} tokens={[]} shapes={[]} objects={[]} prefix="u" />);
    expect(plain.container.querySelector("[role=img]")).toBeNull();
  });
});
