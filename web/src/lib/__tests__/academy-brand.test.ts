import { getAcademyName } from "../academy-brand";
import { fakeSupabase, type FakeReply } from "@/test-utils/fake-supabase";

const name = (reply: FakeReply, id: string | null = "ac1") =>
  getAcademyName(fakeSupabase(() => reply).client as never, id);

describe("getAcademyName", () => {
  it("returns the academy's name, trimmed", async () => {
    expect(await name({ data: { name: "  Growfit Sports Academy " } })).toBe("Growfit Sports Academy");
  });

  it("returns null with no academy, no row, a blank name or an error", async () => {
    expect(await name({ data: { name: "x" } }, null)).toBeNull();
    expect(await name({ data: null })).toBeNull();
    expect(await name({ data: { name: "   " } })).toBeNull();
    expect(await name({ data: null, error: { code: "42501" } })).toBeNull();
  });

  it("caps a very long name", async () => {
    expect((await name({ data: { name: "A".repeat(200) } }))?.length).toBe(60);
  });
});
