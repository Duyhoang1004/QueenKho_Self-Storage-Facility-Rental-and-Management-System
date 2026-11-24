import { useEffect, useState } from 'react'
import { SETTLEMENT_STATUS } from '../utils/settlementStatus'
import {
  getSettlement, confirmSettlement, disputeSettlement, paySettlement, recordSettlementCash,
  adjustSettlement, keepSettlement, recheckSettlement, simulateSettlementAutoConfirm,
} from '../services/settlementService'
import { getFacilityStaff } from '../services/facilityStaffService'
import { confirmRefundReceipt, disputeRefundReceipt } from '../services/refundReceiptService'
import SimulationButton from './SimulationButton'
import MoneyBreakdownTable from './MoneyBreakdownTable'
import PaymentConfirmModal from './PaymentConfirmModal'

// D-21 (PR-O19 → PR-O23): bảng quyết toán trả kho dùng chung
//  - Khách: xác nhận kết thúc / đồng ý & thanh toán / không đồng ý
//  - Staff / FM: thu tiền mặt phần khách trả thêm
//  - FM: xử lý khiếu nại — sửa số tiền (chỉ giảm), giữ nguyên, giao nhân viên kiểm tra lại
// D-23 (PR-O29 → PR-O31): chờ hoàn tiền → khách xác nhận đã nhận mới tất toán; tách hoàn cọc / bồi thường;
//  đối chiếu với số tiền hoàn dự kiến lúc hẹn trả kho

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDate(val) {
  if (!val) return '—'
  const [y, m, d] = String(val).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function errMsg(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback
}

function MoneyRow({ label, value, sign, strong, hint }) {
  if (!strong && (!value || Number(value) === 0)) return null
  const color = sign === '-' ? 'text-[#FF4B4B]' : sign === '+' ? 'text-[#58A700]' : 'text-[#4B4B4B]'
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex flex-col">
        <span className={`text-sm ${strong ? 'font-black text-[#4B4B4B]' : 'font-bold text-[#777777]'}`}>{label}</span>
        {hint && <span className="text-[11px] text-[#AFAFAF]">{hint}</span>}
      </div>
      <span className={`text-sm font-black whitespace-nowrap ${color}`}>
        {sign && Number(value) > 0 ? `${sign} ` : ''}{formatVND(value)}
      </span>
    </div>
  )
}

// fallback: hiện khi hợp đồng chưa có bảng quyết toán (hợp đồng trả kho trước D-21)
// onLoaded(settlement | null): trang cha biết hợp đồng có bảng quyết toán chưa (D-23: ẩn khối tính tay cũ)
export default function SettlementPanel({ contractId, viewer, onChanged, onLoaded, highlight = false, fallback = null }) {
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState(null) // dispute | cash | adjust | keep | recheck
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [cashConfirmed, setCashConfirmed] = useState(false)
  const [adjustDamages, setAdjustDamages] = useState({})
  const [waiveLate, setWaiveLate] = useState(false)
  const [waiveOverstay, setWaiveOverstay] = useState(false)
  const [staffList, setStaffList] = useState([])
  const [staffId, setStaffId] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [payConfirm, setPayConfirm] = useState(false) // PR-B12: xác nhận số tiền trước khi chuyển VNPAY

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!contractId) return undefined
    let cancelled = false
    getSettlement(contractId)
      .then((data) => { if (!cancelled) { setS(data); setError('') } })
      .catch((err) => {
        if (cancelled) return
        if (err?.response?.status === 404) { setS(null); setError('') }
        else setError(errMsg(err, 'Không tải được quyết toán trả kho.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contractId, reloadKey])

  useEffect(() => {
    if (!loading && onLoaded) onLoaded(s)
  }, [s, loading, onLoaded])

  const load = () => setReloadKey((k) => k + 1)

  const openMode = (m) => {
    setMode(m)
    setError('')
    setNote('')
    setReason('')
    setCashConfirmed(false)
    if (m === 'adjust' && s) {
      const init = {}
      ;(s.damages || []).forEach((d) => { init[d.id] = { estimatedCost: d.estimatedCost, liableParty: d.liableParty } })
      setAdjustDamages(init)
      setWaiveLate(false)
      setWaiveOverstay(false)
    }
    if (m === 'recheck' && s?.facilityId && staffList.length === 0) {
      getFacilityStaff(s.facilityId).then((list) => setStaffList((list || []).filter((x) => x.status === 'ACTIVE'))).catch(() => {})
    }
  }

  const run = async (fn, successText) => {
    setBusy(true)
    setError('')
    try {
      const result = await fn()
      if (result?.payUrl) {
        window.location.href = result.payUrl
        return
      }
      setNotice(result?.message || successText)
      setMode(null)
      load()
      if (onChanged) onChanged(result)
    } catch (err) {
      setError(errMsg(err, 'Thao tác không thành công.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-5 text-sm font-bold text-[#AFAFAF]">Đang tải quyết toán trả kho...</div>
  }
  if (!s) {
    return error ? <div className="bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-2xl p-4 text-sm font-bold text-[#FF4B4B]">{error}</div> : fallback
  }

  const st = SETTLEMENT_STATUS[s.status] || SETTLEMENT_STATUS.WAITING_CUSTOMER
  const pays = Number(s.netAmount) < 0
  const isCustomer = viewer === 'CUSTOMER'
  const isManager = viewer === 'FACILITY_MANAGER'
  const isStaffSide = viewer === 'STAFF' || isManager

  const banner = (() => {
    switch (s.status) {
      case 'WAITING_CLAIM':
        return isCustomer
          ? 'Quản lý cơ sở đang chốt hồ sơ bồi thường hàng của bạn. Chốt xong, bảng quyết toán tự cộng tiền bồi thường — lúc đó bạn mới bấm được "Xác nhận" hoặc "Không đồng ý".'
          : 'Còn hồ sơ bồi thường đã kiểm tra hiện trường nhưng chưa chốt. Quản lý chốt ở màn Bồi thường hàng hoá rồi bảng sẽ tự tính lại.'
      case 'WAITING_CUSTOMER':
        return isCustomer
          ? (pays
            ? `Nhân viên đã nghiệm thu. Bạn cần thanh toán thêm ${formatVND(Math.abs(s.netAmount))} để kết thúc hợp đồng. Nếu chưa đồng ý với biên bản, hãy bấm "Không đồng ý".`
            : `Nhân viên đã nghiệm thu. Kiểm tra biên bản và số tiền: đồng ý thì bấm "Xác nhận", cơ sở sẽ lập lệnh hoàn ${formatVND(s.netAmount)} cho bạn. Chưa đồng ý thì bấm "Không đồng ý" ngay bây giờ — sau khi xác nhận, bạn chỉ còn phản hồi được việc đã nhận tiền hay chưa.${s.autoConfirmAt ? ` Nếu không phản hồi, hệ thống tự xác nhận lúc ${formatDateTime(s.autoConfirmAt)}.` : ''}`)
          : 'Đã nghiệm thu, đang chờ khách xác nhận trên tài khoản của khách. Hợp đồng chỉ kết thúc khi khách xác nhận.'
      case 'DISPUTED':
        return isCustomer
          ? 'Bạn đã gửi phản hồi không đồng ý. Quản lý cơ sở sẽ xem lại và gửi bảng quyết toán mới.'
          : 'Khách không đồng ý biên bản / quyết toán. Quản lý chọn: sửa số tiền, giữ nguyên kèm giải thích, hoặc giao nhân viên kiểm tra lại ô.'
      case 'RECHECKING':
        return isCustomer
          ? 'Nhân viên đang kiểm tra lại ô theo phản hồi của bạn. Bảng quyết toán mới sẽ được gửi sau khi kiểm tra.'
          : `Đã giao kiểm tra lại${s.recheckTaskId ? ` (task #${s.recheckTaskId})` : ''}. Nhân viên lập lại danh sách sự cố trong task nghiệm thu.`
      case 'AWAITING_PAYMENT':
        return isCustomer
          ? `Bạn đã đồng ý quyết toán. Thanh toán ${formatVND(Math.abs(s.netAmount))} qua VNPAY hoặc tiền mặt tại quầy để kết thúc hợp đồng. Trong thời gian này bạn chưa đặt được kho mới.`
          : `Khách đã đồng ý, chờ thanh toán ${formatVND(Math.abs(s.netAmount))}. Khách có thể trả VNPAY trên tài khoản, hoặc thu tiền mặt tại quầy.`
      case 'REFUNDING':
        if (s.refundReceiptStatus === 'DISPUTED') {
          return isCustomer
            ? `Bạn đã báo chưa nhận được tiền${s.refundDisputeReason ? ` ("${s.refundDisputeReason}")` : ''}. Quản lý cơ sở đang kiểm tra lại giao dịch.`
            : `Khách báo chưa nhận được tiền hoàn${s.refundDisputeReason ? `: "${s.refundDisputeReason}"` : ''}. Quản lý kiểm tra giao dịch / chuyển bổ sung trong task hoàn tiền.`
        }
        return isCustomer
          ? `Bạn đã xác nhận quyết toán. Quản lý cơ sở sẽ hoàn ${formatVND(s.netAmount)} trong 24 giờ làm việc. Hợp đồng kết thúc khi bạn xác nhận đã nhận tiền.`
          : `Khách đã xác nhận quyết toán. Quản lý cần chi ${formatVND(s.netAmount)} trong task hoàn tiền${s.refundTaskId ? ` #${s.refundTaskId}` : ''}; hợp đồng chỉ kết thúc khi khách xác nhận đã nhận.`
      case 'REFUND_SENT':
        return isCustomer
          ? `Quản lý cơ sở đã hoàn ${formatVND(s.netAmount)}${s.refundSentAt ? ` lúc ${formatDateTime(s.refundSentAt)}` : ''}. Kiểm tra tài khoản / tiền mặt rồi bấm "Đã nhận được" để kết thúc hợp đồng, hoặc "Chưa nhận được" nếu có vấn đề.${s.refundReceiptAutoConfirmAt ? ` Không phản hồi, hệ thống tự xác nhận lúc ${formatDateTime(s.refundReceiptAutoConfirmAt)}.` : ''}`
          : `Đã chi tiền, chờ khách xác nhận đã nhận${s.refundReceiptAutoConfirmAt ? ` (tự xác nhận lúc ${formatDateTime(s.refundReceiptAutoConfirmAt)})` : ''}.`
      case 'COMPLETED':
        if (s.refundTaskId && !pays) {
          return `Khách đã nhận tiền hoàn${s.refundReceiptStatus === 'AUTO_CONFIRMED' ? ' (tự xác nhận sau 3 ngày)' : ''}. Hợp đồng đã kết thúc.`
        }
        return s.autoConfirmed
          ? 'Hệ thống đã tự xác nhận quyết toán sau 3 ngày khách không phản hồi. Hợp đồng đã kết thúc.'
          : `Khách đã xác nhận${s.customerConfirmedAt ? ` lúc ${formatDateTime(s.customerConfirmedAt)}` : ''}. Hợp đồng đã kết thúc.`
      default:
        return ''
    }
  })()

  return (
    <div className={`bg-white border-2 rounded-2xl p-5 flex flex-col gap-4 ${highlight ? 'border-[#1CB0F6] shadow-[0_0_0_4px_#DDF4FF]' : 'border-[#E5E5E5]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Quyết toán trả kho · vòng {s.roundNo}</p>
          <h3 className="text-lg font-black text-[#4B4B4B]">
            {s.contractCode} · ô {s.unitId || '—'}
          </h3>
          <p className="text-xs font-bold text-[#777777]">Nghiệm thu ngày {formatDate(s.checkoutDate)}{!isCustomer && s.customerName ? ` · Khách ${s.customerName}${s.customerPhone ? ` (${s.customerPhone})` : ''}` : ''}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-xl border-2 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${st.cls}`}>
          <span className="material-symbols-outlined text-[16px]">{st.icon}</span>{st.label}
        </span>
      </div>

      {banner && (
        <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-xl p-3 text-xs font-bold text-[#4B4B4B] leading-relaxed">{banner}</div>
      )}
      {notice && <div className="bg-[#D7FFB8] border-2 border-[#58CC02] rounded-xl p-3 text-xs font-black text-[#58A700]">{notice}</div>}

      {/* Bảng tiền (PR-O19) — D-22: cùng bố cục "Đã đóng − Giữ lại = Hoàn" với màn hẹn trả kho */}
      {s.lines?.length > 0 ? (
        <MoneyBreakdownTable lines={s.lines} viewer={isCustomer ? 'CUSTOMER' : 'STAFF'} />
      ) : (
        <div className="border-2 border-[#E5E5E5] rounded-xl px-4 py-2 divide-y divide-[#F0F0F0]">
          <MoneyRow label="Tiền cọc đang giữ" value={s.depositHeld} sign="+" strong />
          <MoneyRow label="Phí sự cố lỗi khách" value={s.damageFee} sign="-" />
          <MoneyRow label="Phí trễ hạn" value={s.lateFee} sign="-" hint="Chỉ trừ trong phần cọc còn lại" />
          <MoneyRow label="Phí chiếm dụng ô" value={s.overstayFee} sign="-" />
          <MoneyRow label="Hoàn tiền thuê (trả sớm)" value={s.rentRefund} sign="+" />
          <MoneyRow label="Bồi thường hàng hư / mất" value={s.compensationAmount} sign="+" />
          <div className="flex items-center justify-between pt-2.5 pb-1">
            <span className="text-sm font-black text-[#4B4B4B] uppercase">{pays ? (isCustomer ? 'Bạn cần trả thêm' : 'Khách cần trả thêm') : (isCustomer ? 'Cơ sở hoàn cho bạn' : 'Cơ sở hoàn khách')}</span>
            <span className={`text-xl font-black ${pays ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>{formatVND(Math.abs(Number(s.netAmount)))}</span>
          </div>
        </div>
      )}
      {!pays && s.refundMethod && (
        <p className="text-[11px] font-bold text-[#AFAFAF] -mt-2">Nhận tiền: {s.refundMethod === 'CASH' ? 'tiền mặt tại quầy' : 'chuyển khoản (tài khoản đã khai khi hẹn trả kho)'}</p>
      )}

      {/* D-23 / PR-O31: đối chiếu với số tiền hoàn dự kiến khách thấy lúc hẹn trả kho */}
      {s.expectedNet != null && (
        <div className="border-2 border-[#E5E5E5] rounded-xl p-3 flex flex-col gap-1.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Đối chiếu với lúc hẹn trả kho</p>
          <div className="flex justify-between gap-3 text-sm font-bold text-[#4B4B4B]">
            <span>Dự kiến lúc hẹn ({formatDate(s.scheduledCheckoutDate)})</span>
            <span className="font-black whitespace-nowrap">{Number(s.expectedNet) < 0 ? 'Trả thêm ' : 'Hoàn '}{formatVND(Math.abs(Number(s.expectedNet)))}</span>
          </div>
          {(s.reconcile || []).map((r, i) => (
            <div key={i} className="flex justify-between gap-3 text-xs">
              <span className="flex flex-col">
                <span className="font-bold text-[#777777]">{r.label}</span>
                {r.note && <span className="text-[11px] text-[#AFAFAF]">{r.note}</span>}
              </span>
              <span className={`font-black whitespace-nowrap ${Number(r.amount) < 0 ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
                {Number(r.amount) < 0 ? '− ' : '+ '}{formatVND(Math.abs(Number(r.amount)))}
              </span>
            </div>
          ))}
          {(s.reconcile || []).length === 0 && <p className="text-xs font-bold text-[#58A700]">Không chênh lệch — đúng số đã thấy lúc hẹn trả kho.</p>}
          <div className="flex justify-between gap-3 text-sm font-black text-[#4B4B4B] border-t-2 border-[#F0F0F0] pt-1.5">
            <span>Quyết toán</span>
            <span className={pays ? 'text-[#FF4B4B]' : 'text-[#58A700]'}>{pays ? 'Trả thêm ' : 'Hoàn '}{formatVND(Math.abs(Number(s.netAmount)))}</span>
          </div>
        </div>
      )}

      {/* D-23 / PR-O30: khoản hoàn gồm những gì (task hoàn tiền của FM chi đúng các dòng này) */}
      {!pays && Number(s.compensationAmount) > 0 && s.refundPayout != null && (
        <div className="border-2 border-[#E5E5E5] rounded-xl px-4 py-2 divide-y divide-[#F0F0F0]">
          <MoneyRow label="Hoàn cọc + tiền thuê" value={s.refundPayout} strong />
          <MoneyRow label="Bồi thường hàng hư / mất" value={s.compensationPayout} strong
            hint={Number(s.compensationPayout) < Number(s.compensationAmount)
              ? `Đã cấn trừ ${formatVND(Number(s.compensationAmount) - Number(s.compensationPayout))} vào phí vượt cọc` : 'Chi cùng lệnh hoàn tiền trả kho'} />
        </div>
      )}

      {/* Sự cố (UC-24) */}
      {(s.damages || []).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Sự cố ghi nhận khi nghiệm thu</p>
          {s.damages.map((d) => (
            <div key={d.id} className="border-2 border-[#F0F0F0] rounded-xl p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-black text-[#4B4B4B]">{d.title}</span>
                <span className="text-xs font-black">
                  <span className={d.liableParty === 'CUSTOMER' ? 'text-[#FF4B4B]' : 'text-[#1CB0F6]'}>{d.liableParty === 'CUSTOMER' ? 'Lỗi khách' : 'Lỗi cơ sở'}</span>
                  {' · '}{formatVND(d.estimatedCost)}
                </span>
              </div>
              {d.description && <p className="text-xs text-[#777777]">{d.description}</p>}
              {(d.evidenceImages || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {d.evidenceImages.map((img, i) => (
                    <a key={i} href={img} target="_blank" rel="noreferrer">
                      <img src={img} alt={`Ảnh sự cố ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border-2 border-[#E5E5E5]" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hồ sơ bồi thường (BR-126 → BR-128) */}
      {(s.claims || []).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Hồ sơ bồi thường hàng</p>
          {/* PR-O19c (24/11/2026): tiền đền bù là khoản riêng — chỉ bảng cũ (trước 24/11) mới cộng vào quyết toán */}
          {s.claims.some((c) => !c.includedInSettlement && ['APPROVED', 'PAID'].includes(c.status)) && (
            <p className="text-[11px] font-bold text-[#A560E8]">
              Tiền đền bù là khoản riêng, không nằm trong bảng quyết toán này — quản lý cơ sở chi riêng theo hồ sơ.
            </p>
          )}
          {s.claims.map((c) => (
            <div key={c.id} className="flex flex-wrap justify-between gap-2 text-xs font-bold text-[#4B4B4B] border-2 border-[#F0F0F0] rounded-xl px-3 py-2">
              <span className="font-mono">{c.claimCode} · {c.claimType === 'GOODS_LOSS' ? 'Mất hàng' : 'Hư hàng'}</span>
              <span>{{ INSPECTED: 'Chờ quản lý chốt', APPROVED: c.includedInSettlement ? 'Đã duyệt · trong quyết toán' : 'Đã duyệt · chờ chi riêng', PAID: 'Đã chi trả', REJECTED: 'Không bồi thường' }[c.status] || c.status}{c.totalCompensation ? ` · ${formatVND(c.totalCompensation)}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {(s.staffNote || s.managerNote || s.disputeReason) && (
        <div className="flex flex-col gap-1.5 text-xs text-[#4B4B4B]">
          {s.disputeReason && <p><span className="font-black text-[#FF4B4B]">Khách phản hồi:</span> {s.disputeReason}</p>}
          {s.staffNote && <p><span className="font-black">Nhân viên:</span> {s.staffNote}</p>}
          {s.managerNote && <p><span className="font-black">Quản lý cơ sở:</span> {s.managerNote}</p>}
        </div>
      )}

      {(s.history || []).length > 0 && (
        <div>
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs font-black text-[#1CB0F6] cursor-pointer">
            {showHistory ? 'Ẩn' : 'Xem'} các vòng trước ({s.history.length})
          </button>
          {showHistory && (
            <div className="mt-2 flex flex-col gap-2">
              {s.history.map((h) => (
                <div key={h.id} className="border-2 border-[#F0F0F0] rounded-xl p-3 text-xs text-[#4B4B4B] flex flex-col gap-1">
                  <div className="flex justify-between font-black">
                    <span>Vòng {h.roundNo} · {formatDateTime(h.createdAt)}</span>
                    <span className={Number(h.netAmount) < 0 ? 'text-[#FF4B4B]' : 'text-[#58A700]'}>{Number(h.netAmount) < 0 ? 'Khách trả ' : 'Hoàn '}{formatVND(Math.abs(Number(h.netAmount)))}</span>
                  </div>
                  {h.disputeReason && <p><span className="font-black">Khách:</span> {h.disputeReason}</p>}
                  {h.staffNote && <p><span className="font-black">Nhân viên:</span> {h.staffNote}</p>}
                  {h.managerNote && <p><span className="font-black">Quản lý:</span> {h.managerNote}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-xl p-3 text-xs font-black text-[#FF4B4B]">{error}</div>}

      {/* ===== Hành động của khách (PR-O20 → PR-O22) ===== */}
      {isCustomer && s.canConfirm && mode !== 'dispute' && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (pays) { setPayConfirm(true); return } // PR-B12: phần âm → modal xác nhận số tiền
              const text = `Xác nhận quyết toán hợp đồng ${s.contractCode}? Cơ sở sẽ lập lệnh hoàn ${formatVND(s.netAmount)}; hợp đồng kết thúc khi bạn xác nhận đã nhận tiền.`
              if (window.confirm(text)) run(() => confirmSettlement(s.contractId), 'Đã xác nhận quyết toán.')
            }}
            className="duo-btn-green px-5 py-3 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">{pays ? 'payments' : 'task_alt'}</span>
            {pays ? `Đồng ý & thanh toán ${formatVND(Math.abs(s.netAmount))}` : 'Xác nhận quyết toán'}
          </button>
          <button type="button" disabled={busy} onClick={() => openMode('dispute')} className="duo-btn-white px-5 py-3 text-xs uppercase tracking-wider cursor-pointer">
            Không đồng ý
          </button>
          {!pays && (
            <SimulationButton
              label="Quá 3 ngày — tự xác nhận"
              description="Lùi thời điểm nghiệm thu 3 ngày và chạy ngay bước tự xác nhận quyết toán (PR-O23)."
              onRun={() => simulateSettlementAutoConfirm(s.contractId)}
              onDone={() => { load(); if (onChanged) onChanged() }}
            />
          )}
        </div>
      )}
      {isCustomer && mode === 'dispute' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black text-[#4B4B4B]">Lý do không đồng ý (10–500 ký tự)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
            placeholder="Ví dụ: vết trầy ở vách đã có từ lúc nhận kho, xem ảnh biên bản nhận kho"
            className="border-2 border-[#E5E5E5] rounded-xl p-3 text-sm font-bold focus:border-[#1CB0F6] outline-none" />
          <div className="flex gap-3">
            <button type="button" disabled={busy || reason.trim().length < 10}
              onClick={() => run(() => disputeSettlement(s.contractId, reason.trim()), 'Đã gửi phản hồi cho quản lý cơ sở.')}
              className="duo-btn-red px-5 py-3 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60">Gửi phản hồi</button>
            <button type="button" onClick={() => setMode(null)} className="duo-btn-gray px-5 py-3 text-xs uppercase cursor-pointer">Huỷ</button>
          </div>
        </div>
      )}
      {isCustomer && s.canPay && (
        <button type="button" disabled={busy}
          onClick={() => setPayConfirm(true)}
          className="duo-btn-orange px-5 py-3 text-xs uppercase tracking-wider flex items-center gap-1.5 self-start cursor-pointer disabled:opacity-60">
          <span className="material-symbols-outlined text-[18px]">payments</span>
          Thanh toán {formatVND(Math.abs(s.netAmount))} qua VNPAY
        </button>
      )}

      {/* ===== D-23 / PR-O29: khách xác nhận đã nhận tiền hoàn ===== */}
      {isCustomer && s.canConfirmReceipt && mode !== 'receiptDispute' && (
        <div className="flex flex-col gap-2">
          {s.refundEvidenceUrl && (
            <a href={s.refundEvidenceUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-[#1CB0F6]">Xem chứng từ hoàn tiền</a>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy}
              onClick={() => {
                if (window.confirm(`Xác nhận đã nhận đủ ${formatVND(s.netAmount)}? Hợp đồng ${s.contractCode} sẽ kết thúc.`)) {
                  run(() => confirmRefundReceipt(s.refundTaskId), 'Đã xác nhận nhận tiền. Hợp đồng đã kết thúc.')
                }
              }}
              className="duo-btn-green px-5 py-3 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
              <span className="material-symbols-outlined text-[18px]">task_alt</span>Đã nhận được
            </button>
            <button type="button" disabled={busy} onClick={() => openMode('receiptDispute')} className="duo-btn-white px-5 py-3 text-xs uppercase tracking-wider cursor-pointer">
              Chưa nhận được
            </button>
          </div>
        </div>
      )}
      {isCustomer && mode === 'receiptDispute' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black text-[#4B4B4B]">Vấn đề khi nhận tiền (10–500 ký tự)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
            placeholder="Ví dụ: chưa thấy tiền về tài khoản, số tiền thiếu, sai số tài khoản"
            className="border-2 border-[#E5E5E5] rounded-xl p-3 text-sm font-bold focus:border-[#1CB0F6] outline-none" />
          <div className="flex gap-3">
            <button type="button" disabled={busy || reason.trim().length < 10}
              onClick={() => run(() => disputeRefundReceipt(s.refundTaskId, reason.trim()), 'Đã báo quản lý cơ sở kiểm tra lại.')}
              className="duo-btn-red px-5 py-3 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60">Gửi phản hồi</button>
            <button type="button" onClick={() => setMode(null)} className="duo-btn-gray px-5 py-3 text-xs uppercase cursor-pointer">Huỷ</button>
          </div>
        </div>
      )}
      {isManager && s.refundTaskId && ['REFUNDING', 'REFUND_SENT'].includes(s.status) && (
        <a href={`/manager/refunds/${s.refundTaskId}`} className="duo-btn-blue px-4 py-2 text-xs self-start flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">currency_exchange</span>
          {s.status === 'REFUNDING' ? `Mở task hoàn tiền #${s.refundTaskId}` : `Xem task hoàn tiền #${s.refundTaskId}`}
        </a>
      )}

      {/* ===== Staff / FM thu tiền mặt (PR-O21) ===== */}
      {isStaffSide && s.status === 'AWAITING_PAYMENT' && (
        mode === 'cash' ? (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs font-black text-[#4B4B4B] cursor-pointer">
              <input type="checkbox" checked={cashConfirmed} onChange={(e) => setCashConfirmed(e.target.checked)} />
              Đã thu đủ {formatVND(Math.abs(s.netAmount))} tiền mặt, khách đã ký phiếu thu
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)"
              className="border-2 border-[#E5E5E5] rounded-xl p-2.5 text-sm font-bold outline-none focus:border-[#1CB0F6]" />
            <div className="flex gap-3">
              <button type="button" disabled={busy || !cashConfirmed}
                onClick={() => run(() => recordSettlementCash(s.contractId, { cashReceiptConfirmed: true, note }), 'Đã thu tiền, hợp đồng kết thúc.')}
                className="duo-btn-green px-5 py-3 text-xs uppercase cursor-pointer disabled:opacity-60">Xác nhận đã thu</button>
              <button type="button" onClick={() => setMode(null)} className="duo-btn-gray px-5 py-3 text-xs uppercase cursor-pointer">Huỷ</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => openMode('cash')} className="duo-btn-orange px-5 py-3 text-xs uppercase tracking-wider self-start cursor-pointer">
            Đã thu tiền mặt tại quầy
          </button>
        )
      )}

      {/* ===== FM xử lý khiếu nại (PR-O22) ===== */}
      {isManager && s.status === 'DISPUTED' && !mode && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => openMode('adjust')} className="duo-btn-blue px-4 py-2.5 text-xs uppercase cursor-pointer">Sửa số tiền</button>
          <button type="button" onClick={() => openMode('keep')} className="duo-btn-white px-4 py-2.5 text-xs uppercase cursor-pointer">Giữ nguyên</button>
          <button type="button" onClick={() => openMode('recheck')} className="duo-btn-orange px-4 py-2.5 text-xs uppercase cursor-pointer">Giao nhân viên kiểm tra lại</button>
        </div>
      )}
      {isManager && mode === 'adjust' && (
        <div className="flex flex-col gap-3 border-2 border-[#84D8FF] rounded-xl p-3">
          <p className="text-xs font-black text-[#1899D6]">Chỉ được giảm: hạ chi phí sự cố, chuyển lỗi khách → lỗi cơ sở, miễn phí trễ / phí chiếm dụng.</p>
          {(s.damages || []).map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-[#4B4B4B] flex-1 min-w-[140px]">{d.title}</span>
              <input type="number" min={0} max={d.estimatedCost}
                value={adjustDamages[d.id]?.estimatedCost ?? ''}
                onChange={(e) => setAdjustDamages((prev) => ({ ...prev, [d.id]: { ...prev[d.id], estimatedCost: e.target.value } }))}
                className="w-36 border-2 border-[#E5E5E5] rounded-lg p-2 text-sm font-bold outline-none focus:border-[#1CB0F6]" />
              <select value={adjustDamages[d.id]?.liableParty || d.liableParty}
                disabled={d.liableParty === 'FACILITY'}
                onChange={(e) => setAdjustDamages((prev) => ({ ...prev, [d.id]: { ...prev[d.id], liableParty: e.target.value } }))}
                className="border-2 border-[#E5E5E5] rounded-lg p-2 text-sm font-bold">
                <option value="CUSTOMER">Lỗi khách</option>
                <option value="FACILITY">Lỗi cơ sở</option>
              </select>
            </div>
          ))}
          {Number(s.lateFee) > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={waiveLate} onChange={(e) => setWaiveLate(e.target.checked)} />Miễn phí trễ {formatVND(s.lateFee)}</label>
          )}
          {Number(s.overstayFee) > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" checked={waiveOverstay} onChange={(e) => setWaiveOverstay(e.target.checked)} />Miễn phí chiếm dụng {formatVND(s.overstayFee)}</label>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Giải thích gửi khách (10–1000 ký tự)"
            className="border-2 border-[#E5E5E5] rounded-xl p-2.5 text-sm font-bold outline-none focus:border-[#1CB0F6]" />
          <div className="flex gap-3">
            <button type="button" disabled={busy || note.trim().length < 10}
              onClick={() => run(() => adjustSettlement(s.id, {
                damages: Object.entries(adjustDamages).map(([id, v]) => ({ damageCaseId: Number(id), estimatedCost: Number(v.estimatedCost), liableParty: v.liableParty })),
                waiveLateFee: waiveLate, waiveOverstayFee: waiveOverstay, note: note.trim(),
              }), 'Đã gửi bảng quyết toán mới cho khách.')}
              className="duo-btn-blue px-5 py-3 text-xs uppercase cursor-pointer disabled:opacity-60">Gửi bảng mới</button>
            <button type="button" onClick={() => setMode(null)} className="duo-btn-gray px-5 py-3 text-xs uppercase cursor-pointer">Huỷ</button>
          </div>
        </div>
      )}
      {isManager && (mode === 'keep' || mode === 'recheck') && (
        <div className="flex flex-col gap-3 border-2 border-[#E5E5E5] rounded-xl p-3">
          {mode === 'recheck' && (
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="border-2 border-[#E5E5E5] rounded-lg p-2 text-sm font-bold">
              <option value="">Để nhân viên tự nhận việc</option>
              {staffList.map((x) => <option key={x.id} value={x.id}>{x.fullName}{x.activeTasksCount != null ? ` (${x.activeTasksCount} việc)` : ''}</option>)}
            </select>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder={mode === 'keep' ? 'Giải thích vì sao giữ nguyên (10–1000 ký tự)' : 'Cần kiểm tra lại điều gì (10–1000 ký tự)'}
            className="border-2 border-[#E5E5E5] rounded-xl p-2.5 text-sm font-bold outline-none focus:border-[#1CB0F6]" />
          <div className="flex gap-3">
            <button type="button" disabled={busy || note.trim().length < 10}
              onClick={() => run(() => (mode === 'keep'
                ? keepSettlement(s.id, note.trim())
                : recheckSettlement(s.id, note.trim(), staffId ? Number(staffId) : null)),
              mode === 'keep' ? 'Đã gửi lại bảng quyết toán cho khách.' : 'Đã giao nhân viên kiểm tra lại.')}
              className="duo-btn-green px-5 py-3 text-xs uppercase cursor-pointer disabled:opacity-60">{mode === 'keep' ? 'Gửi khách' : 'Giao việc'}</button>
            <button type="button" onClick={() => setMode(null)} className="duo-btn-gray px-5 py-3 text-xs uppercase cursor-pointer">Huỷ</button>
          </div>
        </div>
      )}
      <PaymentConfirmModal
        open={payConfirm}
        title={s.canConfirm ? 'Đồng ý quyết toán & thanh toán' : 'Thanh toán phần còn thiếu'}
        subtitle={`Hợp đồng ${s.contractCode}`}
        lines={(s.lines || []).filter((l) => l.group === 'KEPT').map((l) => ({ label: l.label, amount: l.amount, note: l.note }))}
        total={Math.abs(Number(s.netAmount))}
        note={`Phần cơ sở giữ lại vượt số bạn đã đóng ${formatVND(Math.abs(Number(s.netAmount)))}. Thanh toán xong hợp đồng mới kết thúc.`}
        submitting={busy}
        onConfirm={() => { setPayConfirm(false); run(() => (s.canConfirm ? confirmSettlement(s.contractId) : paySettlement(s.contractId))) }}
        onCancel={() => setPayConfirm(false)}
      />
    </div>
  )
}
