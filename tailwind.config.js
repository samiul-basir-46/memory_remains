/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './pages/**/*.html',
    './collections/**/*.html',
    './src/**/*.{js,html}'
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
