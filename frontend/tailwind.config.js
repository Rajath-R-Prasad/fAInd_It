/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8EF',
        lime: '#D7FF38',
        lavender: '#B99AFF',
        bubble: '#FF83B5',
        ink: '#111111',
        muted: '#555555',
        'lavender-soft': '#F0E9FF',
        'neo-primary': '#D7FF38',
        'neo-secondary': '#B99AFF',
        'neo-accent': '#FF83B5',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neo-sm': '3px 3px 0 #111111',
        neo: '6px 6px 0 #111111',
        'neo-btn': '4px 4px 0 #111111',
        'neo-logo': '5px 5px 0 #111111',
        'neo-lime': '6px 6px 0 #D7FF38',
        'neo-pink': '4px 4px 0 #FF83B5',
      },
      borderRadius: {
        neo: '10px',
      },
    },
  },
  plugins: [],
}
