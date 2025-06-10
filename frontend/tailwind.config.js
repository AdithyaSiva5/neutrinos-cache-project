
/** @type {import('tailwindcss').Config} */
module.exports = {
   content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6', // Adjust based on your design
        success: '#10B981',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
};