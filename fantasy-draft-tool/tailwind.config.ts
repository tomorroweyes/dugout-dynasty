import defaultConfig from 'tailwindcss/defaultConfig';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'tier-elite': '#ef4444',
        'tier-1': '#f97316',
        'tier-2': '#eab308',
        'tier-3': '#3b82f6',
        'tier-4': '#8b5cf6',
      },
    },
  },
  plugins: [],
};
