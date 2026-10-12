import TaskBoard from '../../components/TaskBoard'

// UC-16: Manager theo dõi bảng công việc của nhân viên tại cơ sở mình
export default function ManagerTaskBoardPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      <div className="pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Bảng công việc nhân viên</h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          Theo dõi check-in / check-out tại {user.facilityName || 'cơ sở của bạn'}. Task quá hạn được đánh dấu đỏ.
        </p>
      </div>

      {user.facilityId ? (
        <TaskBoard facilityId={user.facilityId} />
      ) : (
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="material-symbols-outlined text-[#FF9600] text-[40px]">location_off</span>
          <p className="text-sm font-black text-[#4B4B4B]">Không xác định được cơ sở của bạn.</p>
          <p className="text-xs font-bold text-[#AFAFAF]">Hãy đăng xuất rồi đăng nhập lại để tải thông tin cơ sở.</p>
        </div>
      )}
    </div>
  )
}
