import { render } from "@testing-library/react";
import { StandingTokens, TILT_DEG } from "../standing-tokens";
import { getPitch, type Token } from "@/lib/board-model";

const pitch = getPitch("full");
const tok = (id: string, y: number, kind: Token["kind"] = "player"): Token =>
  ({ id, kind, group: "Midfielder", label: id, x: pitch.w / 2, y } as Token);

describe("StandingTokens", () => {
  it("stands each player up against the pitch's tilt", () => {
    const { container } = render(
      <StandingTokens tokens={[tok("a", 10)]} pitch={pitch} prefix="t" showNames selectedId={null} />
    );
    const wrap = container.querySelector<HTMLElement>("[aria-hidden] > div")!;
    expect(wrap.style.transform).toContain(`rotateX(-${TILT_DEG}deg)`);
    expect(wrap.style.left).toBe("50%");
  });

  it("paints far players first so nearer ones overlap them", () => {
    const { container } = render(
      <StandingTokens tokens={[tok("near", 120), tok("far", 5), tok("mid", 60)]} pitch={pitch} prefix="t" showNames selectedId={null} />
    );
    const tops = [...container.querySelectorAll<HTMLElement>("[aria-hidden] > div")].map((d) => parseFloat(d.style.top));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });
});
