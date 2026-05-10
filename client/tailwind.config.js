/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#1A1A1A',
        border: '#2A2A2A',
        primary: '#10B981',
        secondary: '#EF4444',
      },
    },
  },
  plugins: [],
}