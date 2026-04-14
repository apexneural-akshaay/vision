/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Custom surface tokens – use these for consistent theming
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
      },
      keyframes: {
        "fade-in":   { "0%": { opacity: 0, transform: "translateY(6px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "slide-in":  { "0%": { opacity: 0, transform: "translateX(-10px)" }, "100%": { opacity: 1, transform: "translateX(0)" } },
        "pulse-dot": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
        "shimmer":   { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "count-up":  { "0%": { opacity: 0, transform: "translateY(5px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "progress-fill": { "from": { width: "0%" } },
      },
      animation: {
        "fade-in":       "fade-in 0.22s ease-out both",
        "slide-in":      "slide-in 0.2s ease-out both",
        "pulse-dot":     "pulse-dot 1.4s ease-in-out infinite",
        "shimmer":       "shimmer 1.6s ease-in-out infinite",
        "count":         "count-up 0.4s ease-out both",
        "progress-fill": "progress-fill 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
