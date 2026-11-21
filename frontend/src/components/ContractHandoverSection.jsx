import { useEffect, useState } from 'react'
import { getHandoverRecords, getUnitTransfers, getCheckInHandoverHistory, decideCheckInHandover } from '../services/contractService'
import { HandoverRecordList, HandoverPhotoPicker } from './HandoverPhotos'

const REASON_LABELS = {
  FACILITY_ISSUE: 'Ô có sự cố do cơ sở',
  CUSTOMER_REQUEST: 'Khách yêu cầu',
  REARRANGE: 'Cơ sở sắp xếp lại',
}

const CHECKIN_EVIDENCE_LABELS = {
  identityVerified: 'Đối chiếu CCCD',
  unitChecked: 'Đã kiểm tra ô kho',
  unitEmpty: 'Ô trống (biên bản cũ)',
  unitClean: 'Ô sạch (biên bản cũ)',
  lockIntact: 'Khóa nguyên vẹn',
  goodsChecked: 'Hàng mang vào phù hợp',
  goodsValueVerified: 'Đối chiếu giá trị hàng',
}

const REJECTION_TYPE_LABELS = {
  UNIT_CONDITION: 'Ô kho / cơ sở không đạt',
  GOODS_VALUE: 'Không đồng ý giá trị hàng',
  GOODS_INFORMATION: 'Hàng hoặc chứng từ ghi nhận chưa đúng',
  OTHER: 'Lý do khác',
}

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// BR-121 + BR-122: biên bản nhận / trả kho kèm ảnh và lịch sử chuyển ô của 1 hợp đồng.
// reloadKey đổi → tải lại (vd sau khi chuyển ô)
export default function ContractHandoverSection({ contractId, reloadKey, customerCanDecide = false, onDecision }) {
  const [records, setRecords] = useState([])
  const [transfers, setTransfers] = useState([])
  const [attempts, setAttempts] = useState([])
  const [rejectionReason, setRejectionReason] = useState('')
  const [customerPhotos, setCustomerPhotos] = useState([])
  const [rejectionTypes, setRejectionTypes] = useState([])
  const [decisionError, setDecisionError] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!contractId) return
    let cancelled = false
    Promise.all([getHandoverRecords(contractId), getUnitTransfers(contractId), getCheckInHandoverHistory(contractId)])
      .then(([r, t, a]) => {
        if (cancelled) return
        setRecords(r || [])
        setTransfers(t || [])
        setAttempts(a || [])
        setError('')
      })
      .catch(err => !cancelled && setError(err.response?.data?.message || 'Không tải được biên bản bàn giao.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [contractId, reloadKey])

  const decide = async (attempt, accepted) => {
    setDeciding(true)
    setDecisionError('')
    try {
      await decideCheckInHandover(contractId, attempt.id, accepted, rejectionReason.trim(), accepted ? [] : customerPhotos, accepted ? [] : rejectionTypes)
      setAttempts(await getCheckInHandoverHistory(contractId))
      setRejectionReason('')
      setCustomerPhotos([])
      setRejectionTypes([])
      onDecision?.()
    } catch (err) {
      setDecisionError(err.response?.data?.message || 'Không ghi nhận được xác nhận. Vui lòng thử lại.')
    } finally {
      setDeciding(false)
    }
  }

  const pending = attempts[0]?.status === 'PENDING_CUSTOMER' ? attempts[0] : null

  const refreshAttempts = async () => {
    setRefreshing(true)
    try {
      setAttempts(await getCheckInHandoverHistory(contractId))
      setDecisionError('')
    } catch (err) {
      setDecisionError(err.response?.data?.message || 'Không tải được biên bản.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {customerCanDecide && <button type="button" onClick={refreshAttempts} disabled={refreshing}
        className="duo-btn-gray self-start px-3 py-1.5 text-xs">{refreshing ? 'Đang tải...' : 'Tải lại biên bản chờ xác nhận'}</button>}
      {customerCanDecide && pending && (
        <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#F0F9FF] p-4 flex flex-col gap-3">
          <h3 className="text-sm font-black text-[#0369A1]">Xác nhận nhận ô kho {pending.storage_unit_id}</h3>
            <p className="text-xs font-bold text-[#4B4B4B]">Hãy cùng nhân viên đến kiểm tra đúng ô kho trước khi chọn. Nhân viên đã ghi nhận ô trống, sạch, khóa nguyên vẹn và hàng phù hợp.</p>
          {pending.notes && <p className="text-xs text-[#4B4B4B]">Ghi chú: {pending.notes}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(CHECKIN_EVIDENCE_LABELS).map(([key, label]) => pending.checklistEvidence?.[key] && (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-[#4B4B4B]">{label}</span>
                <div className="flex flex-wrap gap-1">{(Array.isArray(pending.checklistEvidence[key]) ? pending.checklistEvidence[key] : [pending.checklistEvidence[key]]).map((src, i) =>
                  <img key={i} src={src} alt={`Ảnh ${label} ${i + 1}`} className="w-20 h-20 rounded-xl object-cover border" />)}</div>
              </div>
            ))}
          </div>
          {!pending.checklistEvidence && pending.evidenceImages?.length > 0 && <div className="flex flex-wrap gap-2">
            {pending.evidenceImages.map((src, i) => <img key={i} src={src} alt={`Ảnh biên bản cũ ${i + 1}`} className="w-24 h-24 rounded-xl object-cover border" />)}
          </div>}
          <div className="rounded-xl border-2 border-[#FFC800] bg-[#FFFBEA] p-3 text-xs text-[#4B4B4B]">
            <p className="font-black">Đối chiếu giá trị hàng</p>
            <p className="mt-1">Khách khai: <b>{Number(pending.declaredGoodsValue || 0).toLocaleString('vi-VN')}đ</b></p>
            <p>Staff ghi nhận: <b className="text-[#1CB0F6]">{Number(pending.assessedGoodsValue || 0).toLocaleString('vi-VN')}đ</b>
              {' '}({pending.goodsValueAssessment === 'ADJUSTED' ? 'đề xuất điều chỉnh' : 'khớp khai báo'})</p>
            {pending.goodsValueAssessmentNote && <p className="mt-1">Lý do: {pending.goodsValueAssessmentNote}</p>}
            {pending.goodsValueEvidenceImages?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">
              {pending.goodsValueEvidenceImages.map((src, i) => <img key={i} src={src} alt={`Chứng từ ${i + 1}`} className="h-16 w-16 rounded-lg border object-cover" />)}
            </div>}
          </div>
          <p className="text-xs font-bold text-[#4B4B4B]">Sau khi bạn đồng ý, nhân viên sẽ hoàn tất bàn giao và cấp PIN/RFID. Hợp đồng chưa kích hoạt ở bước xác nhận này.</p>
          {pending.acceptAllowed === false && <p className="text-xs font-bold text-[#D97706]">Biên bản chưa đủ điều kiện đồng ý (quá hạn hoặc thiếu ảnh từng mục). Bạn vẫn có thể từ chối và ghi lý do; quản lý sẽ hướng dẫn kiểm tra lại.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(REJECTION_TYPE_LABELS).map(([key, label]) => <label key={key}
              className={`rounded-xl border-2 px-3 py-2 text-xs font-bold cursor-pointer ${rejectionTypes.includes(key) ? 'border-[#FF4B4B] bg-[#FFF4F4]' : 'border-[#E5E5E5] bg-white'}`}>
              <input type="checkbox" className="mr-2 accent-[#FF4B4B]" checked={rejectionTypes.includes(key)}
                onChange={e => setRejectionTypes(prev => e.target.checked ? [...prev, key] : prev.filter(value => value !== key))} />
              {label}
            </label>)}
          </div>
          <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} maxLength={1000}
            placeholder="Nếu không đồng ý, nhập lý do cụ thể (ít nhất 5 ký tự)" className="duo-input text-xs" />
          <HandoverPhotoPicker images={customerPhotos} onChange={setCustomerPhotos}
            label="Ảnh khách ghi nhận (nếu từ chối)" hint="Có thể chụp chỗ còn đồ, bẩn hoặc hư hỏng." required={false} />
          {decisionError && <p className="text-xs font-bold text-[#FF4B4B]">{decisionError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={deciding || pending.acceptAllowed === false || rejectionTypes.length > 0} onClick={() => decide(pending, true)} className="duo-btn-green px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">Tôi đã kiểm tra và đồng ý nhận ô này</button>
            <button type="button" disabled={deciding || rejectionReason.trim().length < 5 || rejectionTypes.length === 0} onClick={() => decide(pending, false)} className="duo-btn-gray px-4 py-2 text-xs">Không đồng ý biên bản</button>
          </div>
        </div>
      )}
      {attempts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-black uppercase text-[#4B4B4B]">Lịch sử xác nhận bàn giao</h3>
          {attempts[0]?.status === 'ACCEPTED' && <p className="text-xs text-[#777777]">Bạn đã đồng ý nhận ô. Nhân viên đang hoàn tất bàn giao và cấp quyền truy cập.</p>}
          {attempts[0]?.status === 'REJECTED' && <p className="text-xs text-[#777777]">
            {attempts[0]?.facility_fault_confirmed
              ? 'Quản lý đã xác nhận lỗi cơ sở. Bạn có thể chọn dời lịch miễn phí hoặc hủy hoàn 100% tại trang Kho của tôi.'
              : 'Quản lý đang kiểm tra lý do từ chối. Hợp đồng chưa kích hoạt và bạn không bị tính là vắng mặt.'}
          </p>}
          {attempts.map(a => (
            <div key={a.id} className="rounded-xl border border-[#E5E5E5] p-3 text-xs text-[#4B4B4B]">
              <b>Ô {a.storage_unit_id}</b> · {a.status === 'ACCEPTED' ? 'Khách đồng ý' : a.status === 'REJECTED' ? 'Khách từ chối' : a.status === 'WITHDRAWN' ? 'Nhân viên đã hoàn tác' : a.status === 'PENDING_CUSTOMER' ? 'Chờ khách xác nhận' : 'Biên bản đã thay thế'}
              <span> · Nhân viên #{a.staff_id} lập lúc {formatDateTime(a.created_at)}</span>
              {a.decided_at && <span> · {formatDateTime(a.decided_at)}</span>}
              {a.notes && <p className="mt-1">Ghi chú biên bản: {a.notes}</p>}
              {a.rejection_reason && <p className="mt-1">Lý do: {a.rejection_reason}</p>}
              {a.rejectionTypes?.length > 0 && <p className="mt-1">Nội dung từ chối: {a.rejectionTypes.map(type => REJECTION_TYPE_LABELS[type] || type).join(', ')}</p>}
              {a.faultNote && <p className="mt-1">FM xác nhận lỗi cơ sở: {a.faultNote}{a.faultConfirmedAt && ` · ${formatDateTime(a.faultConfirmedAt)}`}</p>}
              {a.evidenceImages?.length > 0 && <div className="flex flex-wrap gap-2 mt-2">
                {a.evidenceImages.map((src, i) => <div key={i} className="flex flex-col gap-1">
                  <span>{Object.values(CHECKIN_EVIDENCE_LABELS)[i] || `Ảnh ${i + 1}`}</span>
                  <img src={src} alt={`Ảnh nhân viên ghi nhận ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border" />
                </div>)}
              </div>}
              {a.customerEvidenceImages?.length > 0 && <div className="flex flex-wrap gap-2 mt-2">
                {a.customerEvidenceImages.map((src, i) => <img key={i} src={src} alt={`Ảnh khách gửi ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border" />)}
              </div>}
              {a.resolutionNote && <div className="mt-2 rounded-xl border border-[#84D8FF] bg-[#F0F9FF] p-2">
                <p className="font-black">FM mở lại check-in{a.resolvedUnitId && ` · ô ${a.resolvedUnitId}`}{a.resolvedAt && ` · ${formatDateTime(a.resolvedAt)}`}</p>
                <p>{a.resolutionNote}</p>
                {a.resolutionEvidenceImages?.length > 0 && <div className="flex flex-wrap gap-2 mt-2">
                  {a.resolutionEvidenceImages.map((src, i) => <img key={i} src={src} alt={`Ảnh ô sau xử lý ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border" />)}
                </div>}
              </div>}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-[#58CC02]">fact_check</span>
          Biên bản bàn giao & ảnh hiện trạng
        </h3>
        <p className="text-[11px] font-bold text-[#AFAFAF]">
          Ảnh chụp lúc nhận và lúc trả kho là căn cứ xác định hư hỏng phát sinh trong thời gian thuê do ai gây ra.
        </p>
        {loading ? (
          <p className="text-xs font-bold text-[#AFAFAF]">Đang tải...</p>
        ) : error ? (
          <p className="text-xs font-bold text-[#FF4B4B]">{error}</p>
        ) : (
          <HandoverRecordList records={records} />
        )}
      </div>

      {transfers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#FF9600]">swap_horiz</span>
            Lịch sử chuyển ô
          </h3>
          <ul className="flex flex-col gap-2">
            {transfers.map(t => (
              <li key={t.id} className="rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs font-bold text-[#4B4B4B] flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{t.fromUnitId}</span>
                  <span className="material-symbols-outlined text-[16px] text-[#AFAFAF]">arrow_forward</span>
                  <span className="font-mono text-[#1CB0F6]">{t.toUnitId}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FFF0D6] text-[#D97706]">
                    {REASON_LABELS[t.reasonType] || t.reasonType}
                  </span>
                  <span className="text-[11px] text-[#AFAFAF] ml-auto">{formatDateTime(t.createdAt)}</span>
                </span>
                <span className="text-[#777777]">{t.reason}</span>
                {t.movedByName && <span className="text-[11px] text-[#AFAFAF]">Thực hiện: {t.movedByName}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
