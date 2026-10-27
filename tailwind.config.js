module.exports = {
  content: ["./*.html", "./js/**/*.js"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
      },
      colors: {
        "brand": {
          "dark": "#0D47A1",
          "base": "#1565C0",
          "light": "#00B6D9",
          "accent": "#E3F6FD",
          "bg": "#F2F4F7",
        }
      },
    },
  },
  plugins: [],
}
