// (12/11/2026, góp ý test product) Ô chọn ngày luôn hiển thị dd/MM/yyyy.
// <input type="date"> của trình duyệt hiển thị theo ngôn ngữ máy (máy tiếng Anh ra MM/dd/yyyy) → lệch với hợp đồng.
// Component này giữ nguyên ô chọn ngày gốc (lịch, bàn phím, min/max) nhưng phủ trong suốt lên một ô chữ dd/MM/yyyy.
// Dùng thay thế trực tiếp: value / min / max là chuỗi ISO yyyy-MM-dd, onChange nhận event như input thường.

import { formatIsoDate } from '../utils/date'

export default function DateInput({ value, className = '', placeholder = 'dd/mm/yyyy', disabled, ...rest }) {
  const block = /\bw-full\b/.test(className)
  const openPicker = (event) => {
    try {
      event.currentTarget.showPicker?.()
    } catch {
      // trình duyệt không hỗ trợ showPicker → để hành vi mặc định
    }
  }
  return (
    <span className={`relative ${block ? 'block w-full' : 'inline-block'}`}>
      <input
        type="text"
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        value={formatIsoDate(value)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      <input
        {...rest}
        type="date"
        lang="vi"
        value={value || ''}
        disabled={disabled}
        onClick={openPicker}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </span>
  )
}
