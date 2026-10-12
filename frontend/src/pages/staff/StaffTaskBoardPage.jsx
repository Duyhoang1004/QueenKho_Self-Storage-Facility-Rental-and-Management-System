import TaskBoard from '../../components/TaskBoard';

// UC-16: Bảng công việc tại cơ sở (trang chính của nhân viên)
export default function StaffTaskBoardPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8">
      <div className="flex flex-col gap-1 pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Bảng công việc</h1>
        <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider">
          Việc check-in / check-out cần xử lý tại {user.facilityName || 'cơ sở'} · hạn chót 21:00 ngày hẹn.
        </p>
      </div>

      {user.facilityId ? (
        <TaskBoard facilityId={user.facilityId} />
      ) : (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF9600] text-[40px]">location_off</span>
          <p className="text-sm font-black text-[#4B4B4B]">Tài khoản chưa được gán cơ sở.</p>
          <p className="text-xs font-bold text-[#AFAFAF]">Vui lòng đăng nhập lại hoặc liên hệ quản lý cơ sở.</p>
        </div>
      )}
    </div>
  );
}
