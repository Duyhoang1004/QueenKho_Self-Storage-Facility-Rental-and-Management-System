import { useCallback, useEffect, useState } from 'react'
import { getOverdueContractsChain, waiveLateFee } from '../../services/contractService'

// Flow 6 (04/11/2026): BOM xem hợp đồng quá hạn toàn chuỗi và miễn phí trễ (mọi cơ sở,
// không phụ thuộc cờ "cho phép FM miễn phí trễ" trong chính sách). Thanh lý vẫn do FM cơ sở làm.

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + 'đ'
}

function formatDate(val) {
  if (!val) return '—'
  return String(val).split('-').reverse().join('/')
}

export default function BomOverduePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [waiveOverstay, setWaiveOverstay] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    return getOverdueContractsChain()
      .then((data) => { setRows(data || []); setError('') })
      .catch((err) => setError(err.response?.data?.message || 'Không tải được danh sách quá hạn.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = () => {
    setBusy(true)
    setFormError('')
    waiveLateFee(target.contractId, reason.trim(), waiveOverstay)
      .then((res) => {
        setToast(`${res.message} — FM cơ sở đã được báo.`)
        setTarget(null)
        setReason('')
        setWaiveOverstay(false)
        load()
      })
      .catch((err) => setFormError(err.response?.data?.message || 'Không miễn được phí trễ.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Hợp đồng quá hạn toàn chuỗi</h1>
        <p className="text-xs font-bold text-[#AFAFAF]">
          BOM được miễn phí trễ cho mọi cơ sở (kể cả cơ sở đã tắt quyền miễn của FM). Miễn chỉ áp dụng đợt quá hạn hiện tại;
          phí chiếm dụng mặc định vẫn tính 100% giá ngày, BOM có thể chọn miễn luôn. Thanh lý do Quản lý cơ sở thực hiện.
        </p>
      </div>
      {toast && (
        <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] px-4 py-3 text-xs font-black text-[#58A700] flex justify-between">
          {toast}<button type="button" onClick={() => setToast('')}>✕</button>
        </div>
      )}
      <div className="duo-card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-xs font-bold text-[#AFAFAF]">Đang tải...</p>
        ) : error ? (
          <p className="p-6 text-xs font-bold text-[#FF4B4B]">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-xs font-bold text-[#AFAFAF]">Không có hợp đồng nào đang quá hạn.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F7F7] text-[11px] font-black uppercase text-[#AFAFAF]">
              <tr>
                <th className="py-3 px-4">Hợp đồng</th><th className="py-3 px-4">Cơ sở</th><th className="py-3 px-4">Khách</th>
                <th className="py-3 px-4">Hết hạn</th><th className="py-3 px-4">Quá hạn</th><th className="py-3 px-4">Phí trễ</th>
                <th className="py-3 px-4">Chiếm dụng</th><th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#F0F0F0] font-bold text-[#4B4B4B]">
              {rows.map((c) => (
                <tr key={c.contractId}>
                  <td className="py-3 px-4 font-black text-[#1CB0F6]">{c.contractCode}<div className="text-[11px] text-[#AFAFAF]">{c.storageUnitId}</div></td>
                  <td className="py-3 px-4">{c.facilityName}</td>
                  <td className="py-3 px-4">{c.customerName}<div className="text-[11px] text-[#AFAFAF]">{c.customerPhone}</div></td>
                  <td className="py-3 px-4">{formatDate(c.endDate)}</td>
                  <td className="py-3 px-4">{c.overdueDays} ngày</td>
                  <td className="py-3 px-4">{c.lateFeeWaived ? <span className="text-[#58A700]">Đã miễn</span> : formatVND(c.lateFeeAmount)}</td>
                  <td className="py-3 px-4">{c.overstayFeeWaived ? <span className="text-[#58A700]">Đã miễn</span> : formatVND(c.overstayFeeAmount)}</td>
                  <td className="py-3 px-4 text-right">
                    {c.lateFeeWaived ? (
                      <span className="text-[11px] text-[#AFAFAF]" title={c.lateFeeWaiverNote || ''}>Đã miễn</span>
                    ) : (
                      <button type="button" onClick={() => { setTarget(c); setFormError('') }} className="duo-btn-white px-3 py-1.5 text-xs">
                        Miễn phí trễ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setTarget(null)}>
          <div className="duo-card bg-white w-full max-w-[480px] p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-black text-[#4B4B4B]">Miễn phí trễ HĐ {target.contractCode}</h2>
            <p className="text-xs font-bold text-[#777777]">
              {target.facilityName} · quá hạn {target.overdueDays} ngày · phí trễ hiện tại {formatVND(target.lateFeeAmount)}
              {Number(target.overstayFeeAmount) > 0 && <> · phí chiếm dụng {formatVND(target.overstayFeeAmount)}</>}
            </p>
            <label className="flex items-start gap-2 text-xs font-bold text-[#4B4B4B] cursor-pointer">
              <input type="checkbox" checked={waiveOverstay} onChange={(e) => setWaiveOverstay(e.target.checked)} className="mt-0.5" />
              <span>
                Miễn luôn phí chiếm dụng
                <span className="block text-[11px] text-[#AFAFAF]">
                  Không chọn: phí chiếm dụng còn 100% giá ngày (tiền thuê những ngày khách đã dùng ô, bỏ phần phạt).
                </span>
              </span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do miễn (5–400 ký tự), vd: khách nằm viện, đã liên hệ và hứa gia hạn trong tuần"
              className="duo-input text-xs resize-none"
            />
            {formError && <p className="text-xs font-bold text-[#FF4B4B]">{formError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setTarget(null)} className="duo-btn-white px-4 py-2 text-xs">Huỷ</button>
              <button type="button" onClick={submit} disabled={busy || reason.trim().length < 5}
                className="duo-btn-green px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                Xác nhận miễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
