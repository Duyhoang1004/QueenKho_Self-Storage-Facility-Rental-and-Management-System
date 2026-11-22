import { useEffect, useState } from 'react'
import { getTransferOptions, rejectRenewalReassign, transferUnit } from '../services/contractService'

const REASONS = [
  { value: 'FACILITY_ISSUE', label: 'Ô có sự cố do cơ sở', hint: 'Thấm dột, hỏng khoá, nhiệt độ / độ ẩm không đạt… Ô cũ bắt buộc vào bảo trì, cơ sở hỗ trợ chuyển hàng miễn phí.' },
  { value: 'CUSTOMER_REQUEST', label: 'Khách yêu cầu đổi ô', hint: 'VD khách muốn ô gần cửa / thang máy hơn. Khách tự chuyển hàng theo lịch hẹn.' },
  { value: 'REARRANGE', label: 'Cơ sở sắp xếp lại / Gán lại ô để gia hạn', hint: 'VD khi ô hiện tại đã có khách khác đặt trước lúc gần hết hạn, hoặc gom khách dài hạn về một khu.' },
]

// BR-122: FM chuyển hợp đồng sang ô khác cùng loại, cùng cơ sở (giá thuê không đổi)
export default function TransferUnitModal({ open, contract, renewalMonths, onClose, onDone, onRejected }) {
  if (!open || !contract) return null
  // Mỗi lần mở dựng lại form từ đầu (danh sách ô trống tải mới)
  return (
    <TransferUnitForm
      contract={contract}
      renewalMonths={renewalMonths}
      onClose={onClose}
      onDone={onDone}
      onRejected={onRejected}
    />
  )
}

function TransferUnitForm({ contract, renewalMonths, onClose, onDone, onRejected }) {
  const effectiveRenewalMonths = Number(
    renewalMonths || (contract.reassignRequestStatus === 'PENDING' ? contract.reassignRequestedMonths : 0)
  ) || null
  const isRenewalMode = Boolean(effectiveRenewalMonths)

  const [options, setOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [toUnitId, setToUnitId] = useState('')
  const [reasonType, setReasonType] = useState(isRenewalMode ? 'REARRANGE' : 'FACILITY_ISSUE')
  const [reason, setReason] = useState(
    isRenewalMode
      ? `Gán lại ô kho mới cùng loại (${contract.unitTypeName || 'đúng loại đã đặt'}) theo yêu cầu gia hạn thêm +${effectiveRenewalMonths} tháng của khách hàng.`
      : ''
  )
  const [oldUnitMaintenance, setOldUnitMaintenance] = useState(!isRenewalMode)
  const [submitting, setSubmitting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState('')

  const contractId = contract.contractId || contract.id

  useEffect(() => {
    let cancelled = false
    getTransferOptions(contractId, effectiveRenewalMonths)
      .then(data => {
        if (!cancelled) {
          const list = data || []
          setOptions(list)
          const firstRegular = list.find(u => !u.emergency)
          if (isRenewalMode && firstRegular) {
            setToUnitId(firstRegular.id)
          }
        }
      })
      .catch(err => !cancelled && setError(err.response?.data?.message || 'Không tải được danh sách ô trống.'))
      .finally(() => !cancelled && setLoadingOptions(false))
    return () => { cancelled = true }
  }, [contractId, effectiveRenewalMonths, isRenewalMode])

  // BR-140: khách đang ở ô khẩn cấp → rời ô khẩn cấp không bắt buộc bảo trì (ô không hỏng)
  const leavingEmergency = Boolean(contract.emergencyUnit)
  const forcedMaintenance = reasonType === 'FACILITY_ISSUE' && !leavingEmergency
  const reasonLen = reason.trim().length
  const regularOptions = options.filter(u => !u.emergency)
  const emergencyOptions = options.filter(u => u.emergency)
  const selected = options.find(u => u.id === toUnitId)
  // Ô khẩn cấp chỉ dùng khi lý do là sự cố do cơ sở
  const emergencyBlocked = selected?.emergency && reasonType !== 'FACILITY_ISSUE'
  const canSubmit = toUnitId && !emergencyBlocked && reasonLen >= 10 && reasonLen <= 500 && !submitting && !rejecting

  const submit = () => {
    setSubmitting(true)
    setError('')
    transferUnit(contractId, {
      toUnitId,
      reasonType,
      reason: reason.trim(),
      oldUnitMaintenance: forcedMaintenance || oldUnitMaintenance,
      ...(effectiveRenewalMonths ? { renewalMonths: effectiveRenewalMonths } : {}),
    })
      .then(result => {
        setToUnitId('')
        setReason('')
        onDone?.(result)
      })
      .catch(err => setError(err.response?.data?.message || 'Chuyển ô thất bại, vui lòng thử lại.'))
      .finally(() => setSubmitting(false))
  }

  const handleRejectOutOfStock = () => {
    setRejecting(true)
    setError('')
    const rejectNote = `Hiện cơ sở đã hết ô kho trống thuộc loại ${contract.unitTypeName || 'này'} trong khoảng thời gian gia hạn +${effectiveRenewalMonths || 1} tháng. Quý khách vui lòng đặt thuê loại kho khác và hẹn ngày trả ô kho hiện tại.`
    rejectRenewalReassign(contractId, { reason: rejectNote })
      .then(result => {
        onRejected?.(result)
      })
      .catch(err => setError(err.response?.data?.message || 'Không thể gửi thông báo hết loại kho.'))
      .finally(() => setRejecting(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div className="duo-card bg-white w-full max-w-[620px] max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B]">
              {isRenewalMode
                ? `Gán lại ô kho mới để gia hạn HĐ ${contract.contractCode} (+${effectiveRenewalMonths} tháng)`
                : `Chuyển ô cho hợp đồng ${contract.contractCode}`}
            </h2>
            <p className="text-[11px] font-bold text-[#AFAFAF]">
              Ô hiện tại {contract.storageUnitId}{leavingEmergency ? ' (ô khẩn cấp)' : ''} · chuyển sang ô cùng loại đã đặt ({contract.unitTypeName || 'giữ giá cũ'}), giá thuê và mã PIN giữ nguyên
            </p>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
              {isRenewalMode
                ? `Ô kho cùng loại trống suốt kỳ gia hạn (+${effectiveRenewalMonths} tháng) *`
                : 'Ô chuyển tới *'}
            </span>
            {loadingOptions ? (
              <p className="text-xs font-bold text-[#AFAFAF]">Đang tải ô trống...</p>
            ) : options.length === 0 ? (
              <div className="rounded-2xl bg-[#FFF2F2] border-2 border-[#FFDFDF] px-4 py-3 text-xs font-bold text-[#FF4B4B] flex flex-col gap-2">
                <span>
                  {isRenewalMode
                    ? `Không còn ô kho cùng loại (${contract.unitTypeName || ''}) nào trống suốt khoảng thời gian khách yêu cầu gia hạn (+${effectiveRenewalMonths} tháng).`
                    : 'Không còn ô cùng loại trống suốt thời gian còn lại của hợp đồng (D-18: tính cả ô đã gán trước cho khách nhận kho sau) và không có ô kho khẩn cấp rảnh.'}
                </span>
                <span className="text-[#777777]">
                  {isRenewalMode
                    ? 'Hãy nhấn nút "Thông báo hết loại kho này" bên dưới để thông báo cho khách hàng đặt loại kho khác và hẹn trả ô kho hiện tại.'
                    : 'Hướng xử lý (BR-141): khách chưa nhận kho có thể tự dời ngày nhận kho hoặc huỷ đơn được hoàn 100% ở trang Kho của tôi; hoặc tạo thêm ô kho khẩn cấp ở trang Quản lý kho rồi mở lại cửa sổ này.'}
                </span>
                {isRenewalMode && (
                  <button
                    type="button"
                    disabled={rejecting}
                    onClick={handleRejectOutOfStock}
                    className="self-start mt-1 px-4 py-2 rounded-xl bg-[#FF4B4B] border-b-2 border-[#EA2B2B] text-white font-black text-xs hover:brightness-95 cursor-pointer disabled:opacity-50"
                  >
                    {rejecting ? 'Đang gửi thông báo...' : 'Thông báo cho khách hết loại kho này (Phải đặt loại kho khác)'}
                  </button>
                )}
              </div>
            ) : (
              <>
              {regularOptions.length === 0 && (
                <p className="text-[11px] font-bold text-[#E58800]">Hết ô cùng loại — chỉ còn ô kho khẩn cấp bên dưới (dùng khi ô có sự cố do cơ sở).</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {regularOptions.map(u => (
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
              {/* BR-140: ô kho khẩn cấp — khác loại được (cùng nhóm nhiệt độ), khách vẫn trả giá loại đã đặt */}
              {emergencyOptions.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[11px] font-black uppercase text-[#7E3FC7]">Ô kho khẩn cấp (chỉ khi sự cố do cơ sở)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {emergencyOptions.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setToUnitId(u.id); setReasonType('FACILITY_ISSUE') }}
                        className={`rounded-2xl border-2 border-dashed px-3 py-2 text-left ${
                          toUnitId === u.id ? 'bg-[#F3E8FF] border-[#A560E8]' : 'bg-white border-[#D9B8F5] hover:bg-[#FAF5FF]'
                        }`}
                      >
                        <span className="block font-mono text-xs font-black text-[#4B4B4B]">{u.id}</span>
                        <span className="block text-[10px] font-bold text-[#AFAFAF]">{u.unitTypeName} · {u.areaSqm}m²</span>
                        <span className="block text-[10px] font-black text-[#7E3FC7]">Tạm thời · giữ giá cũ</span>
                      </button>
                    ))}
                  </div>
                  {emergencyBlocked && (
                    <p className="text-[11px] font-bold text-[#FF4B4B]">Ô khẩn cấp chỉ dùng với lý do "Ô có sự cố do cơ sở".</p>
                  )}
                </div>
              )}
              </>
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
