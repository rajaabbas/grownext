import type { Config } from "tailwindcss";
import basePreset from "@ma/ui/tailwind-preset.cjs";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  presets: [basePreset],
  theme: {
    extend: {}
  },
  plugins: [tailwindcssAnimate]
};

export default config;
