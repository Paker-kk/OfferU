/** @type {import('tailwindcss').Config} */
const { nextui } = require("@nextui-org/react");

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "swiss-paper": "#F8F8F5",
        "swiss-canvas": "#F0F0E8",
        "swiss-ink": "#000000",
        "swiss-muted": "#6B7280",
        "swiss-border": "#9CA3AF",
        "hyper-blue": "#1D4ED8",
      },
      fontFamily: {
        swiss: ["Inter", "Helvetica Neue", "Arial", "sans-serif"],
        "swiss-mono": ["SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        "swiss-hard": "3px 3px 0 0 #000000",
        "swiss-soft": "0 18px 48px rgba(0, 0, 0, 0.18)",
      },
    },
  },
  darkMode: "class",
  plugins: [nextui()],
};
