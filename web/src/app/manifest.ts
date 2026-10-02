import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Growfit FA",
    short_name: "Growfit FA",
    description:
      "Build the next generation of footballers through structured training, performance ratings, and digital player passports.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfb",
    theme_color: "#4d7c0f",
    categories: ["sports", "education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My Passport",
        url: "/dashboard/player",
        description: "View your player passport",
      },
      {
        name: "Squad",
        url: "/dashboard/coach/squad",
        description: "Manage your squad",
      },
    ],
    screenshots: [],
  };
}
