/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F4EBDD',
        ink: '#282722',
        yellow: '#E8B92D',
        brick: '#D66A4A',
        sage: '#82917B',
        card: '#FFFDF9',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '4px 4px 0px #282722',
        'brutal-sm': '2px 2px 0px #282722',
        'brutal-lg': '6px 6px 0px #282722',
      },
    },
  },
  plugins: [],
};
