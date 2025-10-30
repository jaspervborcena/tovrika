/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  safelist: [
    // Ensure dynamic classes used via [class] bindings aren't purged
    'bg-green-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-sky-500',
    'bg-indigo-500',
    'text-amber-600',
    'text-indigo-600',
    // Gradient classes for dashboard cards
    'bg-gradient-to-br',
    'from-yellow-100',
    'to-orange-100',
    'from-purple-100',
    'to-indigo-100',
    'from-cyan-100',
    'to-blue-100',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-cyan-500',
    'rounded-2xl',
    'shadow-sm',
    'text-green-500',
    'font-medium'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
    },
  },
  plugins: [],
}
