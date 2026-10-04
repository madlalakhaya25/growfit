import { folderNames, groupByFolder, normaliseFolder, FOLDER_MAX } from "../play-folders";

describe("normaliseFolder", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normaliseFolder("  Set   pieces ")).toBe("Set pieces");
    expect(normaliseFolder("x".repeat(60))).toHaveLength(FOLDER_MAX);
  });

  it("treats blank as no folder", () => {
    expect(normaliseFolder("   ")).toBeNull();
    expect(normaliseFolder(null)).toBeNull();
    expect(normaliseFolder(undefined)).toBeNull();
  });
});

describe("folderNames", () => {
  it("lists each folder once, A to Z, ignoring letter case", () => {
    expect(folderNames([{ folder: "press" }, { folder: "Build-up" }, { folder: "Press" }, { folder: null }, {}])).toEqual([
      "Build-up",
      "press",
    ]);
  });
});

describe("groupByFolder", () => {
  it("puts named folders first, A to Z, and unfiled plays last, keeping their order", () => {
    const plays = [
      { id: "a", folder: null },
      { id: "b", folder: "Set pieces" },
      { id: "c", folder: "Build-up" },
      { id: "d", folder: "set pieces" },
      { id: "e" },
    ];
    expect(groupByFolder(plays).map((g) => [g.folder, g.plays.map((p) => p.id)])).toEqual([
      ["Build-up", ["c"]],
      ["Set pieces", ["b", "d"]],
      [null, ["a", "e"]],
    ]);
  });

  it("has no unfiled group when every play is filed", () => {
    expect(groupByFolder([{ folder: "A" }]).map((g) => g.folder)).toEqual(["A"]);
  });
});
