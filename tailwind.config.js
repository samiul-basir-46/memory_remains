/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.html',
    './pages/**/*.html',
    './pages/*.html',
    './collections/**/*.html',
    './src/**/*.{js,html}'
  ],
  safelist: [
    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'grid-cols-5',
    'grid-cols-6',
    'grid-cols-12',
    'sm:grid-cols-2',
    'sm:grid-cols-3',
    'sm:grid-cols-4',
    'sm:grid-cols-5',
    'sm:grid-cols-6',
    'md:grid-cols-2',
    'md:grid-cols-3',
    'md:grid-cols-4',
    'lg:grid-cols-12',
    'lg:grid-cols-3',
    'lg:grid-cols-4',
    'lg:grid-cols-6',
    'lg:col-span-3',
    'lg:col-span-4',
    'lg:col-span-6',
    'lg:col-span-8',
    'lg:col-span-9',
    'lg:col-span-12',
    'col-span-1',
    'col-span-2',
    'col-span-3',
    'col-span-4',
    'col-span-6',
    'col-span-8',
    'col-span-12',
    'lg:sticky',
    'lg:top-24',
    'lg:block',
    'lg:hidden',
    'max-w-7xl',
    'max-w-container',
    'animate-fade-in-up',
    'animate-fade-in',
    'animate-slide-in-right'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#C97B5F',
          strong: '#8B4A38',
          light: '#FFE8DF'
        },
        accent: {
          DEFAULT: '#2C1A14',
          dark: '#1F120E'
        },
        bg: {
          DEFAULT: '#FFF5F0',
          elevated: '#F8F0EB'
        },
        text: {
          dark: '#2C1A14',
          soft: '#8B4A38'
        },
        discount: '#C97B5F'
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
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' }
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        'fade-in': 'fade-in 0.35s ease both',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
        shimmer: 'shimmer 1.6s linear infinite'
      }
    }
  },
  plugins: []
};

