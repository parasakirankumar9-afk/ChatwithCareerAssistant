import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-display)", "system-ui"],
      },
      colors: {
        ink: {
          50: "#f7f6f3",
          100: "#ede9e0",
          200: "#d9d0c0",
          300: "#c0b398",
          400: "#a8916e",
          500: "#8f7355",
          600: "#755c42",
          700: "#5c4735",
          800: "#3d2f22",
          900: "#1e1710",
          950: "#0f0c08",
        },
        gold: {
          50: "#fdf8ec",
          100: "#fbefd0",
          200: "#f5d98a",
          300: "#efc144",
          400: "#e8a91a",
          500: "#c98a0c",
          600: "#a36b08",
          700: "#7d500a",
          800: "#57380e",
          900: "#31200a",
        },
        sage: {
          50: "#f2f5f0",
          100: "#e0e8db",
          200: "#bfcfb6",
          300: "#99b38e",
          400: "#739669",
          500: "#567a4c",
          600: "#43603b",
          700: "#33492d",
          800: "#23321e",
          900: "#121a0f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
