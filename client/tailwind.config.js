/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'primary-gold': '#D4AF37',
                'primary-gold-hover': '#B5952F',
                'dark-bg': '#0F172A',
                'darker-bg': '#020617',
                'card-bg': 'rgba(30, 41, 59, 0.7)',
                'text-light': '#F8FAFC',
                'text-dim': '#94A3B8',
                'glass-border': 'rgba(255, 255, 255, 0.1)',
            },
            fontFamily: {
                'outfit': ['Outfit', 'sans-serif'],
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'fade-in': 'fadeIn 1s ease-out forwards',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px) rotateY(-10deg) rotateX(5deg)' },
                    '50%': { transform: 'translateY(-20px) rotateY(-10deg) rotateX(5deg)' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
