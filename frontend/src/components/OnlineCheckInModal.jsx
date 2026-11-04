import { useState } from 'react'
import { onlineCheckIn } from '../services/contractService'
import { HandoverPhotoPicker } from './HandoverPhotos'

const CHECKS = [
  { key: 'unitEmpty', label: 'Ô kho trống', hint: 'Không còn đồ của người thuê trước' },
  { key: 'unitClean', label: 'Ô kho sạch', hint: 'Không bụi bẩn, ẩm mốc, côn trùng' },
  { key: 'lockIntact', label: 'Khoá và cửa nguyên vẹn', hint: 'Cửa đóng kín, khoá SmartLock hoạt động' },
  {
    key: 'prohibitedGoodsCommitted',
    label: 'Cam kết không lưu hàng cấm',
    hint: 'Không chất cháy nổ, vũ khí, hoá chất độc hại, động vật sống, hàng dễ phân huỷ và hàng cấm theo pháp luật',
  },
]

const EMPTY_CHECKS = { unitEmpty: false, unitClean: false, lockIntact: false, prohibitedGoodsCommitted: false }

// BR-124: khách tới ô đúng ngày hẹn, tự check-in thay vì chờ nhân viên ở quầy
export default function OnlineCheckInModal({ open, contract, onClose, onDone }) {
  const [cccd, setCccd] = useState('')
  const [checks, setChecks] = useState(EMPTY_CHECKS)
  const [photos, setPhotos] = useState([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open || !contract) return null

  const allChecked = CHECKS.every(c => checks[c.key])
  const canSubmit = cccd.trim().length >= 9 && allChecked && photos.length > 0 && notes.length <= 500 && !submitting

  const submit = () => {
    setSubmitting(true)
    setError('')
    onlineCheckIn(contract.contractId || contract.id, { cccd: cccd.trim(), ...checks, evidenceImages: photos, notes })
      .then(() => {
        setCccd('')
        setChecks(EMPTY_CHECKS)
        setPhotos([])
        setNotes('')
        onDone?.()
      })
      .catch(err => setError(err.response?.data?.message || 'Check-in online thất bại, vui lòng thử lại.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div className="duo-card bg-white w-full max-w-[600px] max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">qr_code_scanner</span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#4B4B4B]">Check-in online</h2>
            <p className="text-[11px] font-bold text-[#AFAFAF]">
              Ô {contract.storageUnitId} · tự nhận kho tại cơ sở, không cần chờ nhân viên
            </p>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Số CCCD (xác minh danh tính) *</span>
            <input
              type="text"
              inputMode="numeric"
              value={cccd}
              onChange={e => setCccd(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="Nhập đúng số CCCD đã khai khi đặt kho"
              className="duo-input font-mono font-bold"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Tự kiểm tra ô kho *</span>
            {CHECKS.map(c => (
              <label
                key={c.key}
                className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer select-none ${
                  checks[c.key] ? 'bg-[#D7FFB8] border-[#58CC02]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checks[c.key]}
                  onChange={e => setChecks(prev => ({ ...prev, [c.key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-[#58CC02]"
                />
                <span className="flex flex-col">
                  <span className="text-xs font-black text-[#4B4B4B]">{c.label}</span>
                  <span className="text-[11px] font-bold text-[#AFAFAF]">{c.hint}</span>
                </span>
              </label>
            ))}
            <p className="text-[11px] font-bold text-[#FF9600]">
              Ô chưa trống / chưa sạch / khoá có vấn đề → đừng tự nhận, hãy báo nhân viên tại quầy để được đổi ô.
            </p>
          </div>

          <HandoverPhotoPicker
            images={photos}
            onChange={setPhotos}
            label="Ảnh hiện trạng ô lúc nhận"
            hint="Chụp toàn cảnh bên trong ô, cửa và khoá. Ảnh này bảo vệ bạn: hư hỏng có sẵn sẽ không bị tính khi trả kho."
            mockLabel={`Hiện trạng ô ${contract.storageUnitId || ''} lúc khách nhận`}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ghi chú (tuỳ chọn)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="VD: vết xước nhỏ ở cửa có sẵn từ trước"
              className="duo-input resize-none text-xs"
            />
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
            className="duo-btn-green px-5 py-2.5 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            {submitting ? 'Đang xử lý...' : 'Xác nhận nhận kho'}
          </button>
        </div>
      </div>
    </div>
  )
}
