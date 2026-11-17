import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { digitsOnly, isValidPhone, PHONE_ERROR } from '../../utils/validators';
import {
  getFacilityStaff,
  createFacilityStaff,
  updateFacilityStaffStatus,
  resetFacilityStaffPassword
} from '../../services/facilityStaffService';
import { getStaffTasks } from '../../services/staffTaskService';
import { getAllFacilities } from '../../services/facilityService';
import PaginationBar, { ListBoxHeader } from '../../components/PaginationBar';

const PAGE_SIZE = 5;

const TASK_TYPE_META = {
  CHECK_IN:    { label: 'Check-in',    icon: 'login',         cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  CHECK_OUT:   { label: 'Check-out',   icon: 'logout',        cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
  SUPPORT:     { label: 'Hỗ trợ KH',   icon: 'support_agent', cls: 'bg-[#F3E8FF] text-[#A560E8] border-[#CE82FF]' },
  REFUND:      { label: 'Hoàn tiền',   icon: 'payments',      cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]' },
  MAINTENANCE: { label: 'Bảo trì kho', icon: 'build',         cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]' },
};

const TASK_STATUS_META = {
  OPEN:        { label: 'Chờ nhận',   cls: 'bg-[#DDF4FF] text-[#1CB0F6] border border-[#84D8FF]' },
  IN_PROGRESS: { label: 'Đang xử lý', cls: 'bg-[#F3E8FF] text-[#A560E8] border border-[#CE82FF]' },
  OVERDUE:     { label: 'Quá hạn',    cls: 'bg-[#FFDFDF] text-[#FF4B4B] border border-[#FF4B4B]' },
  COMPLETED:   { label: 'Hoàn thành', cls: 'bg-[#D7FFB8] text-[#58A700] border border-[#58CC02]' },
  CANCELLED:   { label: 'Đã hủy',     cls: 'bg-[#F7F7F7] text-[#777777] border border-[#E5E5E5]' },
};

const SUPPORT_ISSUE_LABELS = {
  LOCK_ISSUE: 'Sự cố khóa / Mã PIN',
  SECURITY: 'An ninh / Cảnh báo khẩn',
  FACILITY_DAMAGE: 'Hư hỏng cơ sở vật chất',
  CLEANING: 'Vệ sinh kho bãi',
  OTHER: 'Yêu cầu hỗ trợ khác',
};

function formatTaskDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTaskDue(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === today.toDateString()) return `Hôm nay ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Ngày mai ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
}

export default function ManagerStaffPage() {
  const navigate = useNavigate();

  // 1. Lấy thông tin user đăng nhập
  const [currentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user');
      const user = saved ? JSON.parse(saved) : null;
      return user?.facilityId ? Number(user.facilityId) : 1;
    } catch {
      return 1;
    }
  });

  // 2. State dữ liệu
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // 3. State tìm kiếm và lọc
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'LOCKED'
  const [workloadFilter, setWorkloadFilter] = useState('ALL'); // 'ALL' | 'BUSY' | 'IDLE'
  const [currentPage, setCurrentPage] = useState(1);

  // 4. State Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  const [statusModal, setStatusModal] = useState({ open: false, staff: null, targetStatus: '', reason: '' });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const [pwdModal, setPwdModal] = useState({ open: false, staff: null, newPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(null);

  // 4.4 State Pop-up xem danh sách task của riêng nhân viên
  const [tasksModal, setTasksModal] = useState({
    open: false,
    staff: null,
    tasks: [],
    loading: false,
    error: null,
    filter: 'ALL',
    search: '',
  });

  const openStaffTasksModal = async (staff) => {
    setTasksModal({
      open: true,
      staff,
      tasks: [],
      loading: true,
      error: null,
      filter: 'ALL',
      search: '',
    });
    try {
      const data = await getStaffTasks(selectedFacilityId, null, staff.id);
      const filtered = (data || []).filter((t) => t.staffId === staff.id);
      setTasksModal((prev) => ({
        ...prev,
        tasks: filtered,
        loading: false,
      }));
    } catch (err) {
      console.error('Lỗi tải công việc của nhân viên:', err);
      setTasksModal((prev) => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.message || 'Không thể tải danh sách công việc của nhân viên này.',
      }));
    }
  };

  // Tải danh sách cơ sở nếu role là Admin hoặc Quản lý nhiều cơ sở
  useEffect(() => {
    getAllFacilities()
      .then(res => setFacilities(res || []))
      .catch(() => {});
  }, []);

  // Tải danh sách nhân viên
  const fetchStaff = useCallback(async () => {
    if (!selectedFacilityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFacilityStaff(selectedFacilityId);
      setStaffList(data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách nhân viên:', err);
      setError(err?.response?.data?.message || 'Không thể tải danh sách nhân viên cơ sở.');
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFacilityId, searchKeyword, statusFilter, workloadFilter]);

  // Hiển thị toast thông báo
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Tính toán số liệu thống kê tổng quan (Metrics Cards)
  const totalStaff = staffList.length;
  const busyStaff = staffList.filter(s => s.activeTasksCount > 0).length;
  const idleStaff = staffList.filter(s => s.status === 'ACTIVE' && s.activeTasksCount === 0).length;
  const lockedStaff = staffList.filter(s => s.status === 'LOCKED').length;

  // Lọc danh sách nhân viên
  const filteredStaff = staffList.filter(staff => {
    const kw = searchKeyword.toLowerCase().trim();
    const matchKw = !kw || 
      staff.fullName?.toLowerCase().includes(kw) ||
      staff.email?.toLowerCase().includes(kw) ||
      staff.phone?.includes(kw);

    const matchStatus = statusFilter === 'ALL' || staff.status === statusFilter;
    const matchWorkload = workloadFilter === 'ALL' ||
      (workloadFilter === 'BUSY' && staff.activeTasksCount > 0) ||
      (workloadFilter === 'IDLE' && staff.status === 'ACTIVE' && staff.activeTasksCount === 0);

    return matchKw && matchStatus && matchWorkload;
  });

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Xử lý tạo nhân viên mới (PR-22, PR-M12)
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!isValidPhone(addForm.phone)) {
      setAddError(PHONE_ERROR);
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      await createFacilityStaff(addForm, currentUser?.id || currentUser?.userId, selectedFacilityId);
      showToast(`Đã tạo thành công tài khoản nhân viên cho ${addForm.fullName}!`);
      setShowAddModal(false);
      setAddForm({ fullName: '', email: '', phone: '', password: '' });
      fetchStaff();
    } catch (err) {
      setAddError(err?.response?.data?.message || 'Có lỗi xảy ra khi tạo nhân viên.');
    } finally {
      setAddLoading(false);
    }
  };

  // Xử lý thay đổi trạng thái Khóa / Mở khóa (PR-06)
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!statusModal.staff) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      await updateFacilityStaffStatus(
        statusModal.staff.id,
        statusModal.targetStatus,
        statusModal.reason,
        currentUser?.id || currentUser?.userId,
        selectedFacilityId
      );
      showToast(`Đã ${statusModal.targetStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản ${statusModal.staff.fullName}!`);
      setStatusModal({ open: false, staff: null, targetStatus: '', reason: '' });
      fetchStaff();
    } catch (err) {
      setStatusError(err?.response?.data?.message || 'Không thể cập nhật trạng thái nhân viên.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Xử lý đặt lại mật khẩu
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!pwdModal.staff) return;
    setPwdLoading(true);
    setPwdError(null);
    try {
      await resetFacilityStaffPassword(
        pwdModal.staff.id,
        pwdModal.newPassword,
        currentUser?.id || currentUser?.userId,
        selectedFacilityId
      );
      showToast(`Đặt lại mật khẩu thành công cho ${pwdModal.staff.fullName}!`);
      setPwdModal({ open: false, staff: null, newPassword: '' });
    } catch (err) {
      setPwdError(err?.response?.data?.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setPwdLoading(false);
    }
  };

  const currentFacilityName = facilities.find(f => f.id === selectedFacilityId)?.name || `Cơ sở #${selectedFacilityId}`;

  return (
    <div className="max-w-[1240px] mx-auto px-6 py-8">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg border-2 text-sm font-bold animate-bounce ${
          toast.type === 'error'
            ? 'bg-[#FFEBEB] border-[#FF9999] text-[#E02424]'
            : 'bg-[#EBFBF0] border-[#84E1BC] text-[#0E9F6E]'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col w-full gap-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
              <span>QueenKho</span>
              <span>/</span>
              <span>{currentFacilityName}</span>
              <span>/</span>
              <span className="text-[#1CB0F6]">Điều Phối Nhân Sự</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
                Quản Lý Nhân Viên Chi Nhánh
              </h1>

              {/* Selector chuyển cơ sở (nếu có quyền) */}
              {facilities.length > 1 && (
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(Number(e.target.value))}
                  className="bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-black rounded-xl px-3 py-1.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden cursor-pointer"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs font-bold text-[#777777] mt-0.5">
              Theo dõi tải công việc ca trực, phân công nhiệm vụ check-in / check-out và quản lý tài khoản nhân viên tại cơ sở.
            </p>
          </div>

          {/* Action Header Button */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={fetchStaff}
              disabled={loading}
              className="h-11 px-4 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] hover:bg-[#EBEBEB] text-[#777777] font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              title="Làm mới danh sách"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Làm mới</span>
            </button>

            <button
              onClick={() => {
                setAddForm({ fullName: '', email: '', phone: '', password: '' });
                setAddError(null);
                setShowAddModal(true);
              }}
              className="h-11 px-5 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] hover:bg-[#4db800] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xs transition-all active:scale-95 active:border-b-0 active:translate-y-1"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span>Thêm Nhân Viên</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng nhân viên */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-[#1CB0F6] transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-[#AFAFAF] uppercase tracking-wider">
                Tổng nhân viên
              </span>
              <span className="text-3xl font-black text-[#4B4B4B] mt-1">
                {String(totalStaff).padStart(2, '0')}
              </span>
              <span className="text-[11px] font-bold text-[#777777] mt-0.5">
                Nhân sự trực thuộc cơ sở
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
              <span className="material-symbols-outlined text-[26px]">groups</span>
            </div>
          </div>

          {/* Card 2: Đang làm nhiệm vụ */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-[#FF9600] transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-[#AFAFAF] uppercase tracking-wider">
                Đang làm nhiệm vụ
              </span>
              <span className="text-3xl font-black text-[#FF9600] mt-1">
                {String(busyStaff).padStart(2, '0')}
              </span>
              <span className="text-[11px] font-bold text-[#777777] mt-0.5">
                Đang giữ task trong ca
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFF5E5] border-2 border-[#FFD8A8] flex items-center justify-center text-[#FF9600]">
              <span className="material-symbols-outlined text-[26px]">engineering</span>
            </div>
          </div>

          {/* Card 3: Sẵn sàng nhận việc */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-[#58CC02] transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-[#AFAFAF] uppercase tracking-wider">
                Sẵn sàng nhận việc
              </span>
              <span className="text-3xl font-black text-[#58CC02] mt-1">
                {String(idleStaff).padStart(2, '0')}
              </span>
              <span className="text-[11px] font-bold text-[#777777] mt-0.5">
                Đang trực ca rảnh rỗi
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#EBFBF0] border-2 border-[#84E1BC] flex items-center justify-center text-[#58CC02]">
              <span className="material-symbols-outlined text-[26px]">person_check</span>
            </div>
          </div>

          {/* Card 4: Tạm khóa */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-[#FF4B4B] transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-[#AFAFAF] uppercase tracking-wider">
                Đang tạm khóa
              </span>
              <span className="text-3xl font-black text-[#E02424] mt-1">
                {String(lockedStaff).padStart(2, '0')}
              </span>
              <span className="text-[11px] font-bold text-[#777777] mt-0.5">
                Ngưng phân công ca trực
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFEBEB] border-2 border-[#FF9999] flex items-center justify-center text-[#E02424]">
              <span className="material-symbols-outlined text-[26px]">lock_person</span>
            </div>
          </div>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc */}
        <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tên, email, số điện thoại..."
              className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-2xl pl-10 pr-4 py-2.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden placeholder:text-[#AFAFAF]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
            {/* Lọc trạng thái */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-black rounded-xl px-3 py-2 focus:border-[#1CB0F6] outline-hidden cursor-pointer"
              >
                <option value="ALL">Tất cả ({totalStaff})</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đang tạm khóa</option>
              </select>
            </div>

            {/* Lọc tải công việc */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Nhiệm vụ:</span>
              <select
                value={workloadFilter}
                onChange={(e) => setWorkloadFilter(e.target.value)}
                className="bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-black rounded-xl px-3 py-2 focus:border-[#1CB0F6] outline-hidden cursor-pointer"
              >
                <option value="ALL">Tất cả tải công việc</option>
                <option value="BUSY">Đang giữ task ({busyStaff})</option>
                <option value="IDLE">Rảnh rỗi ({idleStaff})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bảng Danh Sách Nhân Viên */}
        <div className="duo-card overflow-hidden">
          <ListBoxHeader
            icon="groups"
            title="Danh sách nhân viên trực thuộc"
            subtitle={`Phân công ca trực & nhiệm vụ tại ${currentFacilityName}`}
            count={filteredStaff.length}
            countLabel="nhân viên"
            accentColor="bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]"
          />
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#AFAFAF]">
              <span className="material-symbols-outlined text-[36px] animate-spin text-[#1CB0F6]">
                progress_activity
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">Đang tải danh sách nhân sự...</span>
            </div>
          ) : error ? (
            <div className="py-16 px-6 flex flex-col items-center justify-center text-center gap-3">
              <span className="material-symbols-outlined text-[40px] text-[#E02424]">warning</span>
              <span className="text-sm font-bold text-[#E02424]">{error}</span>
              <button
                onClick={fetchStaff}
                className="mt-2 px-4 py-2 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-xs font-black uppercase text-[#4B4B4B] hover:bg-[#EBEBEB]"
              >
                Thử lại
              </button>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-16 px-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-[44px] text-[#AFAFAF]">person_off</span>
              <span className="text-sm font-black text-[#4B4B4B]">Không tìm thấy nhân viên nào phù hợp</span>
              <p className="text-xs text-[#777777]">Hãy thử đổi từ khóa tìm kiếm hoặc bấm nút "Thêm Nhân Viên" ở góc trên.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E5E5E5] bg-[#F7F7F7] text-[#777777] text-[11px] font-black uppercase tracking-wider">
                    <th className="py-3.5 px-6">Nhân Viên</th>
                    <th className="py-3.5 px-4">Số Điện Thoại</th>
                    <th className="py-3.5 px-4 text-center">Trạng Thái</th>
                    <th className="py-3.5 px-4 text-center">Task Đang Làm</th>
                    <th className="py-3.5 px-4 text-center">Đã Xong Trong Tháng</th>
                    <th className="py-3.5 px-6 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#E5E5E5] text-xs font-bold text-[#4B4B4B]">
                  {paginatedStaff.map((staff) => {
                    const initials = staff.fullName
                      ? staff.fullName.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase()
                      : 'NV';

                    const isBusy = staff.activeTasksCount > 0;
                    const isLocked = staff.status === 'LOCKED';

                    return (
                      <tr key={staff.id} className="hover:bg-[#F9FBFC] transition-colors">
                        {/* Họ tên & Email */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs text-white shrink-0 ${
                              isLocked ? 'bg-[#AFAFAF]' : isBusy ? 'bg-[#FF9600]' : 'bg-[#1CB0F6]'
                            }`}>
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-sm text-[#4B4B4B]">{staff.fullName}</span>
                              <span className="text-[11px] text-[#777777]">{staff.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* SĐT */}
                        <td className="py-4 px-4 font-mono font-bold text-[#4B4B4B]">
                          {staff.phone || 'Chưa cập nhật'}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-4 px-4 text-center">
                          {staff.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-[#EBFBF0] border border-[#84E1BC] text-[#0E9F6E]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0E9F6E]"></span>
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-[#FFEBEB] border border-[#FF9999] text-[#E02424]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E02424]"></span>
                              Tạm khóa
                            </span>
                          )}
                        </td>

                        {/* Số task đang làm */}
                        <td className="py-4 px-4 text-center">
                          {isBusy ? (
                            <button
                              type="button"
                              onClick={() => openStaffTasksModal(staff)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black bg-[#FFF5E5] border border-[#FFD8A8] text-[#FF9600] hover:bg-[#FFE8CC] transition-all cursor-pointer"
                              title="Bấm để xem danh sách task của nhân viên này"
                            >
                              <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                              <span>{staff.activeTasksCount} task</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openStaffTasksModal(staff)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-[#AFAFAF] bg-[#F7F7F7] hover:bg-[#EBEBEB] hover:text-[#4B4B4B] transition-all cursor-pointer"
                              title="Bấm để xem lịch sử task của nhân viên này"
                            >
                              Rảnh rỗi
                            </button>
                          )}
                        </td>

                        {/* Đã xong trong tháng */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black bg-[#F3F4F6] text-[#4B4B4B]">
                            <span className="material-symbols-outlined text-[16px] text-[#58CC02]">task_alt</span>
                            <span>{staff.completedTasksThisMonthCount}</span>
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Nút xem task dạng Pop-up */}
                            <button
                              type="button"
                              onClick={() => openStaffTasksModal(staff)}
                              className="px-3 py-1.5 rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] hover:bg-[#DDF4FF] hover:border-[#84D8FF] hover:text-[#1CB0F6] text-[#777777] text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                              title="Xem danh sách công việc của riêng nhân viên này"
                            >
                              <span className="material-symbols-outlined text-[16px]">assignment</span>
                              <span>Xem task</span>
                            </button>

                            {/* Nút Đổi mật khẩu */}
                            <button
                              onClick={() => {
                                setPwdModal({ open: true, staff, newPassword: '' });
                                setPwdError(null);
                              }}
                              className="p-1.5 rounded-xl border border-[#E5E5E5] hover:bg-[#F7F7F7] text-[#777777] transition-all cursor-pointer"
                              title="Đặt lại mật khẩu"
                            >
                              <span className="material-symbols-outlined text-[18px]">key</span>
                            </button>

                            {/* Nút Khóa / Mở khóa (PR-06) */}
                            {staff.status === 'ACTIVE' ? (
                              <button
                                onClick={() => {
                                  setStatusModal({
                                    open: true,
                                    staff,
                                    targetStatus: 'LOCKED',
                                    reason: ''
                                  });
                                  setStatusError(null);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#FFEBEB] border border-[#FF9999] hover:bg-[#FFD4D4] text-[#E02424] text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                title="Tạm khóa tài khoản"
                              >
                                <span className="material-symbols-outlined text-[16px]">lock</span>
                                <span>Khóa</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setStatusModal({
                                    open: true,
                                    staff,
                                    targetStatus: 'ACTIVE',
                                    reason: ''
                                  });
                                  setStatusError(null);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#EBFBF0] border border-[#84E1BC] hover:bg-[#DEF7EC] text-[#0E9F6E] text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                title="Mở khóa tài khoản"
                              >
                                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                                <span>Mở</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && filteredStaff.length > 0 && (
            <PaginationBar
              currentPage={safePage}
              totalItems={filteredStaff.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="nhân viên"
            />
          )}
        </div>
      </div>

      {/* ==================== MODAL 1: THÊM NHÂN VIÊN MỚI ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#DDF4FF] border border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <h3 className="text-lg font-black text-[#4B4B4B]">Thêm Nhân Viên Mới</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#AFAFAF] hover:text-[#4B4B4B] p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {addError && (
              <div className="bg-[#FFEBEB] border-2 border-[#FF9999] rounded-2xl p-3 text-xs font-bold text-[#E02424] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Cơ sở trực thuộc
                </label>
                <input
                  type="text"
                  disabled
                  value={currentFacilityName}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#AFAFAF] text-xs font-black rounded-xl px-3.5 py-2.5 cursor-not-allowed"
                />
                <span className="text-[10px] text-[#AFAFAF] mt-1 block">
                  * Tự động gán cơ sở do bạn phụ trách (Rule PR-22)
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Họ và tên <span className="text-[#E02424]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl px-3.5 py-2.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Email đăng nhập <span className="text-[#E02424]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff.tanbinh@gmail.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl px-3.5 py-2.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Số điện thoại <span className="text-[#E02424]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0901234567"
                  inputMode="numeric"
                  maxLength={10}
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: digitsOnly(e.target.value, 10) })}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl px-3.5 py-2.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Mật khẩu khởi tạo <span className="text-[#E02424]">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Tối thiểu 6 ký tự"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl px-3.5 py-2.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5] mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#777777] text-xs font-black uppercase hover:bg-[#EBEBEB] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] text-white text-xs font-black uppercase hover:bg-[#4db800] cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {addLoading ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: KHÓA / MỞ KHÓA TÀI KHOẢN (PR-06) ==================== */}
      {statusModal.open && statusModal.staff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${
                statusModal.targetStatus === 'LOCKED' ? 'bg-[#E02424]' : 'bg-[#0E9F6E]'
              }`}>
                <span className="material-symbols-outlined text-[24px]">
                  {statusModal.targetStatus === 'LOCKED' ? 'lock' : 'lock_open'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">
                  {statusModal.targetStatus === 'LOCKED' ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa tài khoản'}
                </h3>
                <span className="text-xs text-[#777777]">{statusModal.staff.fullName} ({statusModal.staff.email})</span>
              </div>
            </div>

            {statusError && (
              <div className="bg-[#FFEBEB] border-2 border-[#FF9999] rounded-2xl p-3 text-xs font-bold text-[#E02424] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{statusError}</span>
              </div>
            )}

            {/* Cảnh báo đặc thù nếu nhân viên đang giữ task */}
            {statusModal.targetStatus === 'LOCKED' && statusModal.staff.activeTasksCount > 0 && (
              <div className="bg-[#FFF5E5] border-2 border-[#FFD8A8] rounded-2xl p-3 text-xs font-bold text-[#FF9600] flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span>
                  Nhân viên này đang giữ <strong>{statusModal.staff.activeTasksCount} task</strong> chưa hoàn tất. Theo rule PR-06, hệ thống sẽ chặn khóa cho tới khi quản lý gỡ người nhận trên Bảng công việc!
                </span>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Lý do {statusModal.targetStatus === 'LOCKED' ? 'khóa' : 'mở khóa'}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={statusModal.targetStatus === 'LOCKED' ? 'Ví dụ: Tạm nghỉ phép / Chuyển ca trực...' : 'Ví dụ: Quay lại làm việc...'}
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl p-3 focus:border-[#1CB0F6] focus:bg-white outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setStatusModal({ open: false, staff: null, targetStatus: '', reason: '' })}
                  className="px-4 py-2.5 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#777777] text-xs font-black uppercase hover:bg-[#EBEBEB] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={statusLoading}
                  className={`px-5 py-2.5 rounded-2xl text-white text-xs font-black uppercase cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                    statusModal.targetStatus === 'LOCKED'
                      ? 'bg-[#E02424] hover:bg-[#C81E1E]'
                      : 'bg-[#58CC02] hover:bg-[#4db800]'
                  }`}
                >
                  {statusLoading ? 'Đang xử lý...' : statusModal.targetStatus === 'LOCKED' ? 'Xác Nhận Khóa' : 'Xác Nhận Mở'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: ĐẶT LẠI MẬT KHẨU ==================== */}
      {pwdModal.open && pwdModal.staff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#DDF4FF] border border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                <span className="material-symbols-outlined text-[22px]">key</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">Đặt Lại Mật Khẩu</h3>
                <span className="text-xs text-[#777777]">{pwdModal.staff.fullName}</span>
              </div>
            </div>

            {pwdError && (
              <div className="bg-[#FFEBEB] border-2 border-[#FF9999] rounded-2xl p-3 text-xs font-bold text-[#E02424] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{pwdError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase text-[#777777] mb-1.5">
                  Mật khẩu mới <span className="text-[#E02424]">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  value={pwdModal.newPassword}
                  onChange={(e) => setPwdModal({ ...pwdModal, newPassword: e.target.value })}
                  className="w-full bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl px-3.5 py-2.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setPwdModal({ open: false, staff: null, newPassword: '' })}
                  className="px-4 py-2.5 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-[#777777] text-xs font-black uppercase hover:bg-[#EBEBEB] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-5 py-2.5 rounded-2xl bg-[#1CB0F6] hover:bg-[#009CEB] text-white text-xs font-black uppercase cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {pwdLoading ? 'Đang lưu...' : 'Lưu Mật Khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: POP UP DANH SÁCH TASK CỦA NHÂN VIÊN ==================== */}
      {tasksModal.open && tasksModal.staff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setTasksModal(prev => ({ ...prev, open: false }))}
        >
          <div
            className="bg-white border-2 border-[#E5E5E5] rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                  <span className="material-symbols-outlined text-[26px]">badge</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#4B4B4B]">{tasksModal.staff.fullName}</h3>
                    {tasksModal.staff.status === 'ACTIVE' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#EBFBF0] border border-[#84E1BC] text-[#0E9F6E]">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFEBEB] border border-[#FF9999] text-[#E02424]">
                        Tạm khóa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#777777] font-bold mt-0.5 flex items-center gap-2">
                    <span>{tasksModal.staff.email}</span>
                    {tasksModal.staff.phone && <span>· SĐT: {tasksModal.staff.phone}</span>}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTasksModal(prev => ({ ...prev, open: false }))}
                className="w-9 h-9 rounded-xl border border-[#E5E5E5] hover:bg-[#F7F7F7] text-[#777777] flex items-center justify-center transition-all cursor-pointer"
                title="Đóng popup"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Thống kê nhanh mini cards */}
            <div className="grid grid-cols-4 gap-2.5 my-3.5">
              <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-2xl p-2.5 text-center">
                <span className="text-[11px] font-black text-[#777777] uppercase block">Tổng task</span>
                <span className="text-base font-black text-[#4B4B4B]">{tasksModal.tasks.length}</span>
              </div>
              <div className="bg-[#FFF5E5] border border-[#FFD8A8] rounded-2xl p-2.5 text-center">
                <span className="text-[11px] font-black text-[#FF9600] uppercase block">Đang làm</span>
                <span className="text-base font-black text-[#FF9600]">
                  {tasksModal.tasks.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length}
                </span>
              </div>
              <div className="bg-[#FFDFDF] border border-[#FF9999] rounded-2xl p-2.5 text-center">
                <span className="text-[11px] font-black text-[#FF4B4B] uppercase block">Quá hạn</span>
                <span className="text-base font-black text-[#FF4B4B]">
                  {tasksModal.tasks.filter(t => t.status === 'OVERDUE').length}
                </span>
              </div>
              <div className="bg-[#EBFBF0] border border-[#84E1BC] rounded-2xl p-2.5 text-center">
                <span className="text-[11px] font-black text-[#0E9F6E] uppercase block">Đã xong</span>
                <span className="text-base font-black text-[#0E9F6E]">
                  {tasksModal.tasks.filter(t => t.status === 'COMPLETED').length}
                </span>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1 bg-[#F7F7F7] p-1 rounded-2xl border border-[#E5E5E5]">
                {[
                  { key: 'ALL', label: 'Tất cả', count: tasksModal.tasks.length },
                  { key: 'ACTIVE', label: 'Cần xử lý', count: tasksModal.tasks.filter(t => ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(t.status)).length },
                  { key: 'COMPLETED', label: 'Hoàn thành', count: tasksModal.tasks.filter(t => t.status === 'COMPLETED').length }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTasksModal(prev => ({ ...prev, filter: tab.key }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      tasksModal.filter === tab.key
                        ? 'bg-white text-[#1CB0F6] shadow-xs'
                        : 'text-[#777777] hover:text-[#4B4B4B]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                      tasksModal.filter === tab.key ? 'bg-[#DDF4FF] text-[#1CB0F6]' : 'bg-[#E5E5E5] text-[#777777]'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Tìm task, HĐ, ô kho..."
                  value={tasksModal.search}
                  onChange={(e) => setTasksModal(prev => ({ ...prev, search: e.target.value }))}
                  className="bg-[#F7F7F7] border border-[#E5E5E5] text-[#4B4B4B] text-xs font-bold rounded-xl pl-8 pr-3 py-1.5 focus:border-[#1CB0F6] focus:bg-white outline-hidden w-full sm:w-56"
                />
              </div>
            </div>

            {/* List Tasks Content */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-[220px]">
              {tasksModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#AFAFAF]">
                  <span className="material-symbols-outlined animate-spin text-[32px] text-[#1CB0F6]">progress_activity</span>
                  <span className="text-xs font-bold">Đang tải danh sách công việc...</span>
                </div>
              ) : tasksModal.error ? (
                <div className="bg-[#FFEBEB] border-2 border-[#FF9999] rounded-2xl p-4 text-xs font-bold text-[#E02424] flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px]">error</span>
                  <div className="flex-1">
                    <p className="font-black">Lỗi tải dữ liệu</p>
                    <p>{tasksModal.error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openStaffTasksModal(tasksModal.staff)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#FF9999] hover:bg-[#FFEBEB] text-[#E02424] text-xs font-black cursor-pointer"
                  >
                    Thử lại
                  </button>
                </div>
              ) : tasksModal.tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-[#777777]">
                  <div className="w-14 h-14 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center text-[#AFAFAF] mb-3">
                    <span className="material-symbols-outlined text-[28px]">assignment_turned_in</span>
                  </div>
                  <p className="text-sm font-black text-[#4B4B4B]">Không có công việc nào</p>
                  <p className="text-xs text-[#AFAFAF] font-bold mt-1">Nhân viên này hiện chưa được giao bất kỳ công việc nào.</p>
                </div>
              ) : (() => {
                const filteredTasks = tasksModal.tasks.filter((t) => {
                  if (tasksModal.filter === 'ACTIVE') {
                    if (!['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(t.status)) return false;
                  } else if (tasksModal.filter === 'COMPLETED') {
                    if (t.status !== 'COMPLETED') return false;
                  }
                  if (tasksModal.search.trim()) {
                    const q = tasksModal.search.toLowerCase().trim();
                    const matchId = String(t.id).includes(q);
                    const matchContract = t.contractCode?.toLowerCase().includes(q);
                    const matchUnit = t.storageUnitId?.toLowerCase().includes(q);
                    const matchCustomer = t.customerName?.toLowerCase().includes(q) || t.customerPhone?.includes(q);
                    const matchTicket = t.ticketCode?.toLowerCase().includes(q);
                    const matchNote = t.note?.toLowerCase().includes(q);
                    return matchId || matchContract || matchUnit || matchCustomer || matchTicket || matchNote;
                  }
                  return true;
                });

                if (filteredTasks.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-[#777777]">
                      <span className="material-symbols-outlined text-[32px] text-[#AFAFAF] mb-1">filter_alt_off</span>
                      <p className="text-xs font-bold text-[#AFAFAF]">Không tìm thấy công việc nào khớp với bộ lọc.</p>
                    </div>
                  );
                }

                return filteredTasks.map((task) => {
                  const typeMeta = TASK_TYPE_META[task.taskType] || { label: task.taskType, icon: 'assignment', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' };
                  const statusMeta = TASK_STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' };
                  const isOverdue = task.status === 'OVERDUE';

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border-2 border-[#E5E5E5] bg-[#FAFAFA] hover:bg-white hover:border-[#1CB0F6] transition-all p-3.5 flex flex-col gap-2.5"
                    >
                      {/* Row 1: Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#777777]">#{task.id}</span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black border ${typeMeta.cls}`}>
                            <span className="material-symbols-outlined text-[14px]">{typeMeta.icon}</span>
                            <span>{typeMeta.label}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                          {task.urgent && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-[#FFEBEB] text-[#E02424] border border-[#FF9999] animate-pulse">
                              KHẨN CẤP
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-black flex items-center gap-1 ${isOverdue ? 'text-[#FF4B4B]' : 'text-[#777777]'}`}>
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            <span>Hạn: {formatTaskDue(task.dueAt)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Nội dung liên quan */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-[#E5E5E5]">
                        <div>
                          {task.contractCode ? (
                            <p className="font-bold text-[#4B4B4B]">
                              <span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Hợp đồng:</span>
                              <span className="font-black text-[#1CB0F6]">{task.contractCode}</span>
                            </p>
                          ) : task.supportRequestId ? (
                            <p className="font-bold text-[#4B4B4B]">
                              <span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Ticket:</span>
                              <span className="font-black text-[#A560E8]">{task.ticketCode || `#${task.supportRequestId}`}</span>
                            </p>
                          ) : (
                            <p className="font-bold text-[#777777]">Nhiệm vụ nội bộ cơ sở</p>
                          )}

                          {task.storageUnitId && (
                            <p className="font-bold text-[#4B4B4B] mt-0.5">
                              <span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Ô kho:</span>
                              <span className="font-black">{task.storageUnitId}</span>
                              {task.unitTypeName && <span className="text-[#777777] font-semibold"> ({task.unitTypeName})</span>}
                            </p>
                          )}
                        </div>

                        <div>
                          {task.customerName && (
                            <p className="font-bold text-[#4B4B4B]">
                              <span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Khách:</span>
                              <span>{task.customerName}</span>
                              {task.customerPhone && <span className="text-[#777777] font-semibold"> · {task.customerPhone}</span>}
                            </p>
                          )}

                          {task.taskType === 'SUPPORT' && task.issueType && (
                            <p className="font-bold text-[#4B4B4B] mt-0.5">
                              <span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Sự cố:</span>
                              <span>{SUPPORT_ISSUE_LABELS[task.issueType] || task.issueType}</span>
                            </p>
                          )}

                          {task.completedAt && (
                            <p className="font-bold text-[#58A700] mt-0.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">check_circle</span>
                              <span>Xong lúc: {formatTaskDateTime(task.completedAt)}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Ghi chú hoặc mô tả nếu có */}
                      {task.note && (
                        <p className="text-[11px] font-bold text-[#777777] bg-[#F7F7F7] px-2.5 py-1.5 rounded-lg border border-[#EBEBEB] line-clamp-2">
                          <span className="text-[#AFAFAF] uppercase text-[10px] font-black mr-1">Ghi chú:</span>
                          {task.note}
                        </p>
                      )}

                      {/* Footer card: Nút chi tiết task */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#E5E5E5]/60">
                        <span className="text-[11px] font-bold text-[#AFAFAF]">
                          Tạo ngày {formatTaskDateTime(task.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTasksModal(prev => ({ ...prev, open: false }));
                            navigate(`/manager/tasks/${task.id}`);
                          }}
                          className="px-3 py-1 rounded-xl bg-white border border-[#E5E5E5] hover:bg-[#DDF4FF] hover:border-[#84D8FF] hover:text-[#1CB0F6] text-[#777777] text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Xem chi tiết</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-[#E5E5E5] mt-3">
              <button
                type="button"
                onClick={() => {
                  const staffId = tasksModal.staff.id;
                  setTasksModal(prev => ({ ...prev, open: false }));
                  navigate(`/manager/tasks?staffId=${staffId}`);
                }}
                className="px-3.5 py-2 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] hover:bg-[#DDF4FF] hover:border-[#84D8FF] hover:text-[#1CB0F6] text-[#777777] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                <span>Mở trên Bảng công việc</span>
              </button>

              <button
                type="button"
                onClick={() => setTasksModal(prev => ({ ...prev, open: false }))}
                className="px-5 py-2 rounded-2xl bg-[#58CC02] border-b-4 border-[#58A700] text-white text-xs font-black uppercase hover:bg-[#4db800] cursor-pointer shadow-xs active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

