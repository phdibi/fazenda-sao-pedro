/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",  // ← ADICIONADO
  ],
  safelist: [
    // Força o Tailwind a incluir estas classes
    'bg-brand-primary',
    'bg-brand-primary-light',
    'hover:bg-brand-primary-light',
    'text-brand-primary-light',
    'border-brand-primary',
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#381b18',           // Marrom escuro
        'brand-primary-light': '#501c15',     // Marrom claro
        'brand-accent': '#d4a373',            // Bege
        'brand-accent-dark': '#220d0b',       // Marrom muito escuro
        
        'base': {
          950: '#0a0a0a',
          900: '#1a1a1a',
          800: '#2d2d2d',
          700: '#404040',
          600: '#525252',
          500: '#737373',
          400: '#a3a3a3',
          300: '#d4d4d4',
          200: '#e5e5e5',
          100: '#f5f5f5',
          50: '#fafafa',
        },
        
        'accent-green': '#4ade80',
        'accent-yellow': '#facc15',
        'accent-red': '#f87171',
        'accent-blue': '#60a5fa',
      },
    },
  },
  plugins: [],
}