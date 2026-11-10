import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ContractDetailView from './ContractDetailView'

// (10/11/2026) Góp ý: bấm mã/tên hợp đồng không mở tab mới nữa (tab mới mất sessionStorage
// → phải đăng nhập lại). Mở popup ngay trên màn đang xem, có thể đổi sang hợp đồng khác trong popup.
// Dùng: <ContractDetailModal contractId={id} transfer={false} onClose={() => setId(null)} />
export default function ContractDetailModal({ contractId, transfer = false, onClose }) {
  // Lịch sử trong popup: mở HĐ khách bị ảnh hưởng → có nút quay lại HĐ trước
  const [stack, setStack] = useState([{ id: contractId, transfer }])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!contractId) return null
  const current = stack[stack.length - 1]

  // Portal ra body: popup có thể mở từ trong popup khác (Lịch ô kho, Gán ô).
  // stopPropagation: sự kiện React vẫn nổi theo cây component → không để đóng luôn popup cha.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-xs"
      onClick={(e) => { e.stopPropagation(); onClose?.() }}
    >
      <div
        className="bg-[#F7F7F7] rounded-3xl border-2 border-[#E5E5E5] shadow-xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b-2 border-[#E5E5E5]">
          <div className="flex items-center gap-2">
            {stack.length > 1 && (
              <button
                type="button"
                onClick={() => setStack((s) => s.slice(0, -1))}
                className="duo-btn-white px-3 py-1.5 text-[11px] gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>HĐ trước
              </button>
            )}
            <span className="material-symbols-outlined text-[#1CB0F6]">description</span>
            <span className="text-sm font-black uppercase text-[#4B4B4B]">Chi tiết hợp đồng</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#AFAFAF] hover:bg-[#F7F7F7] hover:text-[#4B4B4B]"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="overflow-y-auto">
          <ContractDetailView
            key={`${stack.length}-${current.id}-${current.transfer}`}
            contractId={current.id}
            initialTransfer={current.transfer}
            embedded
            onBack={onClose}
            onOpenContract={(cid, t) => setStack((s) => [...s, { id: cid, transfer: !!t }])}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
