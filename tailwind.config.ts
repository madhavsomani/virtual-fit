import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0b1020",
        ink: "#f5f7fb",
        mist: "#9aa4bf",
        line: "rgba(255,255,255,0.1)",
        accent: {
          blue: "#61dafb",
          cyan: "#39d0ff",
          emerald: "#58f2b0"
        }
      },
      boxShadow: {
        halo: "0 24px 80px rgba(56, 189, 248, 0.18)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
