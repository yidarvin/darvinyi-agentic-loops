/** @type {import('tailwindcss').Config} */
// The running values are the CSS variables in src/styles/tokens.css.
// This file just exposes them to Tailwind utilities. tokens.css is the source of truth.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        fg: "var(--fg)",
        muted: "var(--fg-muted)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        comment: "var(--comment)",
      },
      fontFamily: {
        mono: "var(--font-mono)",
        sans: "var(--font-sans)",
      },
    },
  },
  plugins: [],
};
