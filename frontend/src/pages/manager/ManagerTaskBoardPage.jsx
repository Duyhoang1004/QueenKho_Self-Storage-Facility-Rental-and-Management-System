import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import TaskBoard from '../../components/TaskBoard'
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback'
import { unassignStaffTask } from '../../services/staffTaskService'

// UC-16: Manager theo dõi bảng công việc của nhân viên tại cơ sở mình
// UC-17: Manager gỡ nhân viên khỏi task đang xử lý → task về "Chờ nhận" cho người khác nhận
// UC-25: Manager theo dõi và xử lý các task hoàn cọc (REFUND) của cơ sở mình
export default function ManagerTaskBoardPage({ initialTypeFilter = 'ALL' }) {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')

  const [confirmTask, setConfirmTask] = useState(null)
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

  const isRefundMode = initialTypeFilter === 'REFUND'

  const renderActions = task => {
    const detailUrl = (isRefundMode || task.taskType === 'REFUND')
      ? `/manager/refunds/${task.id}`
      : `/manager/tasks/${task.id}`

    if (task.taskType === 'REFUND' && task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
      return (
        <Link to={detailUrl} className="duo-btn-green px-4 py-2 text-xs gap-1.5">
          <span className="material-symbols-outlined text-[18px]">payments</span>
          Xử lý hoàn tiền
        </Link>
      )
    }
    if (task.status === 'IN_PROGRESS') {
      return (
        <div className="flex items-center gap-2">
          <Link to={detailUrl} className="duo-btn-gray px-4 py-2 text-xs gap-1.5">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Chi tiết
          </Link>
          <button onClick={() => setConfirmTask(task)} className="duo-btn-red px-4 py-2 text-xs gap-1.5">
            <span className="material-symbols-outlined text-[18px]">person_remove</span>
            Gỡ người nhận
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
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      <div className="pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
          {isRefundMode ? 'Quản lý hoàn tiền' : 'Bảng công việc cơ sở'}
        </h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          {isRefundMode
            ? `Danh sách yêu cầu hoàn tiền (hủy đơn & trả kho) tại ${user.facilityName || 'cơ sở của bạn'}.`
            : `Theo dõi check-in / check-out tại ${user.facilityName || 'cơ sở của bạn'}. Task quá hạn được đánh dấu đỏ.`}
        </p>
      </div>

      {user.facilityId ? (
        <TaskBoard
          key={initialTypeFilter}
          facilityId={user.facilityId}
          renderActions={renderActions}
          reloadKey={reloadKey}
          initialTypeFilter={initialTypeFilter}
        />
      ) : (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF9600] text-[40px]">location_off</span>
          <p className="text-sm font-black text-[#4B4B4B]">Không xác định được cơ sở của bạn.</p>
          <p className="text-xs font-bold text-[#AFAFAF]">Hãy đăng xuất rồi đăng nhập lại để tải thông tin cơ sở.</p>
        </div>
      )}

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
      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  )
}
