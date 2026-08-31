/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f14",
          900: "#111820",
          800: "#1a232e",
          700: "#243040",
          600: "#334155",
        },
        accent: {
          500: "#2f6fed",
          600: "#2559c4",
        },
        alert: {
          50: "#fef2f2",
          200: "#fecaca",
          500: "#e0392b",
          600: "#c22a1d",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
