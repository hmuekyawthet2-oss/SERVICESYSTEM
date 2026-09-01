/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pm: {
          blue: '#3B82F6',
          green: '#22C55E',
          red: '#EF4444',
          gray: '#9CA3AF',
        },
      },
    },
  },
  plugins: [],
};
