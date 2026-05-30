import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F7F3ED',
        forest: {
          DEFAULT: '#1B3A2E',
          light: '#2D5C45',
          hover: '#3A7560',
        },
        ember: '#E8673A',
        sun: '#F5C518',
        mint: '#3ECBA0',
        ink: '#1A1A1A',
        muted: '#6B7280',
        border: '#E8E3DB',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
