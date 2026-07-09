/** @type {import('tailwindcss').Config} */
// The running values are the CSS variables in src/styles/tokens.css.
// This file just exposes them to Tailwind utilities. tokens.css is the source of truth.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // rgb(var(--x-rgb) / <alpha-value>) so opacity modifiers work, e.g.
        // bg-accent/10, border-accent/30, text-fg/90. The channel vars live in
        // tokens.css alongside the hex forms. Bare utilities resolve alpha to 1.
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        fg: "rgb(var(--fg-rgb) / <alpha-value>)",
        muted: "rgb(var(--fg-muted-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-dim": "rgb(var(--accent-dim-rgb) / <alpha-value>)",
        comment: "rgb(var(--comment-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        mono: "var(--font-mono)",
        sans: "var(--font-sans)",
      },
    },
  },
  plugins: [],
};
