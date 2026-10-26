import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TaskBoard from '../../components/TaskBoard'
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback'
import { assignStaffTask, unassignStaffTask, completeRefundTask, extendSupportTask } from '../../services/staffTaskService'
import { getFacilityStaff } from '../../services/facilityStaffService'

const TASK_TYPE_LABELS = { CHECK_IN: 'Bàn giao (check-in)', CHECK_OUT: 'Nghiệm thu trả kho', SUPPORT: 'Hỗ trợ khách', MAINTENANCE: 'Bảo trì ô kho' }

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
              {TASK_TYPE_LABELS[task.taskType] || task.taskType} · {task.customerName || task.contractCode || ''}
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
  const d = new Date()
  d.setDate(d.getDate() + 1)
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

  // State duyệt hoàn tiền cọc (PR-O12, PR-O15)
  const [refundTask, setRefundTask] = useState(null)
  const [refundMethod, setRefundMethod] = useState('BANK_TRANSFER')
  const [bankTransactionCode, setBankTransactionCode] = useState('')
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('')
  const [cashReceiptConfirmed, setCashReceiptConfirmed] = useState(false)
  const [refundNote, setRefundNote] = useState('')
  const [refundError, setRefundError] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

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
      setExtendError('Bắt buộc nhập lý do gia hạn task hỗ trợ (PR-S4).')
      return
    }
    if (trimmedReason.length > 500) {
      setExtendError('Lý do gia hạn tối đa 500 ký tự.')
      return
    }

    setSubmitting(true)
    setExtendError('')
    extendSupportTask(extendTarget.id, user.userId, {
      newDueDate: extendDueDate,
      reason: trimmedReason,
    })
      .then(updated => {
        setToast({
          type: 'success',
          message: `Đã gia hạn task hỗ trợ #${updated.id} (${updated.ticketCode || ''}) thành công! Trạng thái: ${updated.status === 'IN_PROGRESS' ? 'Đang xử lý (giữ người nhận)' : 'Chờ nhận'}.`,
        })
        setExtendTarget(null)
        setReloadKey(k => k + 1)
      })
      .catch(err => {
        setExtendError(err.response?.data?.message || 'Không gia hạn được task hỗ trợ, vui lòng thử lại.')
      })
      .finally(() => setSubmitting(false))
  }

  const openRefundModal = (task) => {
    setRefundTask(task)
    const isCash = (task.note || '').toLowerCase().includes('tiền mặt')
    setRefundMethod(isCash ? 'CASH' : 'BANK_TRANSFER')
    setBankTransactionCode('')
    setEvidenceImageUrl('')
    setCashReceiptConfirmed(false)
    setRefundNote('')
    setRefundError(null)
  }

  const handleCompleteRefund = () => {
    // PR-O15: Bắt buộc bằng chứng trước khi hoàn tất
    if (refundMethod === 'BANK_TRANSFER' && !bankTransactionCode.trim()) {
      setRefundError('Bắt buộc nhập mã giao dịch ngân hàng (mã FT) khi chuyển khoản hoàn tiền.')
      return
    }
    if (refundMethod === 'CASH' && !cashReceiptConfirmed) {
      setRefundError('Bắt buộc xác nhận khách hàng đã ký nhận tiền mặt tại quầy.')
      return
    }

    setSubmitting(true)
    setRefundError(null)

    const payload = {
      paymentMethod: refundMethod,
      bankTransactionCode: bankTransactionCode.trim(),
      evidenceImageUrl: evidenceImageUrl.trim(),
      cashReceiptConfirmed,
      note: refundNote.trim()
    }

    completeRefundTask(refundTask.id, user.userId, payload)
      .then(task => setToast({ type: 'success', message: `Đã hoàn tất thanh toán hoàn tiền cho task #${task.id} thành công!` }))
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

    // Task REFUND: Manager xem chi tiết hoặc xác nhận đã thực hiện chuyển khoản / hoàn tiền cọc
    if (task.taskType === 'REFUND') {
      if (['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(task.status)) {
        return (
          <div className="flex items-center gap-2">
            <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              Xem chi tiết
            </Link>
            <button
              onClick={() => openRefundModal(task)}
              className="duo-btn-green px-4 py-2 text-xs gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">payments</span>
              Xác nhận đã hoàn tiền
            </button>
          </div>
        )
      }
      return (
        <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          Xem chi tiết
        </Link>
      )
    }

    // PR-S4: Task SUPPORT quá hạn -> FM được bấm "Gia hạn xử lý"
    const isTaskOverdue = task.status === 'OVERDUE'
      || (['OPEN', 'IN_PROGRESS'].includes(task.status) && task.dueAt && new Date(task.dueAt) <= new Date())
    if (task.taskType === 'SUPPORT' && isTaskOverdue) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            onClick={() => openExtendSupportModal(task)}
            className="duo-btn-blue px-4 py-2 text-xs gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">more_time</span>
            Gia hạn xử lý
          </button>
        </div>
      )
    }

    if (task.status === 'IN_PROGRESS' && !isTaskOverdue) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            onClick={() => setAssignTask(task)}
            className="duo-btn-blue px-4 py-2 text-xs gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            Đổi người
          </button>
          <button
            onClick={() => setConfirmTask(task)}
            className="duo-btn-red px-4 py-2 text-xs gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">person_remove</span>
            Gỡ người nhận
          </button>
        </div>
      )
    }

    // Flow 5: task chưa ai nhận → Manager chủ động giao cho nhân viên
    if (task.status === 'OPEN' && !isTaskOverdue) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem chi tiết
          </Link>
          <button
            onClick={() => setAssignTask(task)}
            className="duo-btn-green px-4 py-2 text-xs gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
            Giao việc
          </button>
        </div>
      )
    }

    return (
      <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
        <span className="material-symbols-outlined text-[18px]">visibility</span>
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

      {user.facilityId ? (
        <TaskBoard
          key={initialTypeFilter}
          facilityId={user.facilityId}
          renderActions={renderActions}
          reloadKey={reloadKey}
          currentStaffId={user.userId}
          forceStaffId={!isRefundMode && viewScope === 'MINE' ? user.userId : null}
          initialTypeFilter={initialTypeFilter}
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

      {/* Modal Gia hạn task SUPPORT quá hạn (PR-S4) */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card max-w-md w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                <span className="material-symbols-outlined text-[24px]">more_time</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">Gia hạn task hỗ trợ (PR-S4)</h3>
                <p className="text-xs font-bold text-[#AFAFAF]">
                  Task #{extendTarget.id} · {extendTarget.ticketCode || 'Hỗ trợ KH'} · Giữ nguyên người nhận ({extendTarget.staffName || 'Chưa có'})
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase text-[#4B4B4B]">
                Ngày hạn mới (hạn lúc 21:00) <span className="text-[#FF4B4B]">*</span>
              </label>
              <input
                type="date"
                min={todayIsoDate()}
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

            <div className="bg-[#F7F7F7] p-3 rounded-xl border border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] leading-relaxed">
              <span className="text-[10px] font-black uppercase text-[#AFAFAF] block mb-1">Chi tiết số tiền & phương thức hoàn:</span>
              {refundTask.note || 'Không có ghi chú chi tiết'}
            </div>

            {/* Chọn hình thức hoàn tiền (PR-O15) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase text-[#777777]">
                Hình thức thực hiện hoàn tiền:
              </label>
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
                <div>
                  <label className="text-[11px] font-black uppercase text-[#026AA2] block mb-1">
                    Link ảnh ủy nhiệm chi / Biên lai (Tùy chọn):
                  </label>
                  <input
                    type="text"
                    placeholder="Dán link ảnh screenshot giao dịch (nếu có)..."
                    value={evidenceImageUrl}
                    onChange={e => setEvidenceImageUrl(e.target.value)}
                    className="duo-input w-full text-xs bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 bg-[#F3FEE7] p-3 rounded-xl border border-[#D0F8AB]">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cashReceiptConfirmed}
                    onChange={e => setCashReceiptConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#58CC02] focus:ring-[#58CC02] cursor-pointer"
                  />
                  <span className="text-xs font-black text-[#2B5300] leading-snug">
                    Xác nhận khách hàng đã nhận đủ tiền mặt và ký phiếu biên nhận tại quầy cơ sở <span className="text-[#FF4B4B]">*</span>
                  </span>
                </label>
                <span className="text-[10px] font-bold text-[#2B5300]/80 block">
                  Bắt buộc theo PR-O15 để hoàn tất task hoàn tiền mặt.
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
                disabled={submitting}
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
