/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ==========================================
        // 1. BẢNG MÀU CHÍNH DUOLINGO (FLAT 2.5D SYSTEM)
        // ==========================================
        "duo-green": "#58CC02",        // Feather Green đặc trưng
        "duo-green-dark": "#58A700",   // Viền/đổ bóng nút bấm 2.5D
        "duo-green-hover": "#61E002",
        "duo-green-light": "#D7FFB8",

        "duo-blue": "#1CB0F6",         // Macaw Blue
        "duo-blue-dark": "#1899D6",
        "duo-blue-hover": "#25C0FF",
        "duo-blue-light": "#DDF4FF",

        "duo-orange": "#FF9600",       // Fox Orange / Streak Flame
        "duo-orange-dark": "#E58800",
        "duo-orange-light": "#FFE8CC",

        "duo-red": "#FF4B4B",          // Cardinal Red / Heart
        "duo-red-dark": "#EA2B2B",
        "duo-red-light": "#FFDFDF",

        "duo-yellow": "#FFC800",       // Crown / Gold Coin
        "duo-yellow-dark": "#E5B400",
        "duo-yellow-light": "#FFF3B3",

        "duo-purple": "#CE82FF",       // Badges & VIP
        "duo-purple-dark": "#A559D9",

        "duo-gray": "#E5E5E5",         // Viền thẻ / Nền xám nhạt
        "duo-gray-dark": "#CECECE",    // Viền đậm hơn
        "duo-border": "#E5E5E5",
        "duo-text": "#4B4B4B",         // Chữ chính đậm
        "duo-muted": "#777777",        // Chữ phụ
        "duo-bg": "#FFFFFF",
        "duo-surface": "#F7F7F7",

        // ==========================================
        // 2. MAPPING TƯƠNG THÍCH TOÀN DỰ ÁN SANG DUOLINGO
        // ==========================================
        "brand": "#58CC02",
        "brand-hover": "#61E002",
        "action": "#58CC02",
        "action-hover": "#61E002",
        "page": "#FFFFFF",
        "surface": "#FFFFFF",
        "ink": "#4B4B4B",

        "background": "#FFFFFF",
        "on-background": "#4B4B4B",
        "primary": "#58CC02",
        "primary-hover": "#61E002",
        "primary-dark": "#58A700",
        "primary-container": "#D7FFB8",
        "on-primary": "#FFFFFF",
        "on-primary-container": "#58A700",
        "primary-fixed": "#D7FFB8",
        "primary-fixed-dim": "#C3F59B",

        "secondary": "#1CB0F6",
        "secondary-dark": "#1899D6",
        "secondary-fixed": "#DDF4FF",
        "secondary-fixed-dim": "#B8E9FF",
        "on-secondary": "#FFFFFF",

        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F7F7F7",
        "surface-container": "#F7F7F7",
        "surface-container-high": "#E5E5E5",
        "on-surface": "#4B4B4B",
        "on-surface-variant": "#777777",
        "outline": "#CECECE",
        "outline-variant": "#E5E5E5",
        "error": "#FF4B4B",
        "error-container": "#FFDFDF",
        "on-error-container": "#EA2B2B",
        "success": "#58CC02",
        "warning": "#FF9600",
      },
      fontFamily: {
        sans: ["Nunito", "Inter", "sans-serif"],
        headline: ["Nunito", "sans-serif"],
      },
      borderRadius: {
        "xl": "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
}