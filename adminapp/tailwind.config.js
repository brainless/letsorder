/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ringColor: {
        'DEFAULT': '#4f46e5', // indigo-600
      },
      ringOffsetColor: {
        'DEFAULT': '#ffffff', // white
      },
      ringWidth: {
        'DEFAULT': '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // To avoid conflicts with other libraries
    }),
    require('@kobalte/tailwindcss'),
  ],
}