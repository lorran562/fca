/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'monospace'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        neon: {
          yellow: '#FFE600',
          green: '#00FF94',
          red: '#FF2D55',
          blue: '#00C2FF',
        },
        dark: {
          900: '#080808',
          800: '#111111',
          700: '#1A1A1A',
          600: '#252525',
          500: '#333333',
        },
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-click': 'bounceClick 0.15s ease-out',
        'progress-glow': 'progressGlow 1s ease-in-out infinite alternate',
        'countdown': 'countdown 1s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'shake': 'shake 0.3s ease-in-out',
      },
      keyframes: {
        bounceClick: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.92)' },
          '100%': { transform: 'scale(1)' },
        },
        progressGlow: {
          '0%': { boxShadow: '0 0 5px var(--glow-color)' },
          '100%': { boxShadow: '0 0 20px var(--glow-color), 0 0 40px var(--glow-color)' },
        },
        countdown: {
          '0%': { transform: 'scale(1.5)', opacity: '0' },
          '20%': { transform: 'scale(1)', opacity: '1' },
          '80%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
};
