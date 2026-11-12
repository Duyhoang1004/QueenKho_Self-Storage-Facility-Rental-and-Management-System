// (12/11/2026, góp ý test product) Luật nhập liệu dùng chung — khớp BE (AuthService.PHONE_PATTERN / CCCD_PATTERN)

// SĐT Việt Nam: đúng 10 chữ số, bắt đầu bằng 0
export const PHONE_REGEX = /^0\d{9}$/
// CCCD: đúng 12 chữ số; hộ chiếu: 1 chữ cái + 7–8 chữ số
export const CCCD_REGEX = /^(\d{12}|[A-Za-z]\d{7,8})$/

export const PHONE_ERROR = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.'
export const CCCD_ERROR = 'Số CCCD phải gồm đúng 12 chữ số (hộ chiếu: 1 chữ cái + 7–8 chữ số).'

export const isValidPhone = (value) => PHONE_REGEX.test(String(value || '').trim())
export const isValidCccd = (value) => CCCD_REGEX.test(String(value || '').trim())

// Ô nhập chỉ nhận chữ số, cắt theo độ dài tối đa (gõ "0909 123 456" → "0909123456")
export const digitsOnly = (value, maxLength) => String(value || '').replace(/\D/g, '').slice(0, maxLength)
