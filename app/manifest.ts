import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kim's Chocolate",
    short_name: "KWT",
    description: "Internal item intake and operations system",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/sidebar-logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/sidebar-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
