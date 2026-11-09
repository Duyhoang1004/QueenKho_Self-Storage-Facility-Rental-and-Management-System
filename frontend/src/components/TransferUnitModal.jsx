import { useEffect, useState } from 'react'
import { getTransferOptions, transferUnit } from '../services/contractService'

const REASONS = [
  { value: 'FACILITY_ISSUE', label: 'Ô có sự cố do cơ sở', hint: 'Thấm dột, hỏng khoá, nhiệt độ / độ ẩm không đạt… Ô cũ bắt buộc vào bảo trì, cơ sở hỗ trợ chuyển hàng miễn phí.' },
  { value: 'CUSTOMER_REQUEST', label: 'Khách yêu cầu đổi ô', hint: 'VD khách muốn ô gần cửa / thang máy hơn. Khách tự chuyển hàng theo lịch hẹn.' },
  { value: 'REARRANGE', label: 'Cơ sở sắp xếp lại', hint: 'VD lúc gia hạn, gom khách dài hạn về một khu. Đã thống nhất với khách trước khi chuyển.' },
]

// BR-122: FM chuyển hợp đồng sang ô khác cùng loại, cùng cơ sở (giá thuê không đổi)
export default function TransferUnitModal({ open, contract, onClose, onDone }) {
  if (!open || !contract) return null
  // Mỗi lần mở dựng lại form từ đầu (danh sách ô trống tải mới)
  return <TransferUnitForm contract={contract} onClose={onClose} onDone={onDone} />
}

function TransferUnitForm({ contract, onClose, onDone }) {
  const [options, setOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [toUnitId, setToUnitId] = useState('')
  const [reasonType, setReasonType] = useState('FACILITY_ISSUE')
  const [reason, setReason] = useState('')
  const [oldUnitMaintenance, setOldUnitMaintenance] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const contractId = contract.contractId || contract.id

  useEffect(() => {
    let cancelled = false
    getTransferOptions(contractId)
      .then(data => !cancelled && setOptions(data || []))
      .catch(err => !cancelled && setError(err.response?.data?.message || 'Không tải được danh sách ô trống.'))
      .finally(() => !cancelled && setLoadingOptions(false))
    return () => { cancelled = true }
  }, [contractId])

  const forcedMaintenance = reasonType === 'FACILITY_ISSUE'
  const reasonLen = reason.trim().length
  const canSubmit = toUnitId && reasonLen >= 10 && reasonLen <= 500 && !submitting

  const submit = () => {
    setSubmitting(true)
    setError('')
    transferUnit(contractId, {
      toUnitId,
      reasonType,
      reason: reason.trim(),
      oldUnitMaintenance: forcedMaintenance || oldUnitMaintenance,
    })
      .then(result => {
        setToUnitId('')
        setReason('')
        onDone?.(result)
      })
      .catch(err => setError(err.response?.data?.message || 'Chuyển ô thất bại, vui lòng thử lại.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div className="duo-card bg-white w-full max-w-[620px] max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B]">Chuyển ô cho hợp đồng {contract.contractCode}</h2>
            <p className="text-[11px] font-bold text-[#AFAFAF]">
              Ô hiện tại {contract.storageUnitId} · chỉ chuyển sang ô cùng loại ({contract.unitTypeName}), giá thuê và mã PIN giữ nguyên
            </p>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ô chuyển tới *</span>
            {loadingOptions ? (
              <p className="text-xs font-bold text-[#AFAFAF]">Đang tải ô trống...</p>
            ) : options.length === 0 ? (
              <p className="text-xs font-bold text-[#FF4B4B]">Không còn ô cùng loại trống suốt thời gian còn lại của hợp đồng (D-18: tính cả ô đã gán trước cho khách nhận kho sau).</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {options.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setToUnitId(u.id)}
                    className={`rounded-2xl border-2 px-3 py-2 text-left ${
                      toUnitId === u.id ? 'bg-[#DDF4FF] border-[#1CB0F6]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="block font-mono text-xs font-black text-[#4B4B4B]">{u.id}</span>
                    <span className="block text-[10px] font-bold text-[#AFAFAF]">Tầng {u.floor} · Khu {u.zone} · P.{u.roomNumber}</span>
                    {/* D-18: ô rảnh tới ngày khách khác nhận kho */}
                    <span className={`block text-[10px] font-black ${u.freeUntil ? 'text-[#E58800]' : 'text-[#58A700]'}`}>
                      {u.freeUntil ? `Trống đến ${u.freeUntil.split('-').reverse().join('/')} (${u.nextContractCode})` : 'Trống dài hạn'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Lý do *</span>
            {REASONS.map(r => (
              <label
                key={r.value}
                className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer ${
                  reasonType === r.value ? 'bg-[#FFF0D6] border-[#FF9600]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                }`}
              >
                <input
                  type="radio"
                  name="reasonType"
                  checked={reasonType === r.value}
                  onChange={() => setReasonType(r.value)}
                  className="mt-0.5 accent-[#FF9600]"
                />
                <span className="flex flex-col">
                  <span className="text-xs font-black text-[#4B4B4B]">{r.label}</span>
                  <span className="text-[11px] font-bold text-[#AFAFAF]">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Mô tả cụ thể * (10–500 ký tự, gửi kèm thông báo cho khách)</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="VD: Trần ô A101 bị thấm nước sau mưa, cần sửa 3 ngày"
              className="duo-input resize-none text-xs"
            />
            <span className={`text-[11px] font-bold self-end ${reasonLen > 500 ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>{reasonLen}/500</span>
          </label>

          <label className={`flex items-center gap-2 text-xs font-bold text-[#4B4B4B] ${forcedMaintenance ? 'opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={forcedMaintenance || oldUnitMaintenance}
              disabled={forcedMaintenance}
              onChange={e => setOldUnitMaintenance(e.target.checked)}
              className="w-4 h-4 accent-[#FF9600]"
            />
            Đưa ô cũ {contract.storageUnitId} vào bảo trì (không cho thuê lại ngay)
          </label>

          {error && (
            <div className="rounded-2xl bg-[#FFF2F2] border-2 border-[#FFDFDF] px-4 py-3 text-xs font-bold text-[#FF4B4B]">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t-2 border-[#E5E5E5] flex justify-end gap-3">
          <button type="button" onClick={onClose} className="duo-btn-white px-5 py-2.5 text-sm">Đóng</button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="duo-btn-orange px-5 py-2.5 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
            {submitting ? 'Đang chuyển...' : 'Xác nhận chuyển ô'}
          </button>
        </div>
      </div>
    </div>
  )
}
