import { extractPlayerPhotoPath, signPlayerPhotoUrl, signPlayerPhotoUrls } from "@/lib/player-photo";

describe("extractPlayerPhotoPath", () => {
  it("pulls the object path out of the stored public-shaped URL", () => {
    expect(
      extractPlayerPhotoPath(
        "https://xyz.supabase.co/storage/v1/object/public/player-photos/abc-123.jpg"
      )
    ).toBe("abc-123.jpg");
  });

  it("returns null for a null, undefined or empty value", () => {
    expect(extractPlayerPhotoPath(null)).toBeNull();
    expect(extractPlayerPhotoPath(undefined)).toBeNull();
    expect(extractPlayerPhotoPath("")).toBeNull();
  });

  it("returns null when the URL doesn't reference the player-photos bucket", () => {
    expect(
      extractPlayerPhotoPath("https://xyz.supabase.co/storage/v1/object/public/player-documents/abc.pdf")
    ).toBeNull();
  });
});

describe("signPlayerPhotoUrl / signPlayerPhotoUrls", () => {
  it("short-circuits to null/empty without touching Supabase when there's no photo", async () => {
    // No real Supabase client is passed -- if either of these tried to
    // reach it, `supabase.storage` would throw immediately.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = null as any;
    await expect(signPlayerPhotoUrl(supabase, null)).resolves.toBeNull();
    await expect(signPlayerPhotoUrls(supabase, [null, undefined, ""])).resolves.toEqual(new Map());
  });
});
