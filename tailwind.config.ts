import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Haunted forensic laboratory palette (approved).
        scry: {
          bg: '#070709',
          card: '#110D0F',
          border: 'rgba(155, 38, 38, 0.28)',
          crimson: '#9B2626',
          amber: '#E8892B',
          green: '#4ADE80',
          'green-deep': '#2F8F5B',
          ivory: '#EAE2D6',
          muted: '#A79F94',
          danger: '#B91C1C',
          success: '#15803D',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', '"Cormorant Garamond"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'amber-glow': '0 0 0 1px rgba(232, 137, 43, 0.35), 0 0 24px -4px rgba(232, 137, 43, 0.45)',
        panel: '0 1px 0 rgba(232, 137, 43, 0.08) inset, 0 24px 48px -24px rgba(0, 0, 0, 0.8)',
      },
    },
  },
  plugins: [],
}

export default config
