/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0B3D66',    // Xanh Navy QueenKho (Sidebar, Nút chính)
          hover: '#0A335A',
        },
        page: '#F4F6F8',         // Nền trang xám mát
        surface: '#FFFFFF',      // Nền thẻ trắng nổi bật
      },
    },
  },
  plugins: [],
}