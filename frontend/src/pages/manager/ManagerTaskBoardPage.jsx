import { useCallback, useState } from 'react'
import TaskBoard from '../../components/TaskBoard'
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback'
import { unassignStaffTask } from '../../services/staffTaskService'

// UC-16: Manager theo dõi bảng công việc của nhân viên tại cơ sở mình
// UC-17: Manager gỡ nhân viên khỏi task đang xử lý → task về "Chờ nhận" cho người khác nhận
export default function ManagerTaskBoardPage() {
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

  const renderActions = task => {
    if (task.status !== 'IN_PROGRESS') return null
    return (
      <button onClick={() => setConfirmTask(task)} className="duo-btn-red px-5 py-2.5 text-xs gap-1.5">
        <span className="material-symbols-outlined text-[18px]">person_remove</span>
        Gỡ người nhận
      </button>
    )
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      <div className="pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Bảng công việc nhân viên</h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          Theo dõi check-in / check-out tại {user.facilityName || 'cơ sở của bạn'}. Task quá hạn được đánh dấu đỏ.
        </p>
      </div>

      {user.facilityId ? (
        <TaskBoard facilityId={user.facilityId} renderActions={renderActions} reloadKey={reloadKey} />
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
