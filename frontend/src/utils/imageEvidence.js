// Ảnh bằng chứng (sự cố, biên bản bàn giao BR-121, check-in online BR-124) — dùng chung giữa các màn

// Nén file ảnh sang base64 JPEG nhẹ (tối đa 800px) để lưu DB nhanh và xem trực tiếp không cần server ngoài
export function compressImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'))
    reader.onload = e => {
      const img = new Image()
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ'))
      img.onload = () => {
        const MAX_DIM = 800
        let { width, height } = img
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          } else {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// Tạo 1 ảnh bằng chứng mẫu dạng SVG Data URI cho nút "Giả lập" (phục vụ demo nhanh)
export function createMockEvidenceDataUrl(label, title = 'ẢNH BẰNG CHỨNG HIỆN TRƯỜNG') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <rect width="480" height="320" fill="#FFF5E6" rx="16"/>
    <rect x="16" y="16" width="448" height="288" fill="none" stroke="#FF9600" stroke-width="4" stroke-dasharray="10,6" rx="12"/>
    <circle cx="240" cy="120" r="42" fill="#FFE8CC"/>
    <text x="240" y="132" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#E58800" text-anchor="middle">!</text>
    <text x="240" y="195" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#4B4B4B" text-anchor="middle">${title}</text>
    <text x="240" y="225" font-family="Arial, sans-serif" font-size="14" fill="#777777" text-anchor="middle">${label}</text>
    <text x="240" y="265" font-family=" monospace" font-size="12" fill="#AFAFAF" text-anchor="middle">QueenKho Inspection Evidence</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
