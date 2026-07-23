/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.html',
    './pages/**/*.html',
    './pages/*.html',
    './collections/**/*.html',
    './collections/paid-products/**/*.html',
    './collections/paid-products/*.html',
    './src/**/*.{js,html}'
  ],
  safelist: [
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'lg:grid-cols-12',
    'lg:grid-cols-3',
    'lg:col-span-3',
    'lg:col-span-9',
    'lg:block',
    'lg:hidden',
    'max-w-7xl',
    'max-w-container'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#DC3C71',
          strong: '#c23260',
          light: '#F9E7EF'
        },
        accent: {
          DEFAULT: '#0a6586',
          dark: '#084f69'
        },
        bg: {
          DEFAULT: '#ffffff',
          elevated: '#F9E7EF'
        },
        text: {
          dark: '#2A2A2A',
          soft: '#5C5C5C'
        },
        discount: '#00664E'
      },
      fontFamily: {
        body: ['Roboto', 'sans-serif'],
        heading: ['Yeseva One', 'serif']
      },
      maxWidth: {
        container: '1320px'
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '8px',
        lg: '12px',
        xl: '16px'
      }
    }
  },
  plugins: []
};
