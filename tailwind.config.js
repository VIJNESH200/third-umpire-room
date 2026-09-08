/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        broadcast: {
          950: '#06080D',
          900: '#0B0F17',
          850: '#101622',
          800: '#161D2B',
          750: '#1E2738',
          700: '#273349',
          600: '#384865',
          500: '#4F648A',
          border: '#222C3E',
          surface: '#0E131E',
          card: '#121824',
          accent: '#2563EB',
          red: '#DC2626',
          green: '#16A34A',
          gold: '#D97706',
          cyan: '#0284C7',
        },
        console: {
          950: '#06080D',
          900: '#0B0F17',
          850: '#101622',
          800: '#161D2B',
          750: '#1E2738',
          700: '#273349',
          600: '#384865',
          500: '#4F648A',
        },
        tally: {
          red: '#EF4444',
          redGlow: 'rgba(239, 68, 68, 0.3)',
          amber: '#F59E0B',
          amberGlow: 'rgba(245, 158, 11, 0.3)',
          green: '#10B981',
          greenGlow: 'rgba(16, 185, 129, 0.3)',
          blue: '#3B82F6',
          blueGlow: 'rgba(59, 130, 246, 0.3)',
        },
        card: {
          gold: '#E5A93B',
          goldDark: '#996515',
          platinum: '#C0D5E6',
          elite: '#A855F7',
        }
      },
      fontFamily: {
        broadcast: ['Barlow Condensed', 'Oswald', 'Chakra Petch', 'sans-serif'],
        display: ['Barlow Condensed', 'Oswald', 'Inter', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'Cambria', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        body: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
        'tally-blink': 'blink 1.2s infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        sparkle: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        }
      }
    },
  },
  plugins: [],
}
