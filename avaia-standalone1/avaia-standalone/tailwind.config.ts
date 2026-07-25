import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Avaia — dark "Chemistry" palette, drawn from the Chemistry Background
        // design doc: deep near-black field, violet + amber glows, cyan links,
        // gold accents, cool-gray secondary text.
        ink: "#e9eef4", // primary text — near-white, cool
        parchment: "#05060b", // the deep base (body / nav)
        rule: "#2b3440", // subtle border on dark
        muted: "#93a3b2", // secondary text — cool gray
        seal: "#d3ad5c", // gold — headings accents, links, buttons
        gold: "#e0bd6b", // brighter gold — eyebrows, tagline
        cyan: "#6fcfe6", // interactive accent (matches the design's links)
        glass: "rgba(255,255,255,0.04)", // panel fill
        phoenix: "#a68e71", // official brand phoenix tone (Dorian) — used as a warm accent
      },
      fontFamily: {
        serif: ['"Spectral"', "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        // Official tagline font; wordmark font "The Seasons" is a commercial
        // font we don't yet have — the serif stack stands in until it's supplied.
        cinzel: ['"Cinzel Decorative"', "Georgia", "serif"],
      },
      maxWidth: {
        prose: "42rem",
      },
    },
  },
  plugins: [],
};

export default config;
