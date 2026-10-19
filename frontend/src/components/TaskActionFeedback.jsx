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

// toast = { type: 'success' | 'error', message } — tự ẩn sau 4 giây
export function TaskToast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null
  const success = toast.type === 'success'
  return (
    <div
      className={`fixed top-6 right-6 z-[60] max-w-[380px] rounded-2xl border-2 border-b-4 p-4 flex items-start gap-3 shadow-lg ${
        success ? 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]' : 'bg-[#FFDFDF] border-[#FF4B4B] text-[#EA2B2B]'
      }`}
    >
      <span className="material-symbols-outlined text-[24px] shrink-0">{success ? 'check_circle' : 'error'}</span>
      <span className="text-sm font-bold flex-1">{toast.message}</span>
      <button onClick={onClose} className="cursor-pointer opacity-70 hover:opacity-100">
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  )
}
