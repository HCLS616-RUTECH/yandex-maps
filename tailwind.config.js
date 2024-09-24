/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,ts}"],
  theme: {
    extend: {
      colors: {
        black: {
          1000: "#242323",
        },
        white: {
          1000: "#FFFFFF",
        },
      },
    },
  },
  plugins: [],
};
