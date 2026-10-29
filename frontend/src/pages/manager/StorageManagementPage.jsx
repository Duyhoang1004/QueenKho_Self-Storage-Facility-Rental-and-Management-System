import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStorageUnits,
  createStorageUnit,
  updateStorageUnitStatus,
  deleteStorageUnit,
  getFacilityLayout
} from '../../services/storageUnitService';
import { getAllUnitTypes } from '../../services/facilityService';
import PaginationBar, { ListBoxHeader } from '../../components/PaginationBar';
import FloorPlanBoard from '../../components/FloorPlanBoard';
import UnitPositionPicker from '../../components/UnitPositionPicker';
import { DISPLAY_STATES, getDisplayState } from '../../utils/unitDisplayState';
import { defaultUnitSize, isPlacementValid, sameFloor } from '../../utils/floorPlan';

const PAGE_SIZE = 5;
const VIEW_MODE_KEY = 'storageUnitsViewMode';

// Chế độ xem chỉ là tiện ích cho người xem, đọc lỗi thì mặc định sơ đồ
function readViewMode() {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'LIST' ? 'LIST' : 'MAP';
  } catch {
    return 'MAP';
  }
}

export default function StorageManagementPage() {
  const navigate = useNavigate();

  // 1. User & Facility session context
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const facilityId = currentUser.facilityId || 1;
  const facilityName = currentUser.facilityName || 'Cơ sở Tân Bình';
  const actorUserId = currentUser.userId || 1;

  // 2. Data state
  const [data, setData] = useState({
    units: [],
    totalUnits: 0,
    availableUnits: 0,
    occupiedUnits: 0,
    maintenanceUnits: 0,
    overdueUnits: 0,
    occupancyRate: 0,
    floors: []
  });
  const [unitTypes, setUnitTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }

  // 3. Filter state
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [unitTypeFilter, setUnitTypeFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // UC-06: Sơ đồ mặt bằng (MAP) hoặc bảng danh sách (LIST)
  const [viewMode, setViewMode] = useState(readViewMode);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [layout, setLayout] = useState(null);       // mặt bằng các tầng
  const [allUnits, setAllUnits] = useState([]);     // mọi ô của cơ sở (sơ đồ không bị bộ lọc cắt mất ô)
  const [editingMap, setEditingMap] = useState(false);

  // 4. Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    unitTypeId: '',
    floor: 'Tầng 1',
    zone: 'A',
    roomNumber: '',
    mapPosition: null, // { x, y, door } — chỗ đặt trên mặt bằng (tuỳ chọn)
    rotated: false
  });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const [statusModal, setStatusModal] = useState({
    show: false,
    unit: null,
    targetStatus: 'MAINTENANCE',
    note: '',
    isSubmitting: false
  });

  const [deleteModal, setDeleteModal] = useState({
    show: false,
    unit: null,
    isSubmitting: false
  });

  // Tự động tắt Toast sau 4 giây
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load danh mục loại kho
  useEffect(() => {
    getAllUnitTypes()
      .then(res => {
        setUnitTypes(res || []);
        if (res && res.length > 0) {
          setAddForm(prev => ({ ...prev, unitTypeId: res[0].id }));
        }
      })
      .catch(err => console.error('Không thể tải danh sách loại kho:', err));
  }, []);

  // Fetch danh sách ô kho
  const fetchStorageUnits = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getStorageUnits({
        facilityId,
        status: statusFilter,
        floor: floorFilter,
        unitTypeId: unitTypeFilter || undefined,
        keyword: searchKeyword || undefined
      });
      setData(res);
    } catch (err) {
      console.error('Lỗi lấy danh sách ô kho:', err);
      const msg = err.response?.data?.message || 'Không thể tải danh sách ô kho từ máy chủ.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchStorageUnits();
  }, [facilityId, statusFilter, floorFilter, unitTypeFilter, searchKeyword]);

  // UC-06: mặt bằng + toàn bộ ô (không lọc) cho sơ đồ
  const loadFloorPlan = (id) => Promise.all([getFacilityLayout(id), getStorageUnits({ facilityId: id })]);

  const fetchFloorPlan = async () => {
    try {
      const [layoutRes, unitsRes] = await loadFloorPlan(facilityId);
      setLayout(layoutRes);
      setAllUnits(unitsRes.units || []);
    } catch (err) {
      console.error('Lỗi lấy mặt bằng ô kho:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadFloorPlan(facilityId)
      .then(([layoutRes, unitsRes]) => {
        if (cancelled) return;
        setLayout(layoutRes);
        setAllUnits(unitsRes.units || []);
      })
      .catch(err => console.error('Lỗi lấy mặt bằng ô kho:', err));
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  // Tải lại cả danh sách đang lọc lẫn sơ đồ sau mỗi thao tác
  const reloadAll = () => Promise.all([fetchStorageUnits(), fetchFloorPlan()]);

  const filtersActive = statusFilter !== 'ALL' || floorFilter !== 'ALL' || !!unitTypeFilter || !!searchKeyword;
  const matchedIds = useMemo(
    () => (filtersActive ? new Set((data.units || []).map(u => u.id)) : null),
    [filtersActive, data.units]
  );

  const totalPages = Math.max(1, Math.ceil((data.units?.length || 0) / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUnits = (data.units || []).slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Ô đang chọn trên sơ đồ (tự mất khi ô bị xoá)
  const selectedUnit = allUnits.find(u => u.id === selectedUnitId)
    || (data.units || []).find(u => u.id === selectedUnitId)
    || null;

  // Form thêm ô: mặt bằng của tầng đang chọn + kích thước ô mới theo loại kho
  const addFloorPlan = (layout?.floors || []).find(f => sameFloor(f.name, addForm.floor)) || null;
  const addUnitType = unitTypes.find(ut => String(ut.id) === String(addForm.unitTypeId));
  const addBaseSize = defaultUnitSize(addUnitType?.dimensions, addUnitType?.areaSqm);
  const addSize = addForm.rotated ? { w: addBaseSize.h, h: addBaseSize.w } : addBaseSize;

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // Bỏ qua: trình duyệt chặn storage thì chỉ không nhớ lựa chọn
    }
  };

  // Nút thao tác của một ô — dùng chung cho dòng bảng và panel chi tiết trên sơ đồ
  const renderUnitActions = (unit) => (
    <>
      {/* Khóa bảo trì */}
      {unit.status === 'AVAILABLE' && (
        <button
          type="button"
          onClick={() => openStatusModal(unit, 'MAINTENANCE')}
          className="duo-btn-white px-3 py-1.5 text-[11px] text-[#E58800] border-[#FF9600]"
          title="Khóa ô kho để bảo trì sửa chữa"
        >
          Khóa bảo trì
        </button>
      )}

      {/* Mở lại kho */}
      {unit.status === 'MAINTENANCE' && (
        <button
          type="button"
          onClick={() => openStatusModal(unit, 'AVAILABLE')}
          className="duo-btn-green px-3 py-1.5 text-[11px]"
          title="Xác nhận sửa xong, đưa ô vào sử dụng"
        >
          Mở lại kho
        </button>
      )}

      {/* Xem HĐ */}
      {unit.status === 'OCCUPIED' && unit.currentContract && (
        <button
          type="button"
          onClick={() => navigate(`/manager/contracts/${unit.currentContract.contractId}`)}
          className="duo-btn-blue px-3 py-1.5 text-[11px]"
          title="Xem chi tiết hợp đồng"
        >
          Xem HĐ
        </button>
      )}

      {/* Xóa ô kho */}
      {unit.canDelete && (
        <button
          type="button"
          onClick={() => openDeleteModal(unit)}
          className="p-1 rounded-xl text-[#AFAFAF] hover:text-[#FF4B4B] hover:bg-[#FFDFDF] transition-colors"
          title="Xóa ô kho (Chưa có hợp đồng)"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      )}
    </>
  );

  // PR-O10: ô vào bảo trì do sự cố trả kho / thanh lý → có task đang mở
  const renderMaintenanceTaskLink = (unit) =>
    unit.status === 'MAINTENANCE' && unit.maintenanceTaskId ? (
      <button
        type="button"
        onClick={() => navigate(`/manager/tasks/${unit.maintenanceTaskId}`)}
        className="text-[10px] font-black text-[#1CB0F6] hover:underline cursor-pointer whitespace-nowrap"
        title="Mở phiếu bảo trì"
      >
        {unit.maintenanceReason === 'LIQUIDATION' ? 'Chờ dọn' : 'Chờ sửa'} · task #{unit.maintenanceTaskId}
      </button>
    ) : null;

  const renderStatusBadge = (unit) => {
    const style = DISPLAY_STATES[getDisplayState(unit)];
    return <span className={`duo-badge ${style.badge}`}>{style.label}</span>;
  };

  // Xử lý tạo ô kho mới (PR-M9)
  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!addForm.roomNumber.trim()) {
      setToast({ type: 'error', message: 'Vui lòng nhập số phòng' });
      return;
    }
    // UC-06: chỉ gửi vị trí khi tầng có mặt bằng; chỗ đã chọn phải trống
    const position = addFloorPlan ? addForm.mapPosition : null;
    if (position && !isPlacementValid(addFloorPlan, allUnits, addSize, position)) {
      setToast({ type: 'error', message: 'Vị trí đã chọn chồng lên ô khác hoặc lối đi, hãy chọn chỗ khác.' });
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await createStorageUnit(
        {
          unitTypeId: Number(addForm.unitTypeId),
          floor: addForm.floor.trim(),
          zone: addForm.zone.trim().toUpperCase(),
          roomNumber: addForm.roomNumber.trim(),
          ...(position && {
            mapX: Math.min(position.x, addFloorPlan.gridWidth - addSize.w),
            mapY: Math.min(position.y, addFloorPlan.gridHeight - addSize.h),
            mapW: addSize.w,
            mapH: addSize.h,
            mapDoor: position.door
          })
        },
        facilityId,
        actorUserId
      );

      setToast({
        type: 'success',
        message: `Đã khởi tạo thành công ô kho ${res.id}${position ? ' và đặt trên mặt bằng' : ''}!`
      });
      setShowAddModal(false);
      setAddForm(prev => ({ ...prev, roomNumber: '', mapPosition: null }));
      reloadAll();
    } catch (err) {
      console.error('Lỗi tạo ô kho:', err);
      const msg = err.response?.data?.message || 'Không thể tạo ô kho mới.';
      setToast({ type: 'error', message: msg });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Mở modal xác nhận đổi trạng thái
  const openStatusModal = (unit, targetStatus) => {
    setStatusModal({
      show: true,
      unit,
      targetStatus,
      note: '',
      isSubmitting: false
    });
  };

  // Xác nhận đổi trạng thái AVAILABLE ⇄ MAINTENANCE (PR-M10, BR-11)
  const handleConfirmStatusChange = async () => {
    if (!statusModal.unit) return;
    setStatusModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      await updateStorageUnitStatus(
        statusModal.unit.id,
        statusModal.targetStatus,
        statusModal.note,
        actorUserId
      );

      setToast({
        type: 'success',
        message: `Đã chuyển ô kho ${statusModal.unit.id} sang trạng thái ${
          statusModal.targetStatus === 'AVAILABLE' ? 'Còn trống (Khả dụng)' : 'Bảo trì'
        } thành công.`
      });
      setStatusModal({ show: false, unit: null, targetStatus: 'MAINTENANCE', note: '', isSubmitting: false });
      reloadAll();
    } catch (err) {
      console.error('Lỗi đổi trạng thái:', err);
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái ô kho.';
      setToast({ type: 'error', message: msg });
      setStatusModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Mở modal xóa
  const openDeleteModal = (unit) => {
    setDeleteModal({
      show: true,
      unit,
      isSubmitting: false
    });
  };

  // Xác nhận xóa ô kho (PR-21)
  const handleConfirmDelete = async () => {
    if (!deleteModal.unit) return;
    setDeleteModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      await deleteStorageUnit(deleteModal.unit.id, actorUserId);
      setToast({
        type: 'success',
        message: `Đã xóa ô kho ${deleteModal.unit.id} thành công.`
      });
      setDeleteModal({ show: false, unit: null, isSubmitting: false });
      reloadAll();
    } catch (err) {
      console.error('Lỗi xóa ô kho:', err);
      const msg = err.response?.data?.message || 'Không thể xóa ô kho.';
      setToast({ type: 'error', message: msg });
      setDeleteModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Reset bộ lọc
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setFloorFilter('ALL');
    setUnitTypeFilter('');
    setSearchKeyword('');
  };

  // Dự tính mã ô kho khi gõ form (PR-M9 preview)
  const calculatedCodePreview = useMemo(() => {
    const fCode = data.units?.[0]?.facilityCode || 'CS';
    const z = (addForm.zone || 'A').trim().toUpperCase();
    let r = (addForm.roomNumber || '101').trim();
    if (r.match(/^\d+$/) && r.length < 3) {
      r = r.padStart(3, '0');
    }
    return `KV-${fCode}-${z}${r}`;
  }, [data.units, addForm.zone, addForm.roomNumber]);

  return (
    <div className="max-w-[1240px] mx-auto px-6 py-8">
      {/* Toast Alert Notification (Duolingo Style) */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl border-2 shadow-xl flex items-center gap-3 transition-all animate-bounce ${
            toast.type === 'success'
              ? 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]'
              : 'bg-[#FFDFDF] border-[#FF4B4B] text-[#FF4B4B]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-sm font-black">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="hover:opacity-75 transition-opacity ml-2"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="flex flex-col w-full gap-6">

        {/* 1. Header & Live Metrics (Thống nhất chuẩn Duolingo) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
              <span>QueenKho</span>
              <span>/</span>
              <span>{facilityName}</span>
              <span>/</span>
              <span className="text-[#58CC02]">Quản lý ô kho</span>
            </div>
            <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
              Quản Lý Danh Mục Ô Kho
            </h1>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Tổng {data.totalUnits} khoang chứa tiêu chuẩn • Cập nhật tự động theo mã khoá SmartLock và hợp đồng
            </p>
          </div>

          {/* Quick KPI Counters */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Thẻ Khả dụng */}
            <div className="duo-card px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700]">
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Khả dụng</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-[#4B4B4B]">{data.availableUnits}</span>
                  <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[10px]">
                    Ô trống
                  </span>
                </div>
              </div>
            </div>

            {/* Thẻ Tỉ lệ lấp đầy */}
            <div className="duo-card px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#DDF4FF] border-2 border-[#1CB0F6] flex items-center justify-center text-[#1CB0F6]">
                <span className="material-symbols-outlined text-[22px]">door_sliding</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Tỉ lệ lấp đầy</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-[#4B4B4B]">{data.occupancyRate}%</span>
                  <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border border-[#84D8FF] text-[10px]">
                    {data.occupiedUnits}/{data.totalUnits}
                  </span>
                </div>
              </div>
            </div>

            {/* Thẻ Cần chú ý (Nếu có ô quá hạn hoặc bảo trì) */}
            {(data.maintenanceUnits > 0 || data.overdueUnits > 0) && (
              <div className="duo-card px-4 py-2.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFDFDF] border-2 border-[#FF4B4B] flex items-center justify-center text-[#FF4B4B]">
                  <span className="material-symbols-outlined text-[22px]">warning</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Cần xử lý</span>
                  <span className="text-base font-black text-[#FF4B4B]">
                    {data.overdueUnits > 0 && `${data.overdueUnits} Quá hạn`}
                    {data.overdueUnits > 0 && data.maintenanceUnits > 0 && ' • '}
                    {data.maintenanceUnits > 0 && `${data.maintenanceUnits} Bảo trì`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Filter & Action Bar (Duo-Card Style) */}
        <div className="duo-card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Filter Tabs */}
            <div className="flex items-center flex-wrap gap-2">
              {[
                { id: 'ALL', label: `Tất cả (${data.totalUnits})` },
                { id: 'AVAILABLE', label: `Còn trống (${data.availableUnits})` },
                { id: 'OCCUPIED', label: `Đang thuê (${data.occupiedUnits})` },
                { id: 'MAINTENANCE', label: `Bảo trì (${data.maintenanceUnits})` },
                ...(data.overdueUnits > 0
                  ? [{ id: 'OVERDUE', label: `Quá hạn (${data.overdueUnits})` }]
                  : [])
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-4 py-2 text-xs font-black rounded-2xl transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'duo-btn-green'
                      : 'duo-btn-gray'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Action Buttons: Làm mới & Thêm Kho Mới */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={reloadAll}
                className="duo-btn-white px-4 py-2.5 text-xs"
              >
                <span className="material-symbols-outlined text-[18px] mr-1">refresh</span>
                <span>LÀM MỚI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="duo-btn-green px-4 py-2.5 text-xs"
              >
                <span className="material-symbols-outlined text-[18px] mr-1">add_box</span>
                <span>+ THÊM Ô KHO MỚI</span>
              </button>
            </div>
          </div>

          {/* Row 2: Search, Floor, Unit Type filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t-2 border-[#E5E5E5]">
            <div className="md:col-span-5 relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#AFAFAF]">
                search
              </span>
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="Tìm kiếm mã ô kho, vị trí, khách thuê..."
                className="duo-input w-full pl-10 text-xs py-2.5"
              />
            </div>

            <div className="md:col-span-3 relative">
              <select
                value={floorFilter}
                onChange={e => setFloorFilter(e.target.value)}
                className="duo-input w-full text-xs py-2.5 cursor-pointer appearance-none"
              >
                <option value="ALL">Vị trí: Tất cả tầng</option>
                {data.floors?.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#AFAFAF] pointer-events-none">
                expand_more
              </span>
            </div>

            <div className="md:col-span-3 relative">
              <select
                value={unitTypeFilter}
                onChange={e => setUnitTypeFilter(e.target.value)}
                className="duo-input w-full text-xs py-2.5 cursor-pointer appearance-none"
              >
                <option value="">Loại kho: Tất cả phân loại</option>
                {unitTypes.map(ut => (
                  <option key={ut.id} value={ut.id}>
                    {ut.name} ({ut.areaSqm}m²)
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#AFAFAF] pointer-events-none">
                expand_more
              </span>
            </div>

            <div className="md:col-span-1 flex items-center justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="duo-btn-gray w-full h-full py-2.5 flex items-center justify-center text-xs"
                title="Đặt lại bộ lọc"
              >
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Sơ đồ ô kho / Bảng danh sách (Duo-Card Style) */}
        <div className="duo-card overflow-hidden">
          <ListBoxHeader
            icon={viewMode === 'MAP' ? 'grid_view' : 'inventory_2'}
            title={viewMode === 'MAP' ? 'Sơ đồ ô kho tại cơ sở' : 'Danh sách ô kho tại cơ sở'}
            currentPage={viewMode === 'MAP' ? 1 : safePage}
            totalPages={viewMode === 'MAP' ? 1 : totalPages}
            pageSize={viewMode === 'MAP' ? data.units.length : PAGE_SIZE}
            itemLabel="ô kho"
            rightSlot={editingMap ? (
              <span className="duo-badge bg-[#DDF4FF] text-[#1899D6] border-2 border-[#84D8FF]">Đang chỉnh sửa mặt bằng</span>
            ) : (
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5]">
                {[
                  { id: 'MAP', label: 'Sơ đồ', icon: 'grid_view' },
                  { id: 'LIST', label: 'Danh sách', icon: 'view_list' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => changeViewMode(mode.id)}
                    aria-pressed={viewMode === mode.id}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-colors cursor-pointer ${
                      viewMode === mode.id
                        ? 'bg-white text-[#1CB0F6] border-2 border-[#84D8FF]'
                        : 'text-[#AFAFAF] border-2 border-transparent hover:text-[#777777]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{mode.icon}</span>
                    {mode.label}
                  </button>
                ))}
              </div>
            )}
          />
          {/* Sơ đồ dùng toàn bộ ô của cơ sở, chỉ danh sách mới phụ thuộc trạng thái tải / bộ lọc */}
          {viewMode === 'LIST' && loading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3">
              <span className="material-symbols-outlined text-[36px] text-[#58CC02] animate-spin">
                progress_activity
              </span>
              <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải dữ liệu ô kho...</span>
            </div>
          ) : viewMode === 'LIST' && errorMsg ? (
            <div className="flex flex-col items-center justify-center p-16 text-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#FF4B4B]">error</span>
              <p className="text-sm font-black text-[#FF4B4B]">{errorMsg}</p>
              <button
                type="button"
                onClick={fetchStorageUnits}
                className="duo-btn-gray px-4 py-2 text-xs"
              >
                Thử lại
              </button>
            </div>
          ) : viewMode === 'LIST' && data.units.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#AFAFAF]">inbox</span>
              <p className="text-sm font-black text-[#777777]">Không tìm thấy ô kho nào phù hợp</p>
              <p className="text-xs font-bold text-[#AFAFAF]">Hãy thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm</p>
            </div>
          ) : viewMode === 'MAP' ? (
            <div className="flex flex-col xl:flex-row">
              <div className="flex-1 min-w-0">
                {layout ? (
                  <FloorPlanBoard
                    facilityId={facilityId}
                    layout={layout}
                    units={allUnits}
                    matchedIds={matchedIds}
                    selectedUnitId={selectedUnitId}
                    onSelectUnit={setSelectedUnitId}
                    editing={editingMap}
                    onEditingChange={setEditingMap}
                    onChanged={reloadAll}
                    onNotify={setToast}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-16 gap-3">
                    <span className="material-symbols-outlined text-[36px] text-[#58CC02] animate-spin">progress_activity</span>
                    <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải mặt bằng...</span>
                  </div>
                )}
              </div>

              {/* Panel chi tiết ô: cột phải trên desktop, bottom sheet trên điện thoại (ẩn khi đang sửa mặt bằng) */}
              {editingMap ? null : selectedUnit ? (
                <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto bg-white border-t-4 border-[#E5E5E5] rounded-t-3xl shadow-2xl p-5 flex flex-col gap-4 xl:static xl:z-auto xl:max-h-none xl:w-[320px] xl:shrink-0 xl:border-t-0 xl:border-l-2 xl:rounded-none xl:shadow-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-black font-mono text-[#1CB0F6] text-sm">{selectedUnit.id}</span>
                      <div>{renderStatusBadge(selectedUnit)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUnitId(null)}
                      className="p-1 rounded-xl text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-[#F7F7F7] transition-colors"
                      title="Đóng"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <dt className="font-black uppercase text-[10px] text-[#AFAFAF]">Loại kho</dt>
                    <dd className="font-bold text-[#4B4B4B]">{selectedUnit.unitTypeName}</dd>
                    <dt className="font-black uppercase text-[10px] text-[#AFAFAF]">Vị trí</dt>
                    <dd className="font-bold text-[#4B4B4B]">{selectedUnit.floor} • Khu {selectedUnit.zone}</dd>
                    <dt className="font-black uppercase text-[10px] text-[#AFAFAF]">Diện tích</dt>
                    <dd className="font-bold text-[#4B4B4B]">{selectedUnit.areaSqm} m²</dd>
                    <dt className="font-black uppercase text-[10px] text-[#AFAFAF]">Đơn giá tháng</dt>
                    <dd className="font-black text-[#58CC02]">{selectedUnit.basePriceMonthly?.toLocaleString('vi-VN')}₫</dd>
                  </dl>

                  {selectedUnit.currentContract ? (
                    <div className="rounded-2xl border-2 border-[#E5E5E5] p-3 flex flex-col gap-1 text-xs">
                      <span className="text-[10px] font-black uppercase text-[#AFAFAF]">
                        Hợp đồng #{selectedUnit.currentContract.contractCode}
                      </span>
                      <span className="font-black text-[#4B4B4B]">{selectedUnit.currentContract.customerName}</span>
                      <span className="text-[11px] font-mono text-[#AFAFAF]">{selectedUnit.currentContract.customerPhone}</span>
                      <span className={`font-bold ${selectedUnit.overdue ? 'text-[#FF4B4B]' : 'text-[#777777]'}`}>
                        {selectedUnit.currentContract.startDate || '---'} → {selectedUnit.currentContract.endDate || '---'}
                      </span>
                    </div>
                  ) : selectedUnit.status === 'AVAILABLE' ? (
                    <p className="text-xs font-black text-[#58CC02]">Sẵn sàng giao cho khách mới</p>
                  ) : null}

                  {renderMaintenanceTaskLink(selectedUnit)}

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t-2 border-[#E5E5E5]">
                    {renderUnitActions(selectedUnit)}
                  </div>
                </aside>
              ) : (
                <aside className="hidden xl:flex xl:w-[320px] xl:shrink-0 border-l-2 border-[#E5E5E5] p-5 flex-col items-center justify-center text-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-[#E5E5E5]">touch_app</span>
                  <p className="text-xs font-bold text-[#AFAFAF]">Bấm vào một ô trên sơ đồ để xem chi tiết và thao tác</p>
                </aside>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Mã ô kho</th>
                    <th className="px-5 py-3.5">Phân loại kho</th>
                    <th className="px-5 py-3.5">Vị trí</th>
                    <th className="px-5 py-3.5 text-right">Diện tích</th>
                    <th className="px-5 py-3.5 text-right">Đơn giá tháng</th>
                    <th className="px-5 py-3.5 text-center">Trạng thái</th>
                    <th className="px-5 py-3.5">Khách thuê</th>
                    <th className="px-5 py-3.5">Hạn hợp đồng</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-[#4B4B4B] divide-y-2 divide-[#E5E5E5]">
                  {paginatedUnits.map((unit) => {
                    const isAvailable = unit.status === 'AVAILABLE';
                    const isOverdue = unit.overdue;

                    return (
                      <tr key={unit.id} className="hover:bg-[#FDFDFD] transition-colors">
                        {/* Mã ô */}
                        <td className="px-5 py-3.5 font-black font-mono text-[#1CB0F6]">
                          {unit.id}
                        </td>

                        {/* Phân loại kho */}
                        <td className="px-5 py-3.5">
                          {unit.unitTypeName}
                        </td>

                        {/* Vị trí */}
                        <td className="px-5 py-3.5 text-[#777777]">
                          {unit.floor} • Khu {unit.zone}
                        </td>

                        {/* Diện tích */}
                        <td className="px-5 py-3.5 text-right font-black">
                          {unit.areaSqm} m²
                        </td>

                        {/* Đơn giá tháng */}
                        <td className="px-5 py-3.5 text-right font-black text-[#58CC02]">
                          {unit.basePriceMonthly?.toLocaleString('vi-VN')}₫
                        </td>

                        {/* Trạng thái (duo-badge) */}
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {renderStatusBadge(unit)}
                            {renderMaintenanceTaskLink(unit)}
                          </div>
                        </td>

                        {/* Khách thuê */}
                        <td className="px-5 py-3.5">
                          {unit.currentContract ? (
                            <div>
                              <div className="font-black text-[#4B4B4B]">
                                {unit.currentContract.customerName}
                              </div>
                              <div className="text-[10px] text-[#AFAFAF] font-mono">
                                {unit.currentContract.customerPhone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#AFAFAF]">---</span>
                          )}
                        </td>

                        {/* Hạn hợp đồng */}
                        <td className="px-5 py-3.5">
                          {unit.currentContract ? (
                            <div>
                              <span className={isOverdue ? 'text-[#FF4B4B] font-black' : 'text-[#4B4B4B]'}>
                                Đến {unit.currentContract.endDate || '---'}
                              </span>
                              <div className="text-[10px] text-[#AFAFAF]">
                                HĐ #{unit.currentContract.contractCode}
                              </div>
                            </div>
                          ) : isAvailable ? (
                            <span className="text-[#58CC02] font-black">Sẵn sàng giao</span>
                          ) : (
                            <span className="text-[#AFAFAF]">---</span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {renderUnitActions(unit)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Metadata Strip + Pagination */}
          {viewMode === 'LIST' && !loading && !errorMsg && data.units.length > 0 && (
            <PaginationBar
              currentPage={safePage}
              totalItems={data.units.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="ô kho"
            />
          )}
        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL 1: TẠO Ô KHO MỚI (DUOLINGO 3D STYLE) */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`duo-card w-full ${addFloorPlan ? 'max-w-5xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-5 border-4 border-[#E5E5E5] shadow-2xl animate-in fade-in zoom-in-95 duration-200`}>
            <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] pb-3">
              <div>
                <h2 className="text-xl font-black text-[#4B4B4B] uppercase tracking-wide">
                  Tạo Ô Kho Mới
                </h2>
                <p className="text-xs font-bold text-[#AFAFAF]">Đăng ký mã và cấu hình vật lý kho</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#AFAFAF] hover:text-[#4B4B4B] p-1"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="flex flex-col gap-4">
             <div className={addFloorPlan ? 'grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5' : ''}>
              <div className="flex flex-col gap-4">
              {/* Dự kiến mã ô kho tự sinh PR-M9 */}
              <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#1CB0F6]">
                    Mã ô tự sinh (PR-M9)
                  </span>
                  <span className="text-lg font-black font-mono text-[#1899D6]">
                    {calculatedCodePreview}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#1CB0F6] text-[28px]">qr_code_2</span>
              </div>

              {/* Loại kho */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase text-[#4B4B4B]">
                  Loại kho <span className="text-[#FF4B4B]">*</span>
                </label>
                <select
                  value={addForm.unitTypeId}
                  onChange={e => setAddForm({ ...addForm, unitTypeId: e.target.value })}
                  required
                  className="duo-input w-full text-xs py-2.5 cursor-pointer"
                >
                  {unitTypes.map(ut => (
                    <option key={ut.id} value={ut.id}>
                      {ut.name} — {ut.areaSqm}m² ({ut.basePriceMonthly?.toLocaleString('vi-VN')}₫/tháng)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tầng */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase text-[#4B4B4B]">
                  Vị trí Tầng <span className="text-[#FF4B4B]">*</span>
                </label>
                {/* UC-06: chọn tầng có mặt bằng để tránh gõ sai tên tầng; vẫn gõ được tầng mới */}
                <input
                  type="text"
                  required
                  list="facility-floor-options"
                  value={addForm.floor}
                  onChange={e => setAddForm({ ...addForm, floor: e.target.value, mapPosition: null })}
                  placeholder="VD: Tầng trệt, Tầng 1, Tầng 2"
                  className="duo-input w-full text-xs py-2.5"
                />
                <datalist id="facility-floor-options">
                  {(layout?.floors || []).map(f => <option key={f.id} value={f.name} />)}
                </datalist>
                {!addFloorPlan && addForm.floor.trim() && (
                  <span className="text-[10px] font-bold text-[#AFAFAF]">
                    Tầng này chưa có mặt bằng — ô sẽ nằm ở danh sách "chưa đặt vị trí".
                  </span>
                )}
              </div>

              {/* Khu & Số phòng */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-[#4B4B4B]">
                    Dãy / Khu vực <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={addForm.zone}
                    onChange={e => setAddForm({ ...addForm, zone: e.target.value.toUpperCase() })}
                    placeholder="VD: A, B, C"
                    className="duo-input w-full text-xs py-2.5 uppercase"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-[#4B4B4B]">
                    Số phòng <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={addForm.roomNumber}
                    onChange={e => setAddForm({ ...addForm, roomNumber: e.target.value })}
                    placeholder="VD: 101, 205"
                    className="duo-input w-full text-xs py-2.5"
                  />
                </div>
              </div>
              </div>

              {/* UC-06: chọn chỗ đặt ô trên mặt bằng tầng */}
              {addFloorPlan && (
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="text-xs font-black uppercase text-[#4B4B4B]">
                    Vị trí trên mặt bằng {addFloorPlan.name}
                  </label>
                  <UnitPositionPicker
                    floor={addFloorPlan}
                    units={allUnits}
                    size={addSize}
                    value={addForm.mapPosition}
                    onChange={mapPosition => setAddForm(prev => ({ ...prev, mapPosition }))}
                    onRotate={() => setAddForm(prev => ({ ...prev, rotated: !prev.rotated }))}
                  />
                </div>
              )}
             </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5] mt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmittingAdd}
                  className="duo-btn-gray px-4 py-2.5 text-xs"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="duo-btn-green px-6 py-2.5 text-xs flex items-center gap-1.5"
                >
                  {isSubmittingAdd ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>ĐANG TẠO...</span>
                    </>
                  ) : (
                    <span>LƯU KHO</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: XÁC NHẬN ĐỔI TRẠNG THÁI (BẢO TRÌ ⇄ KHẢ DỤNG) */}
      {/* ======================================================== */}
      {statusModal.show && statusModal.unit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="duo-card w-full max-w-md p-6 flex flex-col gap-4 border-4 border-[#E5E5E5] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center shrink-0 ${
                  statusModal.targetStatus === 'MAINTENANCE'
                    ? 'bg-[#FFE8CC] border-[#FF9600] text-[#E58800]'
                    : 'bg-[#D7FFB8] border-[#58CC02] text-[#58A700]'
                }`}
              >
                <span className="material-symbols-outlined text-[28px]">
                  {statusModal.targetStatus === 'MAINTENANCE' ? 'build' : 'check_circle'}
                </span>
              </div>
              <div>
                <h3 className="text-base font-black text-[#4B4B4B] uppercase">
                  {statusModal.targetStatus === 'MAINTENANCE'
                    ? `Khóa bảo trì ô kho ${statusModal.unit.id}`
                    : `Mở lại ô kho ${statusModal.unit.id}`}
                </h3>
                <p className="text-xs font-bold text-[#AFAFAF]">
                  {statusModal.targetStatus === 'MAINTENANCE'
                    ? 'Ô kho sẽ tạm dừng nhận đơn đặt và gán chỗ mới'
                    : 'Ô kho sẽ sẵn sàng phục vụ khách thuê'}
                </p>
              </div>
            </div>

            {statusModal.targetStatus === 'MAINTENANCE' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black uppercase text-[#4B4B4B]">
                  Lý do bảo trì / Ghi chú sự cố:
                </label>
                <textarea
                  rows={3}
                  value={statusModal.note}
                  onChange={e => setStatusModal({ ...statusModal, note: e.target.value })}
                  placeholder="VD: Kiểm tra cảm biến SmartLock, sơn lại vách ngăn..."
                  className="duo-input w-full text-xs py-2.5"
                />
                <p className="text-[11px] font-bold text-[#AFAFAF] italic">
                  * Hệ thống sẽ tự động kiểm tra số suất khả dụng (PR-M10). Nếu hết suất trống đã cọc, thao tác sẽ bị chặn.
                </p>
              </div>
            )}

            {/* PR-O10: mở lại ô đang có task bảo trì → task được đóng luôn */}
            {statusModal.targetStatus === 'AVAILABLE' && statusModal.unit.maintenanceTaskId && (
              <div className="rounded-xl bg-[#FFF8E1] border-2 border-[#FFC800] px-4 py-3 text-xs font-bold text-[#4B4B4B] flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#B78900]">info</span>
                <span>
                  Ô đang có task bảo trì <b>#{statusModal.unit.maintenanceTaskId}</b>{' '}
                  ({statusModal.unit.maintenanceReason === 'LIQUIDATION' ? 'dọn kho sau thanh lý' : 'sửa sự cố sau trả kho'}).
                  Mở lại kho sẽ <b>đóng luôn task này</b>. Nên để nhân viên bấm "Sửa xong" trên phiếu bảo trì để lưu ghi chú công việc.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setStatusModal({ show: false, unit: null, targetStatus: 'MAINTENANCE', note: '', isSubmitting: false })}
                disabled={statusModal.isSubmitting}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                ĐÓNG
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={statusModal.isSubmitting}
                className={`px-6 py-2.5 text-xs ${
                  statusModal.targetStatus === 'MAINTENANCE'
                    ? 'duo-btn-orange'
                    : 'duo-btn-green'
                }`}
              >
                {statusModal.isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>ĐANG XỬ LÝ...</span>
                  </>
                ) : (
                  <span>
                    {statusModal.targetStatus === 'MAINTENANCE' ? 'XÁC NHẬN KHÓA' : 'XÁC NHẬN MỞ LẠI'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: XÁC NHẬN XÓA Ô KHO (PR-21) */}
      {/* ======================================================== */}
      {deleteModal.show && deleteModal.unit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="duo-card w-full max-w-sm p-6 flex flex-col gap-4 border-4 border-[#E5E5E5] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFDFDF] border-2 border-[#FF4B4B] text-[#FF4B4B] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">delete</span>
              </div>
              <div>
                <h3 className="text-base font-black text-[#4B4B4B] uppercase">Xác nhận xóa ô kho</h3>
                <p className="text-xs font-black font-mono text-[#FF4B4B]">{deleteModal.unit.id}</p>
              </div>
            </div>

            <p className="text-xs font-bold text-[#777777] leading-relaxed">
              Bạn có chắc chắn muốn xóa ô kho này không? Hành động này sẽ loại bỏ hoàn toàn ô kho khỏi cơ sở dữ liệu.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setDeleteModal({ show: false, unit: null, isSubmitting: false })}
                disabled={deleteModal.isSubmitting}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                HỦY
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteModal.isSubmitting}
                className="duo-btn-red px-5 py-2.5 text-xs flex items-center gap-1.5"
              >
                {deleteModal.isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>ĐANG XÓA...</span>
                  </>
                ) : (
                  <span>XÓA VĨNH VIỄN</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
