import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeadsWave — Outbound on autopilot",
    short_name: "LeadsWave",
    description:
      "Solo-operator cold-outreach autopilot: scout leads, send personalized email, and book meetings — from your phone.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Inbox",
        short_name: "Inbox",
        description: "Read and reply to warm & hot leads",
        url: "/inbox",
      },
      {
        name: "Campaigns",
        short_name: "Campaigns",
        description: "View and manage outreach campaigns",
        url: "/campaigns",
      },
      {
        name: "Leads",
        short_name: "Leads",
        description: "Browse all leads",
        url: "/leads",
      },
    ],
  };
}
