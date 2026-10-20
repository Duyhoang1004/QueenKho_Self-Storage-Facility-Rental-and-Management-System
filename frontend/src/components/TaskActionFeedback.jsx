import { useEffect } from 'react'

// UC-17: Hộp xác nhận + toast dùng chung cho thao tác trên bảng công việc (nhận việc, gỡ người nhận...)

const TONES = {
  green: { btn: 'duo-btn-green', icon: 'bg-[#58CC02] border-[#58A700]' },
  red:   { btn: 'duo-btn-red',   icon: 'bg-[#FF4B4B] border-[#EA2B2B]' },
}

export function TaskConfirmDialog({ open, icon, title, message, confirmLabel, tone = 'green', submitting, onConfirm, onCancel }) {
  if (!open) return null
  const t = TONES[tone] || TONES.green
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="duo-card bg-white w-full max-w-[440px] shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl border-b-2 text-white flex items-center justify-center shrink-0 ${t.icon}`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <h2 className="text-lg font-black text-[#4B4B4B]">{title}</h2>
        </div>
        <p className="text-sm font-bold text-[#777777] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={submitting} className="duo-btn-gray px-5 py-2.5 text-xs disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={onConfirm} disabled={submitting} className={`${t.btn} px-5 py-2.5 text-xs gap-1.5 disabled:opacity-60`}>
            {submitting && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// UC-08: thêm 'warning' (vàng) — thao tác thành công nhưng có điều cần chú ý
const TOAST_STYLES = {
  success: { className: 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]', icon: 'check_circle' },
  warning: { className: 'bg-[#FFF3B3] border-[#FFC800] text-[#B38F00]', icon: 'warning' },
  error: { className: 'bg-[#FFDFDF] border-[#FF4B4B] text-[#EA2B2B]', icon: 'error' },
}

// toast = { type: 'success' | 'warning' | 'error', message } — tự ẩn sau 4 giây (warning: 6 giây)
export function TaskToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(onClose, toast.type === 'warning' ? 6000 : 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.error
  return (
    <div
      className={`fixed top-6 right-6 z-[60] max-w-[380px] rounded-2xl border-2 border-b-4 p-4 flex items-start gap-3 shadow-lg ${style.className}`}
    >
      <span className="material-symbols-outlined text-[24px] shrink-0">{style.icon}</span>
      <span className="text-sm font-bold flex-1">{toast.message}</span>
      <button onClick={onClose} className="cursor-pointer opacity-70 hover:opacity-100">
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  )
}
