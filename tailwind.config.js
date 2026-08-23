/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          slate: '#1E293B',
          red: '#B91C1C',
          neutral: '#F8FAFC',
        }
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
