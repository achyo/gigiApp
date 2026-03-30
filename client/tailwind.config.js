/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend Deca', 'Atkinson Hyperlegible', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  'var(--acb)',
          500: 'var(--ac)',
          700: 'var(--act)',
        },
      },
    },
  },
  plugins: [],
};
