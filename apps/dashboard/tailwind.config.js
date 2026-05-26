/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          subtle: "rgb(var(--bg-subtle) / <alpha-value>)",
        },
        surface: "rgb(var(--surface) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        text: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
          faint: "rgb(var(--text-faint) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          weak: "rgb(var(--accent-weak) / <alpha-value>)",
        },
        warn: "rgb(var(--warn) / <alpha-value>)",
        loss: "rgb(var(--loss) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
