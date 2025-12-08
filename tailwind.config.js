/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    'from-pastel-blue',
    'via-pastel-purple',
    'to-pastel-orange',
    'bg-pastel-blue',
    'bg-pastel-purple',
    'bg-pastel-pink',
    'bg-pastel-orange',
  ],
  theme: {
    extend: {
      colors: {
        'pastel-blue': '#D6E4FF',
        'pastel-purple': '#E5D4FF',
        'pastel-pink': '#FFD6E8',
        'pastel-orange': '#FFE4D6',
        pastel: {
          blue: "#D6E4FF",
          purple: "#E5D4FF",
          pink: "#FFD6E8",
          orange: "#FFE4D6",
        },
      },
      fontFamily: {
        raleway: ["var(--font-raleway)", "sans-serif"],
        baloo: ["var(--font-baloo)", "cursive"],
        century: ["var(--font-century)", "sans-serif"],
      },
      animation: {
        "gradient-x": "gradient-x 15s ease infinite",
        "gradient-y": "gradient-y 15s ease infinite",
        "gradient-xy": "gradient-xy 15s ease infinite",
        bounce: "bounce 2s infinite",
      },
      keyframes: {
        "gradient-y": {
          "0%, 100%": {
            "background-size": "400% 400%",
            "background-position": "center top",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "center center",
          },
        },
        "gradient-x": {
          "0%, 100%": {
            "background-size": "200% 200%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        "gradient-xy": {
          "0%, 100%": {
            "background-size": "400% 400%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
      },
    },
  },
  plugins: [],
};
