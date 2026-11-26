import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import TaskBoard from '../../components/TaskBoard'
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback'
import { assignStaffTask, unassignStaffTask, completeRefundTask, extendOverdueTask, uploadImageFile, getStaffTasks } from '../../services/staffTaskService'
import { rescheduleReservation } from '../../services/reservationService'
import { getFacilityStaff } from '../../services/facilityStaffService'
import { assignLockedUntil } from '../../utils/taskWindow'
import DateInput from '../../components/DateInput'
import { parseRefundNote } from '../../utils/refundParser'

// D-22 / PR-O25: khách xác nhận đã nhận tiền hoàn
const RECEIPT_LABELS = {
  WAITING_CUSTOMER: { label: 'Chờ khách xác nhận', cls: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]' },
  CONFIRMED: { label: 'Khách đã nhận', cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  AUTO_CONFIRMED: { label: 'Tự xác nhận', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' },
  DISPUTED: { label: 'Khách báo chưa nhận', cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FFB8B8]' },
}
const TASK_TYPE_LABELS = { CHECK_IN: 'Bàn giao (check-in)', CHECK_OUT: 'Nghiệm thu trả kho', SUPPORT: 'Hỗ trợ khách', MAINTENANCE: 'Bảo trì ô kho' }

const vnd = n => `${Number(n || 0).toLocaleString('vi-VN')} ₫`

function MoneyRow({ label, amount, sign, tone = 'text-[#4B4B4B]', sub }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${sub ? 'pl-3 text-[11px] text-[#777777]' : ''}`}>
      <span className={sub ? 'font-bold' : 'font-bold text-[#777777]'}>{label}</span>
      <span className={`font-black whitespace-nowrap ${tone}`}>{sign}{vnd(amount)}</span>
    </div>
  )
}

// Góp ý test 13/11: ghi chú hoàn tiền BE ghép một dòng ("… | Cọc gốc … => Cọc hoàn … + … => THỰC HOÀN …") —
// tách thành bảng tiền + khối nhận tiền cho FM dễ đối chiếu trước khi chuyển khoản
function RefundBreakdown({ note }) {
  const [showRaw, setShowRaw] = useState(false)
  if (!note) {
    return <p className="text-xs font-bold text-[#AFAFAF]">Không có ghi chú chi tiết</p>
  }
  const p = parseRefundNote(note)
  const hasMoney = p.refundAmountNum > 0 || p.originalTotalNum > 0

  return (
    <div className="flex flex-col gap-3 text-xs">
      {(p.orderCode || p.unitId) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-[#F3E8FF] text-[#805AD5] text-[10px] font-black uppercase">
            {p.isCheckout ? 'Hoàn tiền trả kho' : 'Hoàn tiền huỷ đơn'}
          </span>
          {p.orderCode && <span className="font-black text-[#4B4B4B]">{p.isCheckout ? 'HĐ' : 'Đơn'} {p.orderCode}</span>}
          {p.unitId && <span className="font-bold text-[#777777]">· Ô {p.unitId}</span>}
          {p.customerName && <span className="font-bold text-[#777777]">· {p.customerName}</span>}
        </div>
      )}

      {hasMoney && (
        <div className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] p-3 flex flex-col gap-1.5">
          {p.isCheckout ? (
            <>
              <MoneyRow label="Cọc gốc" amount={p.originalTotalNum} />
              {p.penaltyAmountNum > 0 && <MoneyRow sub label="• Phí hư hại khoang" amount={p.penaltyAmountNum} sign="− " tone="text-[#FF4B4B]" />}
              {p.lateFeeNum > 0 && <MoneyRow sub label={`• Phí trễ${p.overdueDays ? ` (${p.overdueDays} ngày)` : ''}`} amount={p.lateFeeNum} sign="− " tone="text-[#FF4B4B]" />}
              {p.overstayFeeNum > 0 && <MoneyRow sub label="• Phí chiếm dụng ô" amount={p.overstayFeeNum} sign="− " tone="text-[#FF4B4B]" />}
              {p.depositRefundNum != null && <MoneyRow label="Cọc hoàn lại" amount={p.depositRefundNum} sign="+ " tone="text-[#1CB0F6]" />}
              {p.earlyRentRefundNum > 0 && (
                <>
                  <MoneyRow label="Hoàn tiền thuê trả sớm" amount={p.earlyRentRefundNum} sign="+ " tone="text-[#58A700]" />
                  {p.rentPaidNum > 0 && <MoneyRow sub label={`• Đã trả ${p.rentPaidMonths} tháng`} amount={p.rentPaidNum} />}
                  {p.usedCostNum > 0 && <MoneyRow sub label={`• Đã dùng ${p.usedMonths} tháng`} amount={p.usedCostNum} sign="− " />}
                  {p.breakFeeNum > 0 && <MoneyRow sub label="• Phí huỷ hợp đồng sớm" amount={p.breakFeeNum} sign="− " />}
                </>
              )}
            </>
          ) : (
            p.penaltyAmountNum > 0 && <MoneyRow label="Phí huỷ đã trừ" amount={p.penaltyAmountNum} sign="− " tone="text-[#FF4B4B]" />
          )}
          <div className="mt-1 pt-2 border-t-2 border-dashed border-[#D9D9D9] flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-black uppercase text-[#4B4B4B]">Thực hoàn cho khách</span>
            <span className="text-lg font-black text-[#58A700] whitespace-nowrap">{vnd(p.refundAmountNum)}</span>
          </div>
          {p.excessDebtNum > 0 && (
            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[#FFDFDF] px-2 py-1">
              <span className="text-[11px] font-black text-[#C53030]">Nợ vượt cọc cần truy thu</span>
              <span className="font-black text-[#C53030] whitespace-nowrap">{vnd(p.excessDebtNum)}</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border-2 border-[#84D8FF] bg-[#DDF4FF] p-3 flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase text-[#1899D6]">
          {p.isCash ? 'Khách nhận tiền mặt tại quầy' : 'Chuyển khoản tới'}
        </span>
        {!p.isCash && (p.bankAccountNumber || p.bankName) ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-bold text-[#4B4B4B]">
            <span className="text-[#777777]">Ngân hàng</span><span>{p.bankName || '—'}</span>
            <span className="text-[#777777]">Số TK</span><span className="font-mono font-black">{p.bankAccountNumber || '—'}</span>
            <span className="text-[#777777]">Chủ TK</span><span className="uppercase">{p.bankAccountName || '—'}</span>
          </div>
        ) : !p.isCash ? (
          <span className="font-bold text-[#777777]">Chưa có thông tin tài khoản trong ghi chú.</span>
        ) : null}
      </div>

      {p.reason && (
        <p className="font-bold text-[#4B4B4B]"><span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Lý do:</span>{p.reason}</p>
      )}

      <button type="button" onClick={() => setShowRaw(v => !v)} className="self-start text-[11px] font-bold text-[#AFAFAF] hover:text-[#1CB0F6] underline">
        {showRaw ? 'Ẩn ghi chú gốc' : 'Xem ghi chú gốc'}
      </button>
      {showRaw && (
        <p className="rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] p-2.5 text-[11px] font-bold text-[#777777] break-words">{note}</p>
      )}
    </div>
  )
}

// Flow 5: chọn nhân viên ACTIVE cùng cơ sở để giao task — hiện số việc đang làm để chia việc đều
function AssignTaskModal({ task, facilityId, onClose, onAssigned }) {
  const [staffList, setStaffList] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getFacilityStaff(facilityId)
      .then((list) => { if (!cancelled) setStaffList(list || []) })
      .catch((err) => { if (!cancelled) setLoadError(err.response?.data?.message || 'Không tải được danh sách nhân viên.') })
    return () => { cancelled = true }
  }, [facilityId])

  const activeStaff = (staffList || [])
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => (a.activeTasksCount || 0) - (b.activeTasksCount || 0))

  const handleAssign = () => {
    if (!selectedId) {
      setError('Vui lòng chọn nhân viên nhận việc.')
      return
    }
    setSaving(true)
    setError('')
    assignStaffTask(task.id, selectedId)
      .then((updated) => onAssigned(updated))
      .catch((err) => {
        setError(err.response?.data?.message || 'Không giao được việc, vui lòng thử lại.')
        setSaving(false)
      })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="duo-card max-w-md w-full p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
          <div className="w-11 h-11 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700]">
            <span className="material-symbols-outlined text-[24px]">assignment_ind</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[#4B4B4B]">Giao việc task #{task.id}</h3>
            <p className="text-xs font-bold text-[#AFAFAF] truncate">
              {String(task.note || '').startsWith('[RECHECK]') ? 'Kiểm tra lại quyết toán' : (TASK_TYPE_LABELS[task.taskType] || task.taskType)} · {task.customerName || task.contractCode || ''}
              {task.staffName ? ` · đang do ${task.staffName} làm` : ''}
            </p>
          </div>
        </div>

        {!staffList && !loadError && <div className="h-32 rounded-xl bg-[#F7F7F7] animate-pulse" />}
        {loadError && <p className="text-xs font-bold text-[#FF4B4B]">{loadError}</p>}
        {staffList && activeStaff.length === 0 && (
          <p className="text-xs font-bold text-[#AFAFAF]">Cơ sở chưa có nhân viên đang hoạt động. Tạo nhân viên ở màn Quản lý nhân viên.</p>
        )}

        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto">
          {activeStaff.map((s) => {
            const isCurrent = task.staffId === s.id
            const selected = selectedId === s.id
            return (
              <button
                key={s.id}
                type="button"
                disabled={isCurrent}
                onClick={() => { setSelectedId(s.id); setError('') }}
                className={`flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                  selected ? 'border-[#58CC02] bg-[#F1FFE7]' : 'border-[#E5E5E5] hover:bg-[#F7F7F7]'
                } ${isCurrent ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#4B4B4B] truncate">{s.fullName}{isCurrent ? ' (đang phụ trách)' : ''}</p>
                  <p className="text-[11px] font-bold text-[#AFAFAF] truncate">{s.phone || s.email}</p>
                </div>
                <span className={`duo-badge border-2 shrink-0 ${s.activeTasksCount > 0 ? 'bg-[#FFF3B3] border-[#FFC800] text-[#B38F00]' : 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]'}`}>
                  {s.activeTasksCount || 0} việc đang làm
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
          <button onClick={onClose} disabled={saving} className="duo-btn-gray px-4 py-2.5 text-xs">Hủy</button>
          <button onClick={handleAssign} disabled={saving || !selectedId} className="duo-btn-green px-5 py-2.5 text-xs gap-1.5 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {saving ? 'Đang giao...' : 'Giao việc'}
          </button>
        </div>
      </div>
    </div>
  )
}

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function tomorrowIsoDate() {
  return isoDateAfter(1)
}

// PR-S4 mở rộng: hạn mới tối đa 7 ngày kể từ hôm nay (BE chặn tương tự)
const MAX_EXTEND_DAYS = 7

function isoDateAfter(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// UC-16: Manager theo dõi bảng công việc của cơ sở & quản lý task hoàn cọc trực tiếp
// UC-17: Manager gỡ nhân viên khỏi task đang xử lý → task về "Chờ nhận" cho người khác nhận
// UC-25: Manager theo dõi và xử lý các task hoàn cọc (REFUND) của cơ sở mình
// UC-27 / PR-S4: Manager gia hạn task SUPPORT đã quá hạn (giữ nguyên người nhận)
export default function ManagerTaskBoardPage({ initialTypeFilter = 'ALL' }) {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')

  // Phân chia góc nhìn: ALL (Toàn bộ việc cơ sở — để giao việc, Flow 5) vs MINE (việc giao cho chính Manager)
  const [viewScope, setViewScope] = useState('ALL')

  // State gỡ nhân viên
  const [confirmTask, setConfirmTask] = useState(null)

  // Flow 5: State giao việc
  const [assignTask, setAssignTask] = useState(null)

  // State gia hạn task SUPPORT quá hạn (PR-S4)
  const [extendTarget, setExtendTarget] = useState(null)
  const [extendDueDate, setExtendDueDate] = useState(tomorrowIsoDate())
  const [extendReason, setExtendReason] = useState('')
  const [extendError, setExtendError] = useState('')

  // Vấn đề 2 (26/11/2026): State dời lịch nhận kho cho task CHECK_IN quá hạn ngay trên bảng công việc
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState(tomorrowIsoDate())
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduleError, setRescheduleError] = useState('')

  // State duyệt hoàn tiền cọc (PR-O12, PR-O15)
  const [refundTask, setRefundTask] = useState(null)
  const [refundMethod, setRefundMethod] = useState('BANK_TRANSFER')
  const [bankTransactionCode, setBankTransactionCode] = useState('')
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('')
  const [refundNote, setRefundNote] = useState('')
  const [refundError, setRefundError] = useState(null)
  // D-22 / PR-O26: khách báo "Chưa nhận được" → FM chọn giao dịch đúng / chuyển bổ sung
  const [refundResolution, setRefundResolution] = useState('VERIFIED')
  const [additionalAmount, setAdditionalAmount] = useState('')
  const refundReopened = refundTask?.receiptStatus === 'DISPUTED'

  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [checkInEscalations, setCheckInEscalations] = useState([])
  const [escalationError, setEscalationError] = useState('')

  useEffect(() => {
    if (initialTypeFilter === 'REFUND' || !user.facilityId) return
    let active = true
    const refresh = () => getStaffTasks(user.facilityId)
      .then(rows => {
        if (!active) return
        setCheckInEscalations((rows || []).filter(task => task.taskType === 'CHECK_IN' && task.checkInNeedsManager))
        setEscalationError('')
      })
      .catch(() => { if (active) setEscalationError('Chưa tải được danh sách check-in chờ FM.') })
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [user.facilityId, initialTypeFilter, reloadKey])

  const closeToast = useCallback(() => setToast(null), [])

  const handleUnassign = () => {
    setSubmitting(true)
    unassignStaffTask(confirmTask.id, user.userId)
      .then(task => setToast({ type: 'success', message: `Đã gỡ ${confirmTask.staffName} khỏi task #${task.id}. Task đã về "Chờ nhận".` }))
      .catch(err => setToast({ type: 'error', message: err.response?.data?.message || 'Không gỡ được người nhận, vui lòng thử lại.' }))
      .finally(() => {
        setSubmitting(false)
        setConfirmTask(null)
        setReloadKey(k => k + 1)
      })
  }

  const openRescheduleModal = (task) => {
    setRescheduleTarget(task)
    setRescheduleDate(tomorrowIsoDate())
    setRescheduleReason('')
    setRescheduleError('')
  }

  const handleRescheduleSubmit = () => {
    if (!rescheduleTarget?.reservationId) return
    if (!rescheduleDate) {
      setRescheduleError('Vui lòng chọn ngày nhận kho mới.')
      return
    }
    const trimmedReason = rescheduleReason.trim()
    if (trimmedReason.length > 300) {
      setRescheduleError('Lý do dời lịch tối đa 300 ký tự.')
      return
    }

    setSubmitting(true)
    setRescheduleError('')
    rescheduleReservation(rescheduleTarget.reservationId, {
      newStartDate: rescheduleDate,
      reason: trimmedReason || 'Dời lịch nhận kho từ bảng công việc (task check-in quá hạn)',
      managerId: user.userId,
    })
      .then(() => {
        setToast({
          type: 'success',
          message: `Đã dời lịch nhận kho task #${rescheduleTarget.id} (${rescheduleTarget.contractCode || 'Check-in'}) sang ngày ${rescheduleDate.split('-').reverse().join('/')}. Task đã được mở lại!`,
        })
        setRescheduleTarget(null)
        setReloadKey(k => k + 1)
      })
      .catch(err => {
        setRescheduleError(err.response?.data?.message || 'Không thể dời lịch nhận kho, vui lòng thử lại.')
      })
      .finally(() => setSubmitting(false))
  }

  const openExtendSupportModal = (task) => {
    setExtendTarget(task)
    setExtendDueDate(tomorrowIsoDate())
    setExtendReason('')
    setExtendError('')
  }

  const handleExtendSupportSubmit = () => {
    if (!extendTarget) return
    if (!extendDueDate) {
      setExtendError('Vui lòng chọn ngày hạn mới.')
      return
    }
    const trimmedReason = extendReason.trim()
    if (!trimmedReason) {
      setExtendError('Bắt buộc nhập lý do gia hạn (PR-S4).')
      return
    }
    if (extendDueDate > isoDateAfter(MAX_EXTEND_DAYS)) {
      setExtendError(`Chỉ gia hạn tối đa ${MAX_EXTEND_DAYS} ngày kể từ hôm nay.`)
      return
    }
    if (trimmedReason.length > 500) {
      setExtendError('Lý do gia hạn tối đa 500 ký tự.')
      return
    }

    setSubmitting(true)
    setExtendError('')
    extendOverdueTask(extendTarget.id, {
      newDueDate: extendDueDate,
      reason: trimmedReason,
    })
      .then(updated => {
        setToast({
          type: 'success',
          message: `Đã gia hạn task #${updated.id}${updated.ticketCode ? ` (${updated.ticketCode})` : ''} thành công! Trạng thái: ${updated.status === 'IN_PROGRESS' ? 'Đang xử lý (giữ người nhận)' : 'Chờ nhận'}.`,
        })
        setExtendTarget(null)
        setReloadKey(k => k + 1)
      })
      .catch(err => {
        setExtendError(err.response?.data?.message || 'Không gia hạn được task, vui lòng thử lại.')
      })
      .finally(() => setSubmitting(false))
  }

  // 23/11/2026: ?resolveTaskId= (từ trang chi tiết task hoàn tiền) → mở thẳng modal xử lý khách báo chưa nhận
  const [searchParams, setSearchParams] = useSearchParams()
  const resolveTaskId = searchParams.get('resolveTaskId')
  useEffect(() => {
    if (!resolveTaskId || !user.facilityId) return
    let active = true
    getStaffTasks(user.facilityId)
      .then((rows) => {
        if (!active) return
        const found = (rows || []).find((t) => String(t.id) === String(resolveTaskId))
        if (found) openRefundModal(found)
        const next = new URLSearchParams(searchParams)
        next.delete('resolveTaskId')
        setSearchParams(next, { replace: true })
      })
      .catch(() => {})
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveTaskId, user.facilityId])

  function openRefundModal(task) {
    setRefundTask(task)
    // PR-O15a (26/11/2026): khách đã chọn cách nhận tiền lúc gửi yêu cầu → khoá theo lựa chọn đó
    const isCash = task.customerRefundMethod
      ? task.customerRefundMethod === 'CASH'
      : (task.note || '').toLowerCase().includes('tiền mặt')
    setRefundMethod(isCash ? 'CASH' : 'BANK_TRANSFER')
    setBankTransactionCode('')
    setEvidenceImageUrl('')
    setRefundNote('')
    setRefundError(null)
    setRefundResolution('VERIFIED')
    setAdditionalAmount('')
  }

  // Thiếu bằng chứng gì (null = đủ) — PR-O15; D-22: tiền mặt bắt buộc ảnh phiếu chi có chữ ký khách
  const refundMissing = () => {
    if (refundReopened) {
      if (refundNote.trim().length < 10) return 'Ghi giải thích gửi khách (tối thiểu 10 ký tự).'
      if (refundResolution === 'ADDITIONAL') {
        if (!(Number(additionalAmount) > 0)) return 'Nhập số tiền chuyển bổ sung lớn hơn 0.'
        if (!evidenceImageUrl.trim()) return 'Tải ảnh bằng chứng của lần chuyển bổ sung.'
      }
      return null
    }
    if (refundMethod === 'BANK_TRANSFER' && !bankTransactionCode.trim()) {
      return 'Bắt buộc nhập mã giao dịch ngân hàng (mã FT) khi chuyển khoản hoàn tiền.'
    }
    if (refundMethod === 'BANK_TRANSFER' && !evidenceImageUrl.trim()) {
      return 'Vui lòng tải lên ảnh chụp biên lai chuyển tiền trước khi xác nhận hoàn tiền.'
    }
    if (refundMethod === 'CASH' && !evidenceImageUrl.trim()) {
      return 'Bắt buộc tải ảnh phiếu chi có chữ ký nhận tiền của khách.'
    }
    return null
  }

  const handleCompleteRefund = () => {
    const missing = refundMissing()
    if (missing) {
      setRefundError(missing)
      return
    }

    setSubmitting(true)
    setRefundError(null)

    const payload = {
      paymentMethod: refundMethod,
      bankTransactionCode: bankTransactionCode.trim(),
      evidenceImageUrl: evidenceImageUrl.trim(),
      cashReceiptConfirmed: refundMethod === 'CASH' ? true : undefined,
      note: refundNote.trim(),
      resolution: refundReopened ? refundResolution : undefined,
      additionalAmount: refundReopened && refundResolution === 'ADDITIONAL' ? Number(additionalAmount) : undefined,
    }

    completeRefundTask(refundTask.id, user.userId, payload)
      .then(task => setToast({
        type: 'success',
        message: task.receiptStatus === 'WAITING_CUSTOMER'
          ? `Đã ghi nhận hoàn tiền task #${task.id}. Chờ khách xác nhận đã nhận tiền (tự xác nhận sau 3 ngày).`
          : `Đã hoàn tất thanh toán hoàn tiền cho task #${task.id} thành công!`,
      }))
      .catch(err => {
        const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái hoàn tiền, vui lòng thử lại.'
        setRefundError(msg)
        setToast({ type: 'error', message: msg })
      })
      .finally(() => {
        setSubmitting(false)
        setRefundTask(null)
        setReloadKey(k => k + 1)
      })
  }

  const isRefundMode = initialTypeFilter === 'REFUND'

  const renderActions = task => {
    const detailUrl = task.taskType === 'REFUND' ? `/manager/refunds/${task.id}` : `/manager/tasks/${task.id}`

    // Task có yêu cầu Quản lý chuyển ô kho từ nhân viên (hỗ trợ hoặc bảo trì)
    const hasTransferReq = typeof task.note === 'string'
      && task.note.includes('[YÊU CẦU FM ĐỔI KHO CHO KHÁCH')
      && !task.note.includes('[FM đã chuyển HĐ sang ô')
    if (hasTransferReq) {
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-orange w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer animate-pulse"
          >
            <span className="material-symbols-outlined text-[17px]">swap_horiz</span>
            Chuyển ô cho khách
          </Link>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
        </>
      )
    }

    // Task REFUND: Manager xem chi tiết (dòng 1) + xác nhận đã thực hiện hoàn tiền (dòng 2)
    if (task.taskType === 'REFUND') {
      if (['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(task.status)) {
        return (
          <>
            <Link
              to={detailUrl}
              className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">visibility</span>
              Xem chi tiết
            </Link>
            <button
              type="button"
              onClick={() => openRefundModal(task)}
              className={`${task.receiptStatus === 'DISPUTED' ? 'duo-btn-red' : 'duo-btn-green'} w-full py-1.5 px-2.5 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer`}
            >
              <span className="material-symbols-outlined text-[17px]">{task.receiptStatus === 'DISPUTED' ? 'report' : 'payments'}</span>
              {task.receiptStatus === 'DISPUTED' ? 'Xử lý: khách báo chưa nhận' : 'Xác nhận đã hoàn tiền'}
            </button>
          </>
        )
      }
      // D-22 / PR-O25: hoàn xong → khách xác nhận đã nhận tiền
      const receipt = RECEIPT_LABELS[task.receiptStatus]
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
          {receipt && (
            <span className={`w-full text-center text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${receipt.cls}`}>
              {receipt.label}
            </span>
          )}
        </>
      )
    }

    // PR-S4 & Vấn đề 3C: Task SUPPORT hoặc CHECK_OUT [RECHECK] quá hạn -> FM được bấm "Gia hạn xử lý"
    const isTaskOverdue = task.status === 'OVERDUE'
      || (['OPEN', 'IN_PROGRESS'].includes(task.status) && task.dueAt && new Date(task.dueAt) <= new Date())
    const isRecheckTask = task.taskType === 'CHECK_OUT' && typeof task.note === 'string' && task.note.includes('[RECHECK]')

    // Vấn đề 2 (26/11/2026): Task CHECK_IN quá hạn -> FM được bấm "Dời lịch nhận kho" ngay trên bảng công việc
    if (task.taskType === 'CHECK_IN' && isTaskOverdue && task.reservationId && task.checkInEscalationStatus !== 'CI_FAULT') {
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            type="button"
            onClick={() => openRescheduleModal(task)}
            className="duo-btn-blue w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">edit_calendar</span>
            Dời lịch nhận kho
          </button>
        </>
      )
    }

    if ((task.taskType === 'SUPPORT' || isRecheckTask) && isTaskOverdue) {
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            type="button"
            onClick={() => openExtendSupportModal(task)}
            className="duo-btn-blue w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">more_time</span>
            Gia hạn xử lý
          </button>
        </>
      )
    }

    // Task đang xử lý (3 nút bấm: mỗi nút bấm 1 dòng xếp chồng)
    if (task.status === 'IN_PROGRESS' && !isTaskOverdue) {
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            type="button"
            onClick={() => setAssignTask(task)}
            className="duo-btn-blue w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">sync_alt</span>
            Đổi người
          </button>
          <button
            type="button"
            onClick={() => setConfirmTask(task)}
            className="duo-btn-red w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">person_remove</span>
            Gỡ người nhận
          </button>
        </>
      )
    }

    // PR-O10: task bảo trì quá hạn → FM gia hạn cho nhân viên làm tiếp (PR-S4 mở rộng) hoặc tự bấm "Sửa xong / Dọn xong"
    if (task.taskType === 'MAINTENANCE' && isTaskOverdue) {
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            type="button"
            onClick={() => openExtendSupportModal(task)}
            className="duo-btn-blue w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">more_time</span>
            Gia hạn xử lý
          </button>
          <Link
            to={detailUrl}
            className="duo-btn-green w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">build</span>
            Hoàn tất bảo trì
          </Link>
        </>
      )
    }

    // Flow 5: task chưa ai nhận → Manager chủ động giao cho nhân viên
    if (task.status === 'OPEN' && !isTaskOverdue) {
      return (
        <>
          <Link
            to={detailUrl}
            className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            Xem chi tiết
          </Link>
          {assignLockedUntil(task) ? (
            // PR-T1: ngoài khung 30 ngày trước ngày hẹn → chưa giao được
            <button
              type="button"
              disabled
              title="Chỉ giao việc bàn giao / nghiệm thu trong vòng 30 ngày trước ngày hẹn"
              className="w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-nowrap rounded-xl border-2 border-[#E5E5E5] bg-[#F7F7F7] text-[#AFAFAF] cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[17px]">lock_clock</span>
              Giao từ {assignLockedUntil(task)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAssignTask(task)}
              className="duo-btn-green w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">assignment_ind</span>
              Giao việc
            </button>
          )}
        </>
      )
    }

    return (
      <Link
        to={detailUrl}
        className="duo-btn-gray w-full py-1.5 px-3 text-xs font-black gap-1.5 flex items-center justify-center whitespace-normal text-center leading-tight break-words cursor-pointer"
      >
        <span className="material-symbols-outlined text-[17px]">visibility</span>
        Xem chi tiết
      </Link>
    )
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8">
      {isRefundMode ? (
        <div className="pb-4 mb-6 border-b-2 border-[#E5E5E5]">
          <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
            Quản lý hoàn tiền
          </h1>
          <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
            Danh sách yêu cầu hoàn tiền (hủy đơn & trả kho) tại {user.facilityName || 'cơ sở của bạn'}.
          </p>
        </div>
      ) : (
        <div className="pb-4 mb-6 border-b-2 border-[#E5E5E5] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Quản lý công việc cơ sở</h1>
            <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
              {viewScope === 'MINE'
                ? `Các nhiệm vụ được phân công cho Quản lý (ID: ${user.userId}) tại ${user.facilityName || 'cơ sở của bạn'}.`
                : `Theo dõi check-in / check-out / hỗ trợ khách hàng tại ${user.facilityName || 'cơ sở của bạn'}.`}
            </p>
          </div>

          {/* Chuyển đổi giữa Nhiệm vụ của Manager vs Toàn bộ công việc cơ sở */}
          <div className="flex gap-2 p-1.5 bg-[#F7F7F7] rounded-2xl border-2 border-[#E5E5E5]">
            <button
              onClick={() => setViewScope('MINE')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                viewScope === 'MINE'
                  ? 'bg-[#1CB0F6] text-white border-b-4 border-[#1899D6]'
                  : 'text-[#777777] hover:text-[#4B4B4B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_circle</span>
              Nhiệm vụ của tôi
            </button>
            <button
              onClick={() => setViewScope('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                viewScope === 'ALL'
                  ? 'bg-[#1CB0F6] text-white border-b-4 border-[#1899D6]'
                  : 'text-[#777777] hover:text-[#4B4B4B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">warehouse</span>
              Tất cả việc cơ sở
            </button>
          </div>
        </div>
      )}

      {!isRefundMode && user.facilityId && <section className="duo-card border-2 border-[#FF9600] bg-[#FFF8EE] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[#E58800]">priority_high</span>
          <h2 className="text-sm font-black text-[#4B4B4B]">Check-in chờ FM xử lý ({checkInEscalations.length})</h2>
        </div>
        {escalationError && <p className="text-xs font-bold text-[#EA2B2B]">{escalationError}</p>}
        {!escalationError && checkInEscalations.length === 0 && <p className="text-xs font-bold text-[#777777]">Chưa có báo cáo bàn giao cần FM xử lý.</p>}
        <div className="flex flex-col gap-2">
          {checkInEscalations.map(task => <Link key={task.id} to={`/manager/tasks/${task.id}`}
            className="rounded-xl border border-[#FF9600] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-[#FFF4CC]">
            <span className="text-xs font-black text-[#4B4B4B]">Task #{task.id} · {task.contractCode || 'Hợp đồng'} · ô {task.storageUnitId || '—'}</span>
            <span className="text-xs font-bold text-[#777777]">{task.customerName || 'Khách hàng'} · {task.staffName || 'Chưa giao Staff'}</span>
            <span className="text-xs font-black text-[#E58800]">{task.checkInEscalationStatus === 'CI_FAULT' ? 'Đã xác nhận lỗi cơ sở' : 'Chờ FM xem báo cáo'} →</span>
          </Link>)}
        </div>
      </section>}

      {user.facilityId ? (
        <TaskBoard
          key={initialTypeFilter}
          facilityId={user.facilityId}
          renderActions={renderActions}
          reloadKey={reloadKey}
          currentStaffId={user.userId}
          forceStaffId={!isRefundMode && viewScope === 'MINE' ? user.userId : null}
          initialTypeFilter={initialTypeFilter}
          defaultLayout="list"
          showLayoutToggle={true}
        />
      ) : (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF9600] text-[40px]">location_off</span>
          <p className="text-sm font-black text-[#4B4B4B]">Không xác định được cơ sở của bạn.</p>
          <p className="text-xs font-bold text-[#AFAFAF]">Hãy đăng xuất rồi đăng nhập lại để tải thông tin cơ sở.</p>
        </div>
      )}

      {/* Modal xác nhận gỡ nhân viên */}
      <TaskConfirmDialog
        open={Boolean(confirmTask)}
        icon="person_remove"
        tone="red"
        title={`Gỡ người nhận task #${confirmTask?.id ?? ''}?`}
        message={confirmTask
          ? `${confirmTask.staffName} sẽ không còn phụ trách task này. Task quay về "Chờ nhận" để nhân viên khác nhận.`
          : ''}
        confirmLabel="Gỡ người nhận"
        submitting={submitting}
        onConfirm={handleUnassign}
        onCancel={() => setConfirmTask(null)}
      />

      {/* Flow 5: Modal giao việc / đổi người */}
      {assignTask && (
        <AssignTaskModal
          task={assignTask}
          facilityId={user.facilityId}
          onClose={() => setAssignTask(null)}
          onAssigned={(updated) => {
            setAssignTask(null)
            setToast({ type: 'success', message: `Đã giao task #${updated.id} cho ${updated.staffName}.` })
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      {/* Modal Dời lịch nhận kho cho task CHECK_IN quá hạn */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card max-w-md w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FFF5E6] border-2 border-[#FF9600] flex items-center justify-center text-[#E58800]">
                <span className="material-symbols-outlined text-[24px]">edit_calendar</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-[#4B4B4B]">Dời lịch nhận kho</h3>
                <p className="text-xs font-bold text-[#AFAFAF] truncate">
                  Task #{rescheduleTarget.id} · {rescheduleTarget.contractCode || `Đơn #${rescheduleTarget.reservationId}`} · Ô {rescheduleTarget.storageUnitId || '—'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-[#4B4B4B]">
                Ngày nhận kho mới <span className="text-[#FF4B4B]">*</span>
              </label>
              <DateInput
                min={todayIsoDate()}
                value={rescheduleDate}
                onChange={e => { setRescheduleDate(e.target.value); setRescheduleError('') }}
                className="duo-input w-full text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-[#4B4B4B]">
                Lý do dời lịch
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={rescheduleReason}
                onChange={e => { setRescheduleReason(e.target.value); setRescheduleError('') }}
                placeholder="VD: Khách hẹn quay lại bổ sung giấy tờ và ký biên bản bàn giao vào ngày mai..."
                className="duo-input w-full text-xs resize-none"
              />
            </div>

            {rescheduleError && (
              <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{rescheduleError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                onClick={() => setRescheduleTarget(null)}
                disabled={submitting}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={submitting || !rescheduleDate}
                className="duo-btn-blue px-5 py-2.5 text-xs gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">event_upcoming</span>
                {submitting ? 'Đang dời lịch...' : 'Xác nhận dời lịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gia hạn task SUPPORT quá hạn (PR-S4) */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card max-w-md w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                <span className="material-symbols-outlined text-[24px]">more_time</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">
                  Gia hạn task {extendTarget.taskType === 'MAINTENANCE' ? 'bảo trì' : extendTarget.taskType === 'CHECK_OUT' ? 'kiểm tra lại nghiệm thu' : 'hỗ trợ'} (PR-S4)
                </h3>
                <p className="text-xs font-bold text-[#AFAFAF]">
                  Task #{extendTarget.id} · {extendTarget.taskType === 'MAINTENANCE' ? `Ô ${extendTarget.storageUnitId || '—'}` : extendTarget.taskType === 'CHECK_OUT' ? `HĐ ${extendTarget.contractCode || '—'}` : (extendTarget.ticketCode || 'Hỗ trợ KH')} · Giữ nguyên người nhận ({extendTarget.staffName || 'Chưa có'})
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-[#4B4B4B]">
                Ngày hạn mới (hạn lúc 21:00, tối đa {MAX_EXTEND_DAYS} ngày) <span className="text-[#FF4B4B]">*</span>
              </label>
              <DateInput
                min={todayIsoDate()}
                max={isoDateAfter(MAX_EXTEND_DAYS)}
                value={extendDueDate}
                onChange={e => { setExtendDueDate(e.target.value); setExtendError('') }}
                className="duo-input w-full text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-[#4B4B4B]">
                Lý do gia hạn <span className="text-[#FF4B4B]">*</span>
              </label>
              <textarea
                rows={3}
                value={extendReason}
                onChange={e => { setExtendReason(e.target.value); setExtendError('') }}
                placeholder="Nhập lý do gia hạn (VD: Cần chờ kỹ thuật viên khóa đến thay linh kiện vào sáng mai)..."
                className="duo-input w-full text-xs resize-none"
              />
            </div>

            {extendError && (
              <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{extendError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                onClick={() => setExtendTarget(null)}
                disabled={submitting}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleExtendSupportSubmit}
                disabled={submitting}
                className="duo-btn-blue px-5 py-2.5 text-xs gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {submitting ? 'Đang lưu...' : 'Xác nhận gia hạn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận hoàn tiền (PR-O12, PR-O15) */}
      {refundTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                <span className="material-symbols-outlined text-[24px]">payments</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">Xác nhận hoàn tất hoàn tiền</h3>
                <p className="text-xs font-bold text-[#AFAFAF]">Task #{refundTask.id} · Phụ trách: {user.fullName || 'Quản lý cơ sở'}</p>
              </div>
            </div>

            {refundError && (
              <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{refundError}</span>
              </div>
            )}

            <RefundBreakdown note={refundTask.note} />

            {/* D-22 / PR-O26: khách báo "Chưa nhận được" → giải thích hoặc chuyển bổ sung */}
            {refundReopened && (
              <div className="flex flex-col gap-2 bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-xl p-3">
                <p className="text-xs font-black text-[#FF4B4B] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">report</span>
                  Khách báo chưa nhận được tiền (lần {refundTask.receiptRound || 1})
                </p>
                <p className="text-xs font-bold text-[#4B4B4B]">“{refundTask.receiptDisputeReason}”</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['VERIFIED', 'Giao dịch đúng', 'fact_check'], ['ADDITIONAL', 'Chuyển bổ sung', 'add_card']].map(([key, label, icon]) => (
                    <button key={key} type="button" onClick={() => { setRefundResolution(key); setRefundError(null) }}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                        refundResolution === key ? 'border-[#1CB0F6] bg-[#DDF4FF] text-[#1899D6]' : 'border-[#E5E5E5] bg-white text-[#777777]'}`}>
                      <span className="material-symbols-outlined text-[18px]">{icon}</span>{label}
                    </button>
                  ))}
                </div>
                {refundResolution === 'ADDITIONAL' && (
                  <input type="number" min={1} placeholder="Số tiền chuyển bổ sung (đ)" value={additionalAmount}
                    onChange={e => setAdditionalAmount(e.target.value)} className="duo-input w-full text-xs bg-white" />
                )}
                <span className="text-[10px] font-bold text-[#777777]">
                  {refundResolution === 'VERIFIED'
                    ? 'Ghi giải thích + đính kèm sao kê (nếu có). Khách sẽ xác nhận lại.'
                    : 'Ghi lý do, mã FT và ảnh của lần chuyển bổ sung. Khách sẽ xác nhận lại.'}
                </span>
              </div>
            )}

            {/* Chọn hình thức hoàn tiền (PR-O15) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase text-[#777777]">
                Hình thức thực hiện hoàn tiền:
              </label>
              {refundTask?.customerRefundMethod ? (
                /* PR-O15a: khách đã chọn lúc gửi yêu cầu → FM hoàn đúng cách đó, không đổi được */
                <div className={`py-2 px-3 rounded-xl border-2 text-xs font-black flex items-center gap-2 ${
                  refundTask.customerRefundMethod === 'CASH'
                    ? 'border-[#58CC02] bg-[#D7FFB8] text-[#58A700]'
                    : 'border-[#1CB0F6] bg-[#DDF4FF] text-[#1899D6]'}`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {refundTask.customerRefundMethod === 'CASH' ? 'payments' : 'account_balance'}
                  </span>
                  <span className="flex flex-col">
                    <span>Khách chọn: {refundTask.customerRefundMethod === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản'}</span>
                    <span className="text-[10px] font-bold opacity-80">Hoàn đúng cách khách chọn lúc gửi yêu cầu</span>
                  </span>
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setRefundMethod('BANK_TRANSFER'); setRefundError(null); }}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    refundMethod === 'BANK_TRANSFER'
                      ? 'border-[#1CB0F6] bg-[#DDF4FF] text-[#1CB0F6]'
                      : 'border-[#E5E5E5] bg-white text-[#777777] hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">account_balance</span>
                  Chuyển khoản (Bank)
                </button>
                <button
                  type="button"
                  onClick={() => { setRefundMethod('CASH'); setRefundError(null); }}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    refundMethod === 'CASH'
                      ? 'border-[#58CC02] bg-[#D7FFB8] text-[#58CC02]'
                      : 'border-[#E5E5E5] bg-white text-[#777777] hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Tiền mặt tại quầy
                </button>
              </div>
              )}
            </div>

            {/* Form bằng chứng theo hình thức */}
            {refundMethod === 'BANK_TRANSFER' ? (
              <div className="flex flex-col gap-3 bg-[#F0F9FF] p-3 rounded-xl border border-[#B9E6FE]">
                <div>
                  <label className="text-[11px] font-black uppercase text-[#026AA2] block mb-1">
                    Mã giao dịch ngân hàng (Mã FT) <span className="text-[#FF4B4B]">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: FT261017009412 (Bắt buộc theo PR-O15)"
                    value={bankTransactionCode}
                    onChange={e => setBankTransactionCode(e.target.value)}
                    className="duo-input w-full text-xs bg-white"
                    required
                  />
                  <span className="text-[10px] font-bold text-[#026AA2]/80 mt-1 block">
                    BOM / Kế toán sẽ đối soát tiền hoàn thông qua mã FT này.
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-[#026AA2]">
                      Ảnh biên lai chuyển tiền <span className="text-[#FF4B4B]">*</span>:
                    </label>
                    <label className="duo-btn-white px-3 py-1 text-xs gap-1 cursor-pointer flex items-center">
                      <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">upload_file</span>
                      Tải ảnh biên lai
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const res = await uploadImageFile(file);
                            if (res?.url) setEvidenceImageUrl(res.url);
                          } catch {
                            setRefundError('Không thể tải file ảnh lên máy chủ, vui lòng thử lại.');
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Hoặc dán link URL ảnh biên lai tại đây..."
                    value={evidenceImageUrl}
                    onChange={e => setEvidenceImageUrl(e.target.value)}
                    className="duo-input w-full text-xs bg-white"
                  />
                  {evidenceImageUrl && (
                    <div className="relative w-24 h-24 rounded-xl border-2 border-[#84D8FF] overflow-hidden bg-white mt-1">
                      <img src={evidenceImageUrl} alt="Biên lai chuyển khoản" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEvidenceImageUrl('')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#FF4B4B] text-white flex items-center justify-center text-xs font-black cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 bg-[#F3FEE7] p-3 rounded-xl border border-[#D0F8AB]">
                {/* D-22 / PR-O27: ảnh phiếu chi có chữ ký khách thay dấu tick — chữ ký = khách xác nhận đã nhận tiền */}
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase text-[#2B5300]">
                    Ảnh phiếu chi có chữ ký nhận tiền của khách {!(refundReopened && refundResolution === 'VERIFIED') && <span className="text-[#FF4B4B]">*</span>}:
                  </label>
                  <label className="duo-btn-white px-3 py-1 text-xs gap-1 cursor-pointer flex items-center">
                    <span className="material-symbols-outlined text-[16px] text-[#58CC02]">upload_file</span>
                    Tải ảnh phiếu chi
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await uploadImageFile(file);
                          if (res?.url) setEvidenceImageUrl(res.url);
                        } catch {
                          setRefundError('Không thể tải file ảnh lên máy chủ, vui lòng thử lại.');
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Hoặc dán link URL ảnh phiếu chi..."
                  value={evidenceImageUrl}
                  onChange={e => setEvidenceImageUrl(e.target.value)}
                  className="duo-input w-full text-xs bg-white"
                />
                {evidenceImageUrl && (
                  <img src={evidenceImageUrl} alt="Phiếu chi" className="w-24 h-24 rounded-xl border-2 border-[#D0F8AB] object-cover bg-white" />
                )}
                <span className="text-[10px] font-bold text-[#2B5300]/80 block">
                  Có chữ ký khách thì khoản hoàn được ghi là khách đã nhận, không cần khách bấm xác nhận.
                </span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-black uppercase text-[#777777] block mb-1">
                Ghi chú đối soát thêm (Tùy chọn):
              </label>
              <input
                type="text"
                placeholder="VD: Đã tất toán đủ cho khách lúc 15:45..."
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
                className="duo-input w-full text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button
                onClick={() => { setRefundTask(null); setRefundError(null); }}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border-2 border-b-4 border-[#E5E5E5] text-[#777777] text-xs font-black uppercase hover:bg-[#F7F7F7] cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleCompleteRefund}
                disabled={submitting || Boolean(refundMissing())}
                className="duo-btn-green px-5 py-2.5 text-xs gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {submitting ? 'Đang lưu...' : 'Xác nhận đã hoàn tiền'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  )
}
