import { useEffect, useState } from 'react'
import { getSimulationEnabled } from '../services/simulationService'

// Demo: nút "⚡ Giả lập" — viền đứt màu cam để phân biệt với nút nghiệp vụ thật.
// Chỉ hiện khi backend bật queenkho.simulation.enabled. Bấm → hỏi xác nhận → gọi onRun() → báo kết quả → onDone().
export default function SimulationButton({ label, description, onRun, onDone, className = '' }) {
  const [enabled, setEnabled] = useState(false)
  const [running, setRunning] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    let cancelled = false
    getSimulationEnabled().then((value) => { if (!cancelled) setEnabled(value) })
    return () => { cancelled = true }
  }, [])

  if (!enabled) return null

  const handleClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    const confirmText = `⚡ GIẢ LẬP DEMO\n\n${description || label}\n\nThao tác này tua thời gian trong dữ liệu (có ghi nhật ký [SIMULATION]). Tiếp tục?`
    if (!window.confirm(confirmText)) return
    setRunning(true)
    setFeedback(null)
    try {
      const result = await onRun()
      setFeedback({ ok: true, text: result?.message || 'Đã giả lập xong' })
      if (onDone) onDone(result)
    } catch (err) {
      setFeedback({ ok: false, text: err.response?.data?.message || 'Giả lập thất bại' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        title={description || label}
        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-[#FF9600] bg-[#FFF8EE] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-[#E58800] hover:bg-[#FFE8CC] disabled:opacity-50 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">bolt</span>
        {running ? 'Đang giả lập...' : `Giả lập: ${label}`}
      </button>
      {feedback && (
        <span className={`text-[11px] font-bold ${feedback.ok ? 'text-[#58A700]' : 'text-[#FF4B4B]'}`}>{feedback.text}</span>
      )}
    </span>
  )
}
