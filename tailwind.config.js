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
        console: {
          950: '#06080C',
          900: '#0B0F17',
          850: '#101623',
          800: '#161F30',
          750: '#1D283E',
          700: '#25334E',
          600: '#384B70',
          500: '#526D99',
        },
        tally: {
          red: '#FF2E4C',
          redGlow: 'rgba(255, 46, 76, 0.45)',
          amber: '#FFB300',
          amberGlow: 'rgba(255, 179, 0, 0.45)',
          green: '#00E676',
          greenGlow: 'rgba(0, 230, 118, 0.45)',
          blue: '#00E5FF',
          blueGlow: 'rgba(0, 229, 255, 0.45)',
        },
        card: {
          gold: '#E5A93B',
          goldDark: '#996515',
          platinum: '#C0D5E6',
          elite: '#A855F7',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        display: ['Orbitron', 'Chakra Petch', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
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
