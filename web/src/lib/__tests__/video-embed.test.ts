import { parseEmbedUrl } from "@/lib/video-embed";

describe("parseEmbedUrl", () => {
  it("parses a standard YouTube watch URL", () => {
    expect(parseEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("parses a youtu.be short link", () => {
    expect(parseEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("parses a youtu.be link with extra query params", () => {
    expect(parseEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=42")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("parses a YouTube Shorts URL", () => {
    expect(parseEmbedUrl("https://www.youtube.com/shorts/abc123XYZ")).toEqual({
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/abc123XYZ",
    });
  });

  it("parses a standard Vimeo URL", () => {
    expect(parseEmbedUrl("https://vimeo.com/76979871")).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/76979871",
    });
  });

  it("parses an already-embeddable Vimeo player URL", () => {
    expect(parseEmbedUrl("https://player.vimeo.com/video/76979871")).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/76979871",
    });
  });

  it("rejects a Vimeo URL with a non-numeric id (e.g. a showcase link)", () => {
    expect(parseEmbedUrl("https://vimeo.com/showcase/12345")).toBeNull();
  });

  it("rejects an unrelated URL", () => {
    expect(parseEmbedUrl("https://example.com/video/123")).toBeNull();
  });

  it("rejects a malformed URL", () => {
    expect(parseEmbedUrl("not a url")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseEmbedUrl("")).toBeNull();
    expect(parseEmbedUrl("   ")).toBeNull();
  });

  it("rejects a YouTube URL missing the v parameter", () => {
    expect(parseEmbedUrl("https://www.youtube.com/watch")).toBeNull();
  });
});
