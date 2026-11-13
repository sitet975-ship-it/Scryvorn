import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'moonlit-midnight': '#0D1117',
        'aged-parchment': '#F8F3E6',
        'dark-ink': '#1A1614',
        'pumpkin-orange': '#FF5A1F',
        'crimson-wax': '#DC2626',
        'candlelight-gold': '#D97706',
        'potion-emerald': '#059669',
      },
    },
  },
  plugins: [],
}

export default config
