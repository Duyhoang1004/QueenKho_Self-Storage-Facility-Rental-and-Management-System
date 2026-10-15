import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import TaskBoard from '../../components/TaskBoard';
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback';
import ContactReportModal from '../../components/ContactReportModal';
import { claimStaffTask } from '../../services/staffTaskService';

const TYPE_LABEL = { CHECK_IN: 'check-in', CHECK_OUT: 'check-out' };

// UC-16: Bảng công việc tại cơ sở (trang chính của nhân viên)
// UC-17: Nhân viên bấm "Nhận việc" trên thẻ OPEN
export default function StaffTaskBoardPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const [confirmTask, setConfirmTask] = useState(null);
  const [reportTask, setReportTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const closeToast = useCallback(() => setToast(null), []);

  // Thành công hay thất bại (bị người khác nhận trước, quá hạn...) đều làm mới bảng để thấy trạng thái mới nhất
  const handleClaim = () => {
    setSubmitting(true);
    claimStaffTask(confirmTask.id, user.userId)
      .then(task => setToast({ type: 'success', message: `Đã nhận task #${task.id}. Việc đã nằm trong "Việc của tôi".` }))
      .catch(err => setToast({ type: 'error', message: err.response?.data?.message || 'Không nhận được task, vui lòng thử lại.' }))
      .finally(() => {
        setSubmitting(false);
        setConfirmTask(null);
        setReloadKey(k => k + 1);
      });
  };

  // UC-18: mọi thẻ có "Xem chi tiết"; task check-in mình đang giữ thì nút chính là "Lập biên bản"
  const renderActions = task => {
    const canHandover = task.taskType === 'CHECK_IN' && task.status === 'IN_PROGRESS' && task.staffId === user.userId;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {task.taskType === 'CHECK_IN' && ['OVERDUE', 'IN_PROGRESS', 'OPEN'].includes(task.status) && (
          <button
            type="button"
            onClick={() => setReportTask(task)}
            className="duo-btn-blue px-3 py-2 text-xs flex items-center gap-1.5"
            title="Báo cáo kết quả liên hệ khách hàng cho Quản lý"
          >
            <span className="material-symbols-outlined text-[16px]">phone_in_talk</span>
            Báo cáo liên hệ
          </button>
        )}
        {canHandover ? (
          <Link to={`/staff/tasks/${task.id}`} className="duo-btn-green px-4 py-2 text-xs gap-1.5 flex items-center">
            <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
            Lập biên bản
          </Link>
        ) : (
          <Link to={`/staff/tasks/${task.id}`} className="duo-btn-gray px-4 py-2 text-xs gap-1.5 flex items-center">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem chi tiết
          </Link>
        )}
        {task.status === 'OPEN' && (
          <button onClick={() => setConfirmTask(task)} className="duo-btn-green px-4 py-2 text-xs gap-1.5 flex items-center">
            <span className="material-symbols-outlined text-[18px]">front_hand</span>
            Nhận việc
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8">
      <div className="flex flex-col gap-1 pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Bảng công việc</h1>
        <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider">
          Việc check-in / check-out cần xử lý tại {user.facilityName || 'cơ sở'} · hạn chót 21:00 ngày hẹn.
        </p>
      </div>

      {user.facilityId ? (
        <TaskBoard
          facilityId={user.facilityId}
          currentStaffId={user.userId}
          renderActions={renderActions}
          reloadKey={reloadKey}
        />
      ) : (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF9600] text-[40px]">location_off</span>
          <p className="text-sm font-black text-[#4B4B4B]">Tài khoản chưa được gán cơ sở.</p>
          <p className="text-xs font-bold text-[#AFAFAF]">Vui lòng đăng nhập lại hoặc liên hệ quản lý cơ sở.</p>
        </div>
      )}

      <TaskConfirmDialog
        open={Boolean(confirmTask)}
        icon="front_hand"
        title={`Nhận task #${confirmTask?.id ?? ''}?`}
        message={confirmTask
          ? `Bạn sẽ phụ trách ${TYPE_LABEL[confirmTask.taskType] || 'công việc'} cho khách ${confirmTask.customerName || ''} (ô ${confirmTask.storageUnitId || '—'}). Đã nhận thì không thể tự trả lại — cần quản lý cơ sở gỡ.`
          : ''}
        confirmLabel="Nhận việc"
        submitting={submitting}
        onConfirm={handleClaim}
        onCancel={() => setConfirmTask(null)}
      />

      <ContactReportModal
        isOpen={Boolean(reportTask)}
        task={reportTask}
        onClose={() => setReportTask(null)}
        onSuccess={(taskId, outcome) => {
          setToast({ type: 'success', message: `Đã gửi báo cáo cho Quản lý cơ sở thành công: [${outcome}]` });
          setReloadKey(k => k + 1);
        }}
      />

      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  );
}
