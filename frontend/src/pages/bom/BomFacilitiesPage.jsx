import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getBomFacilities,
  createFacility,
  updateFacility,
  updateFacilityStatus,
  getCities,
} from '../../services/facilityService';

export default function BomFacilitiesPage() {
  const [allFacilities, setAllFacilities] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Chế độ xem danh sách: 'card' (lưới thẻ thoáng mắt) hoặc 'table' (bảng danh sách)
  const [viewMode, setViewMode] = useState('card');

  // Filters
  const [keyword, setKeyword] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeFacility, setActiveFacility] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    city: 'TP.HCM',
    district: '',
    address: '',
    hotline: '',
  });
  const [createErrors, setCreateErrors] = useState({});

  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    district: '',
    address: '',
    hotline: '',
  });
  const [editErrors, setEditErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);

  // Load cities once
  useEffect(() => {
    getCities()
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setCities(res);
        } else {
          setCities(['TP.HCM', 'Hà Nội', 'Đà Nẵng']);
        }
      })
      .catch(() => setCities(['TP.HCM', 'Hà Nội', 'Đà Nẵng']));
  }, []);

  // Fetch all facilities for entire chain overview & list
  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getBomFacilities();
      setAllFacilities(data);

      // Cập nhật lại dữ liệu chi tiết nếu modal đang mở
      setActiveFacility((prev) => {
        if (!prev) return null;
        return data.find((item) => item.id === prev.id) || prev;
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh sách cơ sở kho bãi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  // Flash message helper
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  // Helper tính số ô thực tế còn trống (Tổng ô - Đang thuê - Đang bảo trì - Chờ nhận)
  const getFacilityAvailable = (f) =>
    Math.max(
      0,
      (f.totalUnits || 0) -
        (f.occupiedUnits || 0) -
        (f.maintenanceUnits || 0) -
        (f.pendingReservationsCount || 0)
    );

  // Danh sách cơ sở sau khi lọc (Client-side filtering tức thời, không ảnh hưởng Tổng quan chuỗi)
  const filteredFacilities = useMemo(() => {
    return allFacilities.filter((f) => {
      // 1. Lọc theo thành phố
      if (selectedCity !== 'ALL' && f.city !== selectedCity) return false;

      // 2. Lọc theo trạng thái
      if (selectedStatus !== 'ALL' && f.status !== selectedStatus) return false;

      // 3. Lọc theo từ khóa (Mã, Tên, Quận, Địa chỉ)
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const matchCode = f.code?.toLowerCase().includes(kw);
        const matchName = f.name?.toLowerCase().includes(kw);
        const matchDistrict = f.district?.toLowerCase().includes(kw);
        const matchAddress = f.address?.toLowerCase().includes(kw);
        if (!matchCode && !matchName && !matchDistrict && !matchAddress) return false;
      }

      return true;
    });
  }, [allFacilities, keyword, selectedCity, selectedStatus]);

  // Alias để template sử dụng thuận tiện
  const facilities = filteredFacilities;

  // Stats calculation: TỔNG QUAN TOÀN CHUỖI (Luôn tính trên tất cả cơ sở toàn chuỗi)
  const stats = useMemo(() => {
    const total = allFacilities.length;
    const active = allFacilities.filter((f) => f.status === 'ACTIVE').length;
    const inactive = allFacilities.filter((f) => f.status === 'INACTIVE').length;
    const totalUnits = allFacilities.reduce((sum, f) => sum + (f.totalUnits || 0), 0);
    const occupiedUnits = allFacilities.reduce((sum, f) => sum + (f.occupiedUnits || 0), 0);
    const maintenanceUnits = allFacilities.reduce((sum, f) => sum + (f.maintenanceUnits || 0), 0);
    const activeContracts = allFacilities.reduce((sum, f) => sum + (f.activeContractsCount || 0), 0);
    const pendingReservations = allFacilities.reduce((sum, f) => sum + (f.pendingReservationsCount || 0), 0);
    const availableUnits = allFacilities.reduce((sum, f) => sum + getFacilityAvailable(f), 0);

    const overallCapacity =
      totalUnits > 0
        ? Math.round((occupiedUnits / totalUnits) * 100)
        : 0;

    const occupiedPct = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
    const pendingPct =
      totalUnits > 0
        ? (Math.min(pendingReservations, Math.max(0, totalUnits - occupiedUnits)) / totalUnits) * 100
        : 0;
    const availablePct =
      totalUnits > 0
        ? Math.max(0, 100 - occupiedPct - pendingPct)
        : 0;

    return {
      total,
      active,
      inactive,
      totalUnits,
      availableUnits,
      occupiedUnits,
      maintenanceUnits,
      activeContracts,
      pendingReservations,
      overallCapacity,
      occupiedPct,
      pendingPct,
      availablePct,
    };
  }, [allFacilities]);

  // Mở modal xem chi tiết
  const handleOpenDetail = (f) => {
    setActiveFacility(f);
    setDetailModalOpen(true);
  };

  // Handle open create modal
  const handleOpenCreate = () => {
    setCreateForm({
      code: '',
      name: '',
      city: cities[0] || 'TP.HCM',
      district: '',
      address: '',
      hotline: '',
    });
    setCreateErrors({});
    setCreateModalOpen(true);
  };

  // Validate create form
  const validateCreate = () => {
    const errs = {};
    const codeClean = (createForm.code || '').trim().toUpperCase();
    if (!codeClean) {
      errs.code = 'Mã cơ sở không được để trống';
    } else if (!/^[A-Z0-9]{2,4}$/.test(codeClean)) {
      errs.code = 'Mã cơ sở phải gồm 2–4 ký tự in hoa hoặc số (vd: TB, BT, Q7)';
    }

    if (!createForm.name?.trim()) errs.name = 'Tên cơ sở không được để trống';
    if (!createForm.city?.trim()) errs.city = 'Tỉnh/Thành phố không được để trống';
    if (!createForm.district?.trim()) errs.district = 'Quận/Huyện không được để trống';
    if (!createForm.address?.trim()) errs.address = 'Địa chỉ không được để trống';

    if (
      createForm.hotline?.trim() &&
      !/^(0[0-9]{9,10}|[0-9]{3,4}-[0-9]{3,4}-[0-9]{3,4})$/.test(createForm.hotline.trim())
    ) {
      errs.hotline = 'Số hotline không đúng định dạng số điện thoại';
    }

    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateCreate()) return;

    setSubmitting(true);
    try {
      await createFacility({
        code: createForm.code.trim().toUpperCase(),
        name: createForm.name.trim(),
        city: createForm.city.trim(),
        district: createForm.district.trim(),
        address: createForm.address.trim(),
        hotline: createForm.hotline.trim() || null,
      });

      setCreateModalOpen(false);
      showSuccess(`Đã tạo thành công cơ sở "${createForm.name}"!`);
      fetchFacilities();
    } catch (err) {
      const apiErr = err.response?.data;
      if (apiErr?.error === 'FACILITY_CODE_EXISTS') {
        setCreateErrors({ code: apiErr.message || 'Mã cơ sở đã tồn tại trong hệ thống' });
      } else if (apiErr?.details) {
        setCreateErrors(apiErr.details);
      } else {
        alert(apiErr?.message || 'Có lỗi xảy ra khi tạo cơ sở mới');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle open edit modal
  const handleOpenEdit = (f) => {
    setActiveFacility(f);
    setEditForm({
      name: f.name || '',
      city: f.city || '',
      district: f.district || '',
      address: f.address || '',
      hotline: f.hotline || '',
    });
    setEditErrors({});
    setEditModalOpen(true);
  };

  const validateEdit = () => {
    const errs = {};
    if (!editForm.name?.trim()) errs.name = 'Tên cơ sở không được để trống';
    if (!editForm.city?.trim()) errs.city = 'Tỉnh/Thành phố không được để trống';
    if (!editForm.district?.trim()) errs.district = 'Quận/Huyện không được để trống';
    if (!editForm.address?.trim()) errs.address = 'Địa chỉ không được để trống';

    if (
      editForm.hotline?.trim() &&
      !/^(0[0-9]{9,10}|[0-9]{3,4}-[0-9]{3,4}-[0-9]{3,4})$/.test(editForm.hotline.trim())
    ) {
      errs.hotline = 'Số hotline không đúng định dạng số điện thoại';
    }

    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateEdit()) return;

    setSubmitting(true);
    try {
      await updateFacility(activeFacility.id, {
        name: editForm.name.trim(),
        city: editForm.city.trim(),
        district: editForm.district.trim(),
        address: editForm.address.trim(),
        hotline: editForm.hotline.trim() || null,
      });

      setEditModalOpen(false);
      showSuccess(`Đã cập nhật thông tin cơ sở "${editForm.name}" thành công!`);
      fetchFacilities();
    } catch (err) {
      const apiErr = err.response?.data;
      if (apiErr?.details) {
        setEditErrors(apiErr.details);
      } else {
        alert(apiErr?.message || 'Có lỗi xảy ra khi cập nhật cơ sở');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle open status toggle modal
  const handleOpenStatusModal = (f) => {
    setActiveFacility(f);
    setStatusModalOpen(true);
  };

  const handleConfirmStatusToggle = async () => {
    if (!activeFacility) return;
    const nextStatus = activeFacility.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    setSubmitting(true);
    try {
      await updateFacilityStatus(activeFacility.id, nextStatus);
      setStatusModalOpen(false);
      showSuccess(
        nextStatus === 'ACTIVE'
          ? `Đã kích hoạt lại cơ sở "${activeFacility.name}".`
          : `Đã tạm ngừng hoạt động cơ sở "${activeFacility.name}".`
      );
      fetchFacilities();
    } catch (err) {
      const apiErr = err.response?.data;
      const errorText =
        apiErr?.message ||
        (err.message === 'Network Error'
          ? 'Lỗi kết nối máy chủ hoặc CORS'
          : 'Không thể thay đổi trạng thái cơ sở');
      showError(errorText);
      setStatusModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* Alert Notifications */}
      {successMsg && (
        <div className="duo-card p-4 bg-[#EAF7DD] border-[#58CC02] text-[#2E7D32] flex items-center justify-between shadow-xs animate-scale-up">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#58CC02] text-[22px]">check_circle</span>
            <span className="text-xs font-black">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#58CC02] hover:text-[#2E7D32] font-black text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="duo-card p-4 bg-[#FFECEC] border-[#FF4B4B] text-[#D32F2F] flex items-center justify-between shadow-xs animate-scale-up">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[22px]">error</span>
            <span className="text-xs font-black">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-[#FF4B4B] hover:text-[#D32F2F] font-black text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#4B4B4B] tracking-tight">
            Quản Lý Cơ Sở Kho Bãi
          </h1>
          <p className="text-xs font-bold text-[#777777] mt-1">
            Tổng quan hiệu suất toàn chuỗi và quản lý danh mục cơ sở QueenKho
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle: Cards / Table */}
          <div className="flex items-center bg-white p-1 rounded-2xl border-2 border-[#E5E5E5]">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF] shadow-xs'
                  : 'text-[#777777] hover:text-[#4B4B4B] border-2 border-transparent'
              }`}
              title="Xem dạng thẻ gọn gàng"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>Lưới thẻ</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF] shadow-xs'
                  : 'text-[#777777] hover:text-[#4B4B4B] border-2 border-transparent'
              }`}
              title="Xem dạng bảng chi tiết"
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
              <span>Bảng</span>
            </button>
          </div>

          {/* Add Facility Button */}
          <button
            onClick={handleOpenCreate}
            className="duo-btn-green px-4 py-2.5 text-xs flex items-center gap-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Thêm cơ sở mới</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          KHỐI 1: TỔNG QUAN TOÀN CHUỖI
          ======================================================== */}
      <div className="duo-card p-5 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#F0F0F0] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#DDF4FF] border-2 border-[#84D8FF] text-[#1CB0F6] flex items-center justify-center font-black">
              <span className="material-symbols-outlined text-[22px]">hub</span>
            </span>
            <div>
              <h2 className="text-sm font-black text-[#4B4B4B] uppercase tracking-wider">
                Tổng Quan Toàn Chuỗi
              </h2>
              <span className="text-[11px] font-bold text-[#AFAFAF]">
                Số liệu tổng hợp vận hành thời gian thực từ tất cả các chi nhánh
              </span>
            </div>
          </div>

          {/* Badge tổng cơ sở góc phải header */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] text-xs font-black text-[#4B4B4B] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#58CC02]"></span>
              <span>
                {stats.total} chi nhánh ({stats.active} hoạt động
                {stats.inactive > 0 ? (
                  <>, <span className="text-[#FF4B4B] font-black">{stats.inactive} tạm ngừng</span></>
                ) : ''}
                )
              </span>
            </span>
          </div>
        </div>

        {/* 4 Thẻ ô vuông (Square cards) rõ ràng, số to đẹp, có chữ "ô" màu đen tách rời số */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Cơ sở vận hành */}
          <div className="p-4 rounded-2xl bg-[#FAFAFA] border-2 border-[#E5E5E5] flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] text-[#1CB0F6] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">apartment</span>
            </div>
            <div>
              <span className="text-[11px] font-black text-[#AFAFAF] uppercase tracking-wider block">
                CƠ SỞ VẬN HÀNH
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-[#4B4B4B]">{stats.total}</span>
                <span className="text-xs font-bold text-[#4B4B4B]">cơ sở</span>
                <span className="text-xs font-bold text-[#58CC02] ml-1">({stats.active} hoạt động)</span>
                {stats.inactive > 0 && (
                  <span className="text-xs font-bold text-[#FF4B4B] ml-1">({stats.inactive} tạm ngừng)</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Đang thuê */}
          <div className="p-4 rounded-2xl bg-[#FAFAFA] border-2 border-[#E5E5E5] flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#EBF7FF] border-2 border-[#84D8FF] text-[#1CB0F6] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">inventory_2</span>
            </div>
            <div>
              <span className="text-[11px] font-black text-[#1CB0F6] uppercase tracking-wider block">
                ĐANG THUÊ
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-[#1CB0F6]">{stats.occupiedUnits}</span>
                <span className="text-xs font-bold text-[#777777] ml-1">({stats.activeContracts} hợp đồng)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Chờ nhận */}
          <div className="p-4 rounded-2xl bg-[#FAFAFA] border-2 border-[#E5E5E5] flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF4E5] border-2 border-[#FFD299] text-[#FF9600] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">hourglass_top</span>
            </div>
            <div>
              <span className="text-[11px] font-black text-[#FF9600] uppercase tracking-wider block">
                CHỜ NHẬN
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-[#FF9600]">{stats.pendingReservations}</span>
                <span className="text-xs font-bold text-[#777777] ml-1">ô chờ nhận</span>
              </div>
            </div>
          </div>

          {/* Card 4: Còn trống */}
          <div className="p-4 rounded-2xl bg-[#FAFAFA] border-2 border-[#E5E5E5] flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#EAF7DD] border-2 border-[#B4E885] text-[#58CC02] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">meeting_room</span>
            </div>
            <div>
              <span className="text-[11px] font-black text-[#58CC02] uppercase tracking-wider block">
                CÒN TRỐNG
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-[#58CC02]">{stats.availableUnits}</span>
                <span className="text-xs font-bold text-[#777777] ml-1">ô sẵn sàng</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh tiến độ trực quan phân bổ ô kho toàn chuỗi */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-black text-[#4B4B4B]">
            <span>Phân bổ sử dụng ô kho toàn chuỗi</span>
            <span className="text-xs font-bold text-[#777777]">
              Tổng: <strong className="text-[#4B4B4B]">{stats.totalUnits}</strong> <span className="text-[#4B4B4B]">ô</span> trên toàn quốc
            </span>
          </div>

          <div className="w-full h-3 bg-[#E5E5E5] rounded-full overflow-hidden flex shadow-inner">
            {stats.occupiedPct > 0 && (
              <div
                className="h-full bg-[#1CB0F6] transition-all duration-500"
                style={{ width: `${stats.occupiedPct}%` }}
                title={`Đang thuê: ${stats.occupiedUnits} ô`}
              ></div>
            )}
            {stats.pendingPct > 0 && (
              <div
                className="h-full bg-[#FF9600] transition-all duration-500"
                style={{ width: `${stats.pendingPct}%` }}
                title={`Chờ nhận: ${stats.pendingReservations} ô`}
              ></div>
            )}
            {stats.availablePct > 0 && (
              <div
                className="h-full bg-[#58CC02] transition-all duration-500"
                style={{ width: `${stats.availablePct}%` }}
                title={`Còn trống: ${stats.availableUnits} ô`}
              ></div>
            )}
          </div>

          {/* Chú thích biểu đồ chuyển xuống dưới thanh ở trang ngoài */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#4B4B4B] pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1CB0F6] shrink-0"></span>
              <span>
                Đang thuê: <strong className="text-[#1CB0F6] font-black">{stats.occupiedUnits}</strong>{' '}
                <span className="text-[#777777] font-medium">({stats.activeContracts} hợp đồng)</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF9600] shrink-0"></span>
              <span>
                Chờ nhận: <strong className="text-[#FF9600] font-black">{stats.pendingReservations}</strong>{' '}
                <span className="text-[#777777] font-medium">(ô chờ nhận)</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#58CC02] shrink-0"></span>
              <span>
                Còn trống: <strong className="text-[#58CC02] font-black">{stats.availableUnits}</strong>{' '}
                <span className="text-[#777777] font-medium">(ô sẵn sàng)</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          BỘ LỌC & TÌM KIẾM
          ======================================================== */}
      <div className="duo-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo mã cơ sở (TB, BT..), tên, quận hoặc địa chỉ..."
            className="duo-input w-full pl-10 pr-4 text-xs font-bold"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* City filter */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="duo-input py-2 px-3 text-xs font-black text-[#4B4B4B] cursor-pointer"
          >
            <option value="ALL">Tất cả chi nhánh</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="duo-input py-2 px-3 text-xs font-black text-[#4B4B4B] cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Tạm ngừng</option>
          </select>

          {(keyword || selectedCity !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setKeyword('');
                setSelectedCity('ALL');
                setSelectedStatus('ALL');
              }}
              className="duo-btn-gray py-2 px-3 text-xs flex items-center gap-1 cursor-pointer"
              title="Đặt lại bộ lọc"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          KHỐI 2: DANH SÁCH CÁC CƠ SỞ (Gọn gàng, thoáng mắt)
          ======================================================== */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <h2 className="text-base font-black text-[#4B4B4B] flex items-center gap-2">
            <span>Danh Sách Cơ Sở Trong Chuỗi</span>
            <span className="px-2 py-0.5 rounded-lg bg-[#F0F0F0] text-[#777777] text-xs font-bold">
              {facilities.length} cơ sở
            </span>
          </h2>
          <span className="text-xs font-bold text-[#AFAFAF] hidden sm:inline">
            Bấm vào cơ sở để xem báo cáo chi tiết và thao tác quản lý
          </span>
        </div>

        {loading ? (
          <div className="duo-card py-20 flex flex-col items-center justify-center gap-3 text-[#AFAFAF] bg-white">
            <span className="material-symbols-outlined text-[42px] animate-spin text-[#1CB0F6]">
              progress_activity
            </span>
            <span className="text-xs font-black">Đang cập nhật danh sách cơ sở...</span>
          </div>
        ) : facilities.length === 0 ? (
          <div className="duo-card py-16 text-center text-[#AFAFAF] flex flex-col items-center gap-2 bg-white">
            <span className="material-symbols-outlined text-[48px] text-[#E5E5E5]">warehouse</span>
            <p className="text-sm font-black text-[#777777]">Không tìm thấy cơ sở nào phù hợp</p>
            <p className="text-xs font-bold text-[#AFAFAF]">Hãy thử đổi từ khoá hoặc điều kiện lọc</p>
          </div>
        ) : viewMode === 'card' ? (
          /* ========================================================
             DẠNG LƯỚI THẺ (Clean Grid Cards - Đỡ rối mắt)
             ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {facilities.map((f) => {
              const avail = getFacilityAvailable(f);

              return (
                <div
                  key={f.id}
                  onClick={() => handleOpenDetail(f)}
                  className="duo-card p-5 bg-white flex flex-col justify-between hover:border-[#84D8FF] hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="space-y-3.5">
                    {/* Header Thẻ: Mã code + Trạng thái */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-xl bg-[#EBF7FF] border-2 border-[#84D8FF] text-[#1CB0F6] font-black text-xs tracking-wider">
                        {f.code}
                      </span>

                      {f.status === 'ACTIVE' ? (
                        <span className="duo-badge bg-[#EAF7DD] border-2 border-[#B4E885] text-[#58CC02]">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="duo-badge bg-[#FFF0F0] border-2 border-[#FFC1C1] text-[#FF4B4B] font-black">
                          Tạm ngừng
                        </span>
                      )}
                    </div>

                    {/* Tên cơ sở & Địa chỉ ngắn + Tổng số ô */}
                    <div>
                      <h3 className="text-base font-black text-[#4B4B4B] group-hover:text-[#1CB0F6] transition-colors leading-snug">
                        {f.name}
                      </h3>
                      <div className="flex items-center justify-between text-xs font-bold text-[#777777] mt-1.5">
                        <p className="flex items-center gap-1 line-clamp-1">
                          <span className="material-symbols-outlined text-[15px] text-[#AFAFAF] shrink-0">
                            location_on
                          </span>
                          <span>{f.district}, {f.city}</span>
                        </p>
                        <span className="shrink-0 px-2.5 py-0.5 rounded-lg bg-[#F0F0F0] text-[#4B4B4B] font-black text-[11px]">
                          {f.totalUnits} ô kho
                        </span>
                      </div>
                    </div>

                    {/* Khối 3 trạng thái ô kho cốt lõi: Đang thuê, Chờ nhận, Còn trống (gọn gàng, nhỏ nhắn hơn) */}
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-[#F7F7F7] border border-[#EBEBEB] text-center">
                      <div className="py-1.5 px-1 rounded-lg bg-white border border-[#E5E5E5] flex flex-col justify-center">
                        <span className="text-[10px] font-black text-[#1CB0F6] uppercase tracking-wider block leading-tight">
                          Đang thuê
                        </span>
                        <span className="text-lg font-black text-[#1CB0F6] leading-none my-0.5">
                          {f.occupiedUnits}
                        </span>
                        <span className="text-[9px] font-bold text-[#777777] block leading-tight">
                          {f.activeContractsCount} hợp đồng
                        </span>
                      </div>

                      <div className="py-1.5 px-1 rounded-lg bg-white border border-[#E5E5E5] flex flex-col justify-center">
                        <span className="text-[10px] font-black text-[#FF9600] uppercase tracking-wider block leading-tight">
                          Chờ nhận
                        </span>
                        <span className="text-lg font-black text-[#FF9600] leading-none my-0.5">
                          {f.pendingReservationsCount}
                        </span>
                        <span className="text-[9px] font-bold text-[#777777] block leading-tight">
                          ô chờ nhận
                        </span>
                      </div>

                      <div className="py-1.5 px-1 rounded-lg bg-white border border-[#E5E5E5] flex flex-col justify-center">
                        <span className="text-[10px] font-black text-[#58CC02] uppercase tracking-wider block leading-tight">
                          Còn trống
                        </span>
                        <span className="text-lg font-black text-[#58CC02] leading-none my-0.5">
                          {avail}
                        </span>
                        <span className="text-[9px] font-bold text-[#777777] block leading-tight">
                          ô sẵn sàng
                        </span>
                      </div>
                    </div>

                    {/* Mini visual indicator bar */}
                    <div className="w-full h-2 bg-[#E5E5E5] rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-[#1CB0F6] transition-all duration-300"
                        style={{
                          width: `${f.totalUnits > 0 ? (f.occupiedUnits / f.totalUnits) * 100 : 0}%`,
                        }}
                        title={`Đang thuê: ${f.occupiedUnits}`}
                      ></div>
                      <div
                        className="h-full bg-[#FF9600] transition-all duration-300"
                        style={{
                          width: `${
                            f.totalUnits > 0
                              ? (Math.min(f.pendingReservationsCount, Math.max(0, f.totalUnits - f.occupiedUnits)) /
                                  f.totalUnits) *
                                100
                              : 0
                          }%`,
                        }}
                        title={`Chờ nhận: ${f.pendingReservationsCount}`}
                      ></div>
                      <div
                        className="h-full bg-[#58CC02] transition-all duration-300"
                        style={{
                          width: `${f.totalUnits > 0 ? (avail / f.totalUnits) * 100 : 0}%`,
                        }}
                        title={`Còn trống: ${avail}`}
                      ></div>
                    </div>
                  </div>

                  {/* Nút Xem chi tiết */}
                  <div className="pt-3 mt-3 border-t-2 border-[#F0F0F0] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#777777] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-[#AFAFAF]">call</span>
                      <span>{f.hotline || 'Chưa có hotline'}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(f);
                      }}
                      className="duo-btn-blue py-1.5 px-3.5 text-xs flex items-center gap-1"
                    >
                      <span>Xem chi tiết</span>
                      <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================
             DẠNG BẢNG CHI TIẾT
             ======================================================== */
          <div className="duo-card overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-[#E5E5E5] bg-[#F7F7F7] text-[#777777] font-black uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-2 text-center w-12">Mã</th>
                    <th className="py-2.5 px-2.5">Tên cơ sở</th>
                    <th className="py-2.5 px-2">Khu vực</th>
                    <th className="py-2.5 px-2">Hotline</th>
                    <th className="py-2.5 px-1.5 text-center">Tổng ô</th>
                    <th className="py-2.5 px-1.5 text-center text-[#1CB0F6]">
                      <span className="inline-flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1CB0F6]"></span>
                        <span>Đang thuê</span>
                      </span>
                    </th>
                    <th className="py-2.5 px-1.5 text-center text-[#FF9600]">
                      <span className="inline-flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF9600]"></span>
                        <span>Chờ nhận</span>
                      </span>
                    </th>
                    <th className="py-2.5 px-1.5 text-center text-[#58CC02]">
                      <span className="inline-flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#58CC02]"></span>
                        <span>Còn trống</span>
                      </span>
                    </th>
                    <th className="py-2.5 px-2 text-center">Trạng thái</th>
                    <th className="py-2.5 px-2.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#F0F0F0] font-bold text-[#4B4B4B]">
                  {facilities.map((f) => {
                    const avail = getFacilityAvailable(f);

                    return (
                      <tr
                        key={f.id}
                        onClick={() => handleOpenDetail(f)}
                        className="hover:bg-[#F9FCFF] transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-lg bg-[#EBF7FF] border border-[#84D8FF] text-[#1CB0F6] font-black text-xs inline-block">
                            {f.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 font-black text-[#4B4B4B] text-xs group-hover:text-[#1CB0F6] transition-colors">
                          {f.name}
                        </td>
                        <td className="py-2.5 px-2 text-[#777777] text-xs">
                          {f.district}, {f.city}
                        </td>
                        <td className="py-2.5 px-2 text-[#777777] text-xs font-semibold">
                          {f.hotline || '—'}
                        </td>
                        <td className="py-2.5 px-1.5 text-center">
                          <span className="text-xs font-black text-[#4B4B4B]">{f.totalUnits}</span>
                        </td>
                        <td className="py-2.5 px-1.5 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-black text-[#1CB0F6] leading-none">
                              {f.occupiedUnits}
                            </span>
                            <span className="text-[9px] font-bold text-[#777777] mt-0.5">
                              ({f.activeContractsCount} HĐ)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-1.5 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-black text-[#FF9600] leading-none">
                              {f.pendingReservationsCount}
                            </span>
                            <span className="text-[9px] font-bold text-[#AFAFAF] mt-0.5">
                              chờ nhận
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-1.5 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-black text-[#58CC02] leading-none">
                              {avail}
                            </span>
                            <span className="text-[9px] font-bold text-[#AFAFAF] mt-0.5">
                              sẵn sàng
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {f.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#EAF7DD] border border-[#B4E885] text-[#58CC02] text-[11px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#58CC02]"></span>
                              <span>Hoạt động</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFF0F0] border border-[#FFC1C1] text-[#FF4B4B] text-[11px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4B4B]"></span>
                              <span>Tạm ngừng</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenDetail(f)}
                              className="duo-btn-blue py-1 px-2 rounded-lg text-[11px] flex items-center gap-1"
                              title="Xem chi tiết"
                            >
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              <span>Chi tiết</span>
                            </button>
                            <button
                              onClick={() => handleOpenEdit(f)}
                              className="duo-btn-white p-1 rounded-lg"
                              title="Sửa thông tin"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleOpenStatusModal(f)}
                              className={`p-1 rounded-lg ${
                                f.status === 'ACTIVE'
                                  ? 'duo-btn-gray text-[#FF4B4B] hover:text-[#EA2B2B]'
                                  : 'duo-btn-green'
                              }`}
                              title={f.status === 'ACTIVE' ? 'Tạm ngừng hoạt động' : 'Kích hoạt hoạt động'}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {f.status === 'ACTIVE' ? 'pause_circle' : 'play_circle'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL: CHI TIẾT CƠ SỞ (KHI BẤM VÔ CƠ SỞ ĐỂ COI)
          ======================================================== */}
      {detailModalOpen && activeFacility && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="px-6 py-5 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] text-[#1CB0F6] flex items-center justify-center font-black shrink-0">
                  <span className="material-symbols-outlined text-[26px]">warehouse</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#4B4B4B] leading-tight">
                      {activeFacility.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg bg-[#EBF7FF] border-2 border-[#84D8FF] text-[#1CB0F6] font-black text-xs">
                      {activeFacility.code}
                    </span>
                    {activeFacility.status === 'ACTIVE' ? (
                      <span className="duo-badge bg-[#EAF7DD] border-2 border-[#B4E885] text-[#58CC02]">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="duo-badge bg-[#FFF0F0] border-2 border-[#FFC1C1] text-[#FF4B4B] font-black">
                        Tạm ngừng
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[#777777] mt-0.5 block">
                    Báo cáo chi tiết cơ sở & vận hành ô kho
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] text-[#777777] hover:text-[#4B4B4B] flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body Modal (Scrollable) */}
            <div className="p-6 space-y-5 overflow-y-auto text-xs font-bold">
              {/* Khối 1: Thông tin địa điểm & Liên hệ */}
              <div className="p-4 rounded-2xl bg-[#FAFAFA] border-2 border-[#EBEBEB] space-y-2.5">
                <h4 className="text-xs font-black uppercase text-[#4B4B4B] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1CB0F6] text-[18px]">location_on</span>
                  <span>Địa điểm & Quản lý cơ sở</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-[11px] font-black text-[#AFAFAF] block">ĐỊA CHỈ ĐẦY ĐỦ</span>
                    <span className="text-[#4B4B4B] font-bold">
                      {activeFacility.address}, {activeFacility.district}, {activeFacility.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[#AFAFAF] block">HOTLINE LIÊN HỆ</span>
                    <span className="text-[#4B4B4B] font-bold">
                      {activeFacility.hotline || 'Chưa thiết lập'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[#AFAFAF] block">QUẢN LÝ CƠ SỞ (FM)</span>
                    <span className="text-[#4B4B4B] font-bold">
                      {activeFacility.managerName ? (
                        `${activeFacility.managerName} (${activeFacility.managerPhone || '—'})`
                      ) : (
                        <span className="text-[#AFAFAF] italic font-normal">Chưa phân công</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[#AFAFAF] block">EMAIL QUẢN LÝ</span>
                    <span className="text-[#4B4B4B] font-bold">
                      {activeFacility.managerEmail || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Khối 2: Tình trạng ô kho cơ sở */}
              <div className="p-4 rounded-2xl bg-[#FAFAFA] border-2 border-[#EBEBEB] space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-[#4B4B4B] tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1CB0F6] text-[18px]">inventory_2</span>
                    <span>Tình trạng ô kho cơ sở</span>
                  </h4>
                  <span className="text-xs font-black text-[#1CB0F6] px-2.5 py-1 rounded-xl bg-white border border-[#E5E5E5]">
                    {activeFacility.occupiedUnits}/{activeFacility.totalUnits} đang thuê
                  </span>
                </div>

                {(() => {
                  const total = activeFacility.totalUnits || 0;
                  const occupied = activeFacility.occupiedUnits || 0;
                  const pending = activeFacility.pendingReservationsCount || 0;
                  const available = getFacilityAvailable(activeFacility);

                  const occPct = total > 0 ? (occupied / total) * 100 : 0;
                  const pendPct = total > 0 ? (pending / total) * 100 : 0;
                  const availPct = total > 0 ? Math.max(0, 100 - occPct - pendPct) : 0;

                  return (
                    <div className="space-y-3">
                      {/* Thanh tiến độ trực quan */}
                      <div className="space-y-3">
                        <div className="w-full h-3.5 bg-[#E5E5E5] rounded-full overflow-hidden flex shadow-inner">
                          {occPct > 0 && (
                            <div
                              className="h-full bg-[#1CB0F6] transition-all duration-300"
                              style={{ width: `${occPct}%` }}
                              title={`Đang thuê: ${occupied} ô`}
                            ></div>
                          )}
                          {pendPct > 0 && (
                            <div
                              className="h-full bg-[#FF9600] transition-all duration-300"
                              style={{ width: `${pendPct}%` }}
                              title={`Chờ nhận: ${pending} ô`}
                            ></div>
                          )}
                          {availPct > 0 && (
                            <div
                              className="h-full bg-[#58CC02] transition-all duration-300"
                              style={{ width: `${availPct}%` }}
                              title={`Còn trống: ${available} ô`}
                            ></div>
                          )}
                        </div>

                        {/* Mấy chấm trạng thái trong modal: vừa phải, dễ đọc */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-sm font-bold text-[#4B4B4B]">
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#1CB0F6] shrink-0"></span>
                            <span>
                              Đang thuê: <strong className="text-base font-black text-[#1CB0F6]">{occupied}</strong>{' '}
                              <span className="text-xs font-bold text-[#777777]">({activeFacility.activeContractsCount || 0} hợp đồng)</span>
                            </span>
                          </span>

                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#FF9600] shrink-0"></span>
                            <span>
                              Chờ nhận: <strong className="text-base font-black text-[#FF9600]">{pending}</strong>{' '}
                              <span className="text-xs font-bold text-[#777777]">(ô chờ nhận)</span>
                            </span>
                          </span>

                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#58CC02] shrink-0"></span>
                            <span>
                              Còn trống: <strong className="text-base font-black text-[#58CC02]">{available}</strong>{' '}
                              <span className="text-xs font-bold text-[#777777]">(ô sẵn sàng)</span>
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Khối 3: Chính sách áp dụng */}
              <div className="p-4 rounded-2xl bg-[#EBF7FF] border-2 border-[#84D8FF] space-y-2">
                <h4 className="text-xs font-black uppercase text-[#0066CC] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">policy</span>
                  <span>Chính sách thuê mặc định (Rental Policy)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#0066CC]">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-[#BCE4FF]">
                    <span className="text-[10px] font-black text-[#5588AA] block">HỆ SỐ CỌC</span>
                    <span className="font-black text-[#0066CC]">x1 tháng tiền thuê</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-[#BCE4FF]">
                    <span className="text-[10px] font-black text-[#5588AA] block">MIỄN PHÍ HUỶ</span>
                    <span className="font-black text-[#0066CC]">Trước 24 giờ nhận kho</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-[#BCE4FF]">
                    <span className="text-[10px] font-black text-[#5588AA] block">PHÍ HUỶ TRỄ HẠN</span>
                    <span className="font-black text-[#0066CC]">50% tiền cọc</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal với các nút Thao tác */}
            <div className="px-6 py-4 border-t-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenEdit(activeFacility);
                  }}
                  className="duo-btn-white py-2 px-3 text-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Sửa cơ sở</span>
                </button>

                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    handleOpenStatusModal(activeFacility);
                  }}
                  className={`py-2 px-3 text-xs flex items-center gap-1.5 ${
                    activeFacility.status === 'ACTIVE'
                      ? 'duo-btn-gray text-[#FF4B4B] hover:text-[#EA2B2B]'
                      : 'duo-btn-green'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {activeFacility.status === 'ACTIVE' ? 'pause_circle' : 'play_circle'}
                  </span>
                  <span>{activeFacility.status === 'ACTIVE' ? 'Tạm ngừng' : 'Kích hoạt lại'}</span>
                </button>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="duo-btn-blue py-2 px-5 text-xs font-black"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: THÊM CƠ SỞ MỚI
          ======================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EAF7DD] border-2 border-[#B4E885] text-[#58CC02] flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-[24px]">add_business</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#4B4B4B] leading-tight">Thêm cơ sở mới</h3>
                  <span className="text-[11px] font-extrabold text-[#AFAFAF] uppercase tracking-wider">
                    Thiết lập cơ sở lưu trữ
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] text-[#777777] hover:text-[#4B4B4B] flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs font-bold">
              {/* Mã cơ sở */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Mã cơ sở <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  placeholder="VD: TB, BT, Q7, HN..."
                  className={`duo-input w-full uppercase font-black tracking-widest ${
                    createErrors.code ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''
                  }`}
                />
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
                  Từ 2 đến 4 ký tự in hoa hoặc số (ví dụ: TB, BT, Q7, HN). Dùng để tạo mã nhận diện ô kho.
                </p>
                {createErrors.code && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{createErrors.code}</p>
                )}
              </div>

              {/* Tên cơ sở */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Tên cơ sở <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="VD: QueenKho Tân Bình"
                  className={`duo-input w-full ${createErrors.name ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                />
                {createErrors.name && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{createErrors.name}</p>
                )}
              </div>

              {/* Tỉnh/Thành phố & Quận/Huyện */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                    Tỉnh / Thành phố <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    placeholder="VD: TP.HCM"
                    className={`duo-input w-full ${createErrors.city ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                  />
                  {createErrors.city && (
                    <p className="text-xs font-black text-[#FF4B4B] mt-1">{createErrors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                    Quận / Huyện <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.district}
                    onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
                    placeholder="VD: Tân Bình"
                    className={`duo-input w-full ${createErrors.district ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                  />
                  {createErrors.district && (
                    <p className="text-xs font-black text-[#FF4B4B] mt-1">{createErrors.district}</p>
                  )}
                </div>
              </div>

              {/* Địa chỉ */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Địa chỉ chi tiết <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="VD: 142 Cộng Hòa, Phường 13"
                  className={`duo-input w-full ${createErrors.address ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                />
                {createErrors.address && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{createErrors.address}</p>
                )}
              </div>

              {/* Hotline */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Hotline liên hệ
                </label>
                <input
                  type="text"
                  value={createForm.hotline}
                  onChange={(e) => setCreateForm({ ...createForm, hotline: e.target.value })}
                  placeholder="VD: 028-3811-0001"
                  className={`duo-input w-full ${createErrors.hotline ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                />
                {createErrors.hotline && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{createErrors.hotline}</p>
                )}
              </div>

              {/* Notice */}
              <div className="p-3.5 rounded-2xl bg-[#EBF7FF] border-2 border-[#84D8FF] text-[#0066CC] text-xs font-bold leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1CB0F6] shrink-0 mt-0.5">info</span>
                <span>
                  Hệ thống sẽ tự động khởi tạo Chính sách thuê mặc định (hệ số cọc x1 tháng, phí huỷ 50%, miễn phí huỷ 24h, phí phạt trễ hạn) tương ứng cho cơ sở này.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t-2 border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="duo-btn-gray py-2 px-4 text-xs cursor-pointer"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="duo-btn-green py-2 px-5 text-xs flex items-center gap-1.5"
                >
                  {submitting && (
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>Xác nhận tạo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: SỬA CƠ SỞ
          ======================================================== */}
      {editModalOpen && activeFacility && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#EBF7FF] border-2 border-[#84D8FF] text-[#1CB0F6] flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-[24px]">edit_location</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#4B4B4B] leading-tight">Cập nhật cơ sở</h3>
                  <span className="text-[11px] font-extrabold text-[#AFAFAF] uppercase tracking-wider">
                    Mã cơ sở: {activeFacility.code}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] text-[#777777] hover:text-[#4B4B4B] flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs font-bold">
              {/* Code (Read-only) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#AFAFAF] mb-1">
                  Mã cơ sở
                </label>
                <input
                  type="text"
                  value={activeFacility.code || ''}
                  disabled
                  className="duo-input w-full bg-[#EAEAEA] border-[#D0D0D0] text-[#777777] font-black cursor-not-allowed select-none"
                />
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
                  Mã cơ sở cố định theo hệ thống ô kho và hợp đồng, không thay đổi sau khi tạo.
                </p>
              </div>

              {/* Tên cơ sở */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Tên cơ sở <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`duo-input w-full ${editErrors.name ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                />
                {editErrors.name && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{editErrors.name}</p>
                )}
              </div>

              {/* Tỉnh/Thành phố & Quận/Huyện */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                    Tỉnh / Thành phố <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className={`duo-input w-full ${editErrors.city ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                  />
                  {editErrors.city && (
                    <p className="text-xs font-black text-[#FF4B4B] mt-1">{editErrors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                    Quận / Huyện <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.district}
                    onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                    className={`duo-input w-full ${editErrors.district ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                  />
                  {editErrors.district && (
                    <p className="text-xs font-black text-[#FF4B4B] mt-1">{editErrors.district}</p>
                  )}
                </div>
              </div>

              {/* Địa chỉ */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Địa chỉ chi tiết <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className={`duo-input w-full ${editErrors.address ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                />
                {editErrors.address && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{editErrors.address}</p>
                )}
              </div>

              {/* Hotline */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-1">
                  Hotline liên hệ
                </label>
                <input
                  type="text"
                  value={editForm.hotline}
                  onChange={(e) => setEditForm({ ...editForm, hotline: e.target.value })}
                  className={`duo-input w-full ${editErrors.hotline ? 'border-[#FF4B4B] bg-[#FFF2F2]' : ''}`}
                />
                {editErrors.hotline && (
                  <p className="text-xs font-black text-[#FF4B4B] mt-1">{editErrors.hotline}</p>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t-2 border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="duo-btn-gray py-2 px-4 text-xs cursor-pointer"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="duo-btn-blue py-2 px-5 text-xs flex items-center gap-1.5"
                >
                  {submitting && (
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ĐỔI TRẠNG THÁI
          ======================================================== */}
      {statusModalOpen && activeFacility && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E5E5E5] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#F7F7F7]">
              <h3 className="text-base font-black text-[#4B4B4B]">
                {activeFacility.status === 'ACTIVE' ? 'Tạm Ngừng Cơ Sở' : 'Kích Hoạt Lại Cơ Sở'}
              </h3>
              <button
                onClick={() => setStatusModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] text-[#777777] hover:text-[#4B4B4B] flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-bold">
              {activeFacility.status === 'ACTIVE' ? (
                activeFacility.activeContractsCount > 0 || activeFacility.pendingReservationsCount > 0 ? (
                  // Chặn không cho tắt nếu còn hợp đồng/đơn
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-[#FFECEC] border-2 border-[#FFA8A8] text-[#D32F2F] space-y-2 leading-relaxed">
                      <div className="flex items-center gap-2 font-black text-sm">
                        <span className="material-symbols-outlined text-[20px]">block</span>
                        <span>Không thể tạm ngừng cơ sở này!</span>
                      </div>
                      <p>
                        Cơ sở hiện còn <strong>{activeFacility.activeContractsCount} hợp đồng có hiệu lực</strong> và <strong>{activeFacility.pendingReservationsCount} đơn đặt chỗ chờ xử lý</strong>.
                      </p>
                      <p className="text-[11px] text-[#A82222]">
                        Vui lòng đảm bảo tất cả hợp đồng đã kết thúc hoặc thanh lý xong và không còn đơn đặt chỗ nào trước khi tạm ngừng hoạt động cơ sở.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setStatusModalOpen(false)}
                        className="duo-btn-blue py-2 px-5 text-xs"
                      >
                        Đã hiểu
                      </button>
                    </div>
                  </div>
                ) : (
                  // Được phép tạm ngừng
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-[#4B4B4B] leading-relaxed">
                      Bạn có chắc muốn tạm ngừng cơ sở <strong className="text-[#FF4B4B]">"{activeFacility.name}"</strong>?
                    </p>
                    <div className="p-3.5 rounded-2xl bg-[#FFF8E7] border-2 border-[#FFE2A6] text-[#8A5800] text-xs font-bold leading-relaxed">
                      Cơ sở sẽ bị ẩn khỏi kết quả tìm kiếm và không tiếp nhận đặt chỗ mới. Lịch sử hợp đồng và dữ liệu ô kho vẫn được bảo lưu an toàn.
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <button
                        onClick={() => setStatusModalOpen(false)}
                        className="duo-btn-gray py-2 px-4 text-xs cursor-pointer"
                      >
                        Huỷ bỏ
                      </button>
                      <button
                        onClick={handleConfirmStatusToggle}
                        disabled={submitting}
                        className="duo-btn-red py-2 px-5 text-xs flex items-center gap-1.5"
                      >
                        {submitting && (
                          <span className="material-symbols-outlined text-[16px] animate-spin">
                            progress_activity
                          </span>
                        )}
                        <span>Xác nhận tạm ngừng</span>
                      </button>
                    </div>
                  </div>
                )
              ) : (
                // Kích hoạt lại
                <div className="space-y-3">
                  <p className="text-sm font-bold text-[#4B4B4B] leading-relaxed">
                    Kích hoạt lại cơ sở <strong className="text-[#58CC02]">"{activeFacility.name}"</strong>? Cơ sở sẽ hiển thị trở lại trên trang tìm kiếm và khách hàng có thể đặt chỗ.
                  </p>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setStatusModalOpen(false)}
                      className="duo-btn-gray py-2 px-4 text-xs cursor-pointer"
                    >
                      Huỷ bỏ
                    </button>
                    <button
                      onClick={handleConfirmStatusToggle}
                      disabled={submitting}
                      className="duo-btn-green py-2 px-5 text-xs flex items-center gap-1.5"
                    >
                      {submitting && (
                        <span className="material-symbols-outlined text-[16px] animate-spin">
                          progress_activity
                        </span>
                      )}
                      <span>Kích hoạt ngay</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
