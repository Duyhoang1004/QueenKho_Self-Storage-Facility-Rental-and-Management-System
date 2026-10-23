import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getBomUnitTypes,
  createUnitType,
  updateUnitType,
  updateUnitTypeStatus,
  deleteUnitType,
} from '../../services/unitTypeService';

// Format tiền tệ VNĐ
const formatVND = (amount) => {
  if (amount == null || isNaN(amount)) return '0 ₫';
  return Number(amount).toLocaleString('vi-VN') + ' ₫';
};

export default function BomUnitTypesPage() {
  const [allUnitTypes, setAllUnitTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Bộ lọc & Sắp xếp
  const [keyword, setKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('ID_ASC'); // 'ID_ASC' | 'PRICE_ASC' | 'PRICE_DESC' | 'AREA_ASC' | 'AREA_DESC'

  // Modals
  const [activeUnitType, setActiveUnitType] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Form tạo mới
  const [createForm, setCreateForm] = useState({
    name: '',
    areaSqm: '',
    volumeCbm: '',
    basePriceMonthly: '',
    dimensionLength: '',
    dimensionWidth: '',
    dimensionHeight: '',
    suggestedCapacity: '',
    features: '',
    status: 'ACTIVE',
  });
  const [createErrors, setCreateErrors] = useState({});

  // Form chỉnh sửa
  const [editForm, setEditForm] = useState({
    name: '',
    areaSqm: '',
    volumeCbm: '',
    basePriceMonthly: '',
    dimensions: '',
    suggestedCapacity: '',
    features: '',
    status: 'ACTIVE',
  });
  const [editErrors, setEditErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);

  // Lấy actor user id từ session
  const getActorUserId = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u.userId || 1;
      }
    } catch {
      return 1;
    }
    return 1;
  };

  // Flash message helpers
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 7000);
  };

  // Tải danh sách loại kho
  const fetchUnitTypes = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getBomUnitTypes();
      setAllUnitTypes(data);

      setActiveUnitType((prev) => {
        if (!prev) return null;
        return data.find((item) => item.id === prev.id) || prev;
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh mục loại kho & giá niêm yết');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchUnitTypes, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchUnitTypes]);

  // Bộ lọc & Sắp xếp Client-side
  const filteredUnitTypes = useMemo(() => {
    let list = allUnitTypes.filter((ut) => {
      // 1. Lọc theo trạng thái
      if (selectedStatus !== 'ALL' && ut.status !== selectedStatus) return false;

      // 2. Lọc theo từ khóa (tên, kích thước, sức chứa, đặc điểm)
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const matchName = ut.name?.toLowerCase().includes(kw);
        const matchDim = ut.dimensions?.toLowerCase().includes(kw);
        const matchCap = ut.suggestedCapacity?.toLowerCase().includes(kw);
        const matchFeat = ut.features?.toLowerCase().includes(kw);
        if (!matchName && !matchDim && !matchCap && !matchFeat) return false;
      }

      return true;
    });

    // Sắp xếp
    list.sort((a, b) => {
      if (sortBy === 'PRICE_ASC') return (a.basePriceMonthly || 0) - (b.basePriceMonthly || 0);
      if (sortBy === 'PRICE_DESC') return (b.basePriceMonthly || 0) - (a.basePriceMonthly || 0);
      if (sortBy === 'AREA_ASC') return (a.areaSqm || 0) - (b.areaSqm || 0);
      if (sortBy === 'AREA_DESC') return (b.areaSqm || 0) - (a.areaSqm || 0);
      return (a.id || 0) - (b.id || 0);
    });

    return list;
  }, [allUnitTypes, selectedStatus, keyword, sortBy]);

  // Thống kê tổng quan danh mục
  const metrics = useMemo(() => {
    const totalTypes = allUnitTypes.length;
    const activeTypes = allUnitTypes.filter((ut) => ut.status === 'ACTIVE').length;
    const inactiveTypes = allUnitTypes.filter((ut) => ut.status === 'INACTIVE').length;

    return {
      totalTypes,
      activeTypes,
      inactiveTypes,
    };
  }, [allUnitTypes]);

  // ─────────────────────────────────────────────────────────────
  // VALIDATION HELPERS (PR-M3)
  // ─────────────────────────────────────────────────────────────
  const validateForm = (form, isEdit = false, currentId = null) => {
    const errors = {};

    if (!form.name || !form.name.trim()) {
      errors.name = 'Vui lòng nhập tên loại kho';
    } else if (form.name.trim().length > 100) {
      errors.name = 'Tên loại kho không vượt quá 100 ký tự';
    } else {
      const duplicate = allUnitTypes.some(
        (ut) =>
          ut.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
          (!isEdit || ut.id !== currentId)
      );
      if (duplicate) {
        errors.name = 'Tên loại kho này đã tồn tại trong hệ thống';
      }
    }

    const area = parseFloat(form.areaSqm);
    if (form.areaSqm === '' || isNaN(area) || area <= 0) {
      errors.areaSqm = 'Diện tích phải là số lớn hơn 0 m²';
    }

    const volume = parseFloat(form.volumeCbm);
    if (form.volumeCbm === '' || isNaN(volume) || volume <= 0) {
      errors.volumeCbm = 'Thể tích phải là số lớn hơn 0 m³';
    }

    const price = parseFloat(form.basePriceMonthly);
    if (form.basePriceMonthly === '' || isNaN(price) || price <= 0) {
      errors.basePriceMonthly = 'Giá niêm yết phải lớn hơn 0 VNĐ';
    }

    if (isEdit) {
      if (form.dimensions && form.dimensions.length > 100) {
        errors.dimensions = 'Kích thước không vượt quá 100 ký tự';
      }
    } else {
      const dimensionValues = [form.dimensionLength, form.dimensionWidth, form.dimensionHeight];
      const filledDimensions = dimensionValues.filter((value) => String(value ?? '').trim() !== '');
      if (filledDimensions.length > 0 && filledDimensions.length < 3) {
        errors.dimensions = 'Vui lòng nhập đủ chiều dài, chiều rộng và chiều cao';
      } else if (filledDimensions.some((value) => Number(value) <= 0)) {
        errors.dimensions = 'Các kích thước phải lớn hơn 0 mét';
      }
    }
    if (form.suggestedCapacity && form.suggestedCapacity.length > 150) {
      errors.suggestedCapacity = 'Gợi ý sức chứa không vượt quá 150 ký tự';
    }
    if (form.features && form.features.length > 500) {
      errors.features = 'Mô tả đặc điểm không vượt quá 500 ký tự';
    }

    return errors;
  };

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setCreateForm({
      name: '',
      areaSqm: '',
      volumeCbm: '',
      basePriceMonthly: '',
      dimensionLength: '',
      dimensionWidth: '',
      dimensionHeight: '',
      suggestedCapacity: '',
      features: '',
      status: 'ACTIVE',
    });
    setCreateErrors({});
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm(createForm, false);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        areaSqm: parseFloat(createForm.areaSqm),
        volumeCbm: parseFloat(createForm.volumeCbm),
        basePriceMonthly: parseFloat(createForm.basePriceMonthly),
        dimensions:
          createForm.dimensionLength && createForm.dimensionWidth && createForm.dimensionHeight
            ? `${createForm.dimensionLength}m x ${createForm.dimensionWidth}m x ${createForm.dimensionHeight}m`
            : null,
        suggestedCapacity: createForm.suggestedCapacity?.trim() || null,
        features: createForm.features?.trim() || null,
        status: createForm.status,
      };

      const actorUserId = getActorUserId();
      const res = await createUnitType(payload, actorUserId);
      showSuccess(`Đã tạo loại kho mới: "${res.name}".`);
      setCreateModalOpen(false);
      fetchUnitTypes();
    } catch (err) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi tạo loại kho mới';
      setCreateErrors((prev) => ({ ...prev, api: msg }));
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (ut) => {
    setActiveUnitType(ut);
    setEditForm({
      name: ut.name || '',
      areaSqm: ut.areaSqm != null ? ut.areaSqm.toString() : '',
      volumeCbm: ut.volumeCbm != null ? ut.volumeCbm.toString() : '',
      basePriceMonthly: ut.basePriceMonthly != null ? ut.basePriceMonthly.toString() : '',
      dimensions: ut.dimensions || '',
      suggestedCapacity: ut.suggestedCapacity || '',
      features: ut.features || '',
      status: ut.status || 'ACTIVE',
    });
    setEditErrors({});
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!activeUnitType) return;

    const errors = validateForm(editForm, true, activeUnitType.id);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        areaSqm: parseFloat(editForm.areaSqm),
        volumeCbm: parseFloat(editForm.volumeCbm),
        basePriceMonthly: parseFloat(editForm.basePriceMonthly),
        dimensions: editForm.dimensions?.trim() || null,
        suggestedCapacity: editForm.suggestedCapacity?.trim() || null,
        features: editForm.features?.trim() || null,
        status: editForm.status,
      };

      const actorUserId = getActorUserId();
      const res = await updateUnitType(activeUnitType.id, payload, actorUserId);
      showSuccess(
        `Đã cập nhật loại kho "${res.name}". Giá mới áp dụng cho đơn mới và lần gia hạn tiếp theo.`
      );
      setEditModalOpen(false);
      fetchUnitTypes();
    } catch (err) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật loại kho';
      setEditErrors((prev) => ({ ...prev, api: msg }));
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openStatusModal = (ut) => {
    setActiveUnitType(ut);
    setStatusModalOpen(true);
  };

  const handleToggleStatus = async () => {
    if (!activeUnitType) return;
    setSubmitting(true);
    const targetStatus = activeUnitType.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const actorUserId = getActorUserId();
      await updateUnitTypeStatus(activeUnitType.id, targetStatus, actorUserId);
      showSuccess(
        targetStatus === 'INACTIVE'
          ? `Đã tạm ngưng loại kho "${activeUnitType.name}". Loại kho này sẽ được ẩn khỏi tìm kiếm của khách hàng.`
          : `Đã kích hoạt lại loại kho "${activeUnitType.name}".`
      );
      setStatusModalOpen(false);
      fetchUnitTypes();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể đổi trạng thái loại kho';
      showError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (ut) => {
    setActiveUnitType(ut);
    setDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!activeUnitType) return;
    setSubmitting(true);
    try {
      const actorUserId = getActorUserId();
      await deleteUnitType(activeUnitType.id, actorUserId);
      showSuccess(`Đã xóa loại kho "${activeUnitType.name}".`);
      setDeleteModalOpen(false);
      fetchUnitTypes();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể xóa loại kho này.';
      showError(msg);
      setDeleteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 select-none space-y-6">

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & BREADCRUMB
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
            <span>Hệ thống BOM</span>
            <span>/</span>
            <span>Dịch vụ</span>
            <span>/</span>
            <span className="text-[#1CB0F6]">Loại kho & giá niêm yết</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-[#4B4B4B] tracking-tight flex items-center gap-3">
            <span>Loại Kho & Giá Niêm Yết</span>
            <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF] text-[11px] font-black uppercase tracking-wider">
              Áp dụng toàn hệ thống
            </span>
          </h1>

          <p className="text-xs font-bold text-[#AFAFAF]">
            Quy chuẩn kỹ thuật diện tích, thể tích, kích thước gợi ý và đơn giá thuê niêm yết theo tháng áp dụng toàn hệ thống QueenKho.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          type="button"
          className="duo-btn-green px-5 py-3 text-xs font-black uppercase tracking-wider flex items-center gap-2 self-start md:self-center shadow-xs"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          <span>Thêm loại kho mới</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FLASH MESSAGES
      ───────────────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] text-[#337401] font-bold text-sm shadow-xs animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[24px] shrink-0 text-[#58CC02]">
            check_circle
          </span>
          <div className="flex-1">{successMsg}</div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-[#337401] hover:opacity-70 p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#FFDFE0] border-2 border-[#FF4B4B] text-[#D32F2F] font-bold text-sm shadow-xs animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[24px] shrink-0 text-[#FF4B4B]">
            error
          </span>
          <div className="flex-1">{errorMsg}</div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-[#D32F2F] hover:opacity-70 p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. METRIC SUMMARY CARDS (NO STORAGE UNITS COUNT)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Tổng số loại kho */}
        <div className="duo-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] block">
              Tổng loại kho
            </span>
            <span className="text-2xl md:text-3xl font-black text-[#4B4B4B] mt-0.5 block">
              {metrics.totalTypes}
            </span>
            <span className="text-[12px] font-bold text-[#777777] mt-0.5 block">
              Quy chuẩn toàn chuỗi
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
            <span className="material-symbols-outlined text-[28px]">inventory_2</span>
          </div>
        </div>

        {/* Card 2: Đang kinh doanh */}
        <div className="duo-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] block">
              Đang kinh doanh
            </span>
            <span className="text-2xl md:text-3xl font-black text-[#58CC02] mt-0.5 block">
              {metrics.activeTypes}
            </span>
            <span className="text-[12px] font-bold text-[#58A700] mt-0.5 block">
              Khách có thể đặt chỗ
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58CC02]">
            <span className="material-symbols-outlined text-[28px]">storefront</span>
          </div>
        </div>

        {/* Card 3: Tạm ngưng */}
        <div className="duo-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] block">
              Tạm ngưng
            </span>
            <span className="text-2xl md:text-3xl font-black text-[#FF9600] mt-0.5 block">
              {metrics.inactiveTypes}
            </span>
            <span className="text-[12px] font-bold text-[#AF7500] mt-0.5 block">
              Ẩn khỏi tìm kiếm
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FFF4E5] border-2 border-[#FFD8A8] flex items-center justify-center text-[#FF9600]">
            <span className="material-symbols-outlined text-[28px]">pause_circle</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SEARCH & FILTER TOOLBAR
      ───────────────────────────────────────────────────────────── */}
      <div className="duo-card p-4 bg-[#FAFAFA] flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm tên loại kho, kích thước, sức chứa..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-[#E5E5E5] rounded-xl text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#1CB0F6] transition-all placeholder:text-[#AFAFAF]"
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AFAFAF] hover:text-[#4B4B4B]"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-[#E5E5E5]">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === 'ALL'
                  ? 'bg-[#1CB0F6] text-white shadow-xs'
                  : 'text-[#777777] hover:text-[#4B4B4B]'
              }`}
            >
              Tất cả ({allUnitTypes.length})
            </button>
            <button
              onClick={() => setSelectedStatus('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === 'ACTIVE'
                  ? 'bg-[#58CC02] text-white shadow-xs'
                  : 'text-[#777777] hover:text-[#4B4B4B]'
              }`}
            >
              Kinh doanh ({metrics.activeTypes})
            </button>
            <button
              onClick={() => setSelectedStatus('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === 'INACTIVE'
                  ? 'bg-[#FF9600] text-white shadow-xs'
                  : 'text-[#777777] hover:text-[#4B4B4B]'
              }`}
            >
              Tạm ngưng ({metrics.inactiveTypes})
            </button>
          </div>

          {/* Sắp xếp */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border-2 border-[#E5E5E5] bg-white rounded-xl px-3 py-2 text-xs font-bold text-[#4B4B4B] focus:outline-none focus:border-[#1CB0F6]"
            >
              <option value="ID_ASC">Mặc định (Theo ID)</option>
              <option value="PRICE_ASC">Giá niêm yết: Thấp → Cao</option>
              <option value="PRICE_DESC">Giá niêm yết: Cao → Thấp</option>
              <option value="AREA_ASC">Diện tích: Nhỏ → Lớn</option>
              <option value="AREA_DESC">Diện tích: Lớn → Nhỏ</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchUnitTypes}
            title="Làm mới danh sách"
            className="duo-btn-white p-2 text-xs"
          >
            <span className="material-symbols-outlined text-[18px] block">refresh</span>
          </button>
        </div>
      </div>

      {/* 4. Danh sách loại kho - chỉ hiển thị dạng bảng */}
      {loading ? (
        <div className="py-20 text-center duo-card">
          <div className="inline-block animate-spin text-[#58CC02] mb-3">
            <span className="material-symbols-outlined text-[40px]">progress_activity</span>
          </div>
          <p className="text-sm font-black text-[#777777]">Đang tải danh mục loại kho & giá niêm yết...</p>
        </div>
      ) : filteredUnitTypes.length === 0 ? (
        <div className="py-20 text-center duo-card p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-[#FFF4E5] border-2 border-[#FFD8A8] flex items-center justify-center text-[#FF9600]">
            <span className="material-symbols-outlined text-[36px]">search_off</span>
          </div>
          <h3 className="text-lg font-black text-[#4B4B4B]">Không tìm thấy loại kho nào phù hợp</h3>
          <p className="text-xs font-bold text-[#AFAFAF] mt-1 max-w-md mx-auto">
            {keyword || selectedStatus !== 'ALL'
              ? 'Thử đổi từ khóa tìm kiếm hoặc bấm xóa bộ lọc để hiển thị toàn bộ danh sách.'
              : 'Hệ thống chưa có loại kho nào. Hãy bấm "Thêm loại kho mới" để bắt đầu.'}
          </p>
          {(keyword || selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setKeyword('');
                setSelectedStatus('ALL');
              }}
              className="mt-4 duo-btn-white px-4 py-2 text-xs font-black uppercase tracking-wider"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="duo-card overflow-hidden">
          <div className="flex flex-col gap-2 border-b-2 border-[#E5E5E5] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-[#4B4B4B]">Danh sách loại kho</h2>
              <p className="mt-0.5 text-xs font-bold text-[#AFAFAF]">
                Hiển thị {filteredUnitTypes.length} / {allUnitTypes.length} loại kho trong toàn hệ thống
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#777777]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#58CC02]" />
              Đang kinh doanh
              <span className="ml-2 h-2.5 w-2.5 rounded-full bg-[#FF9600]" />
              Tạm ngưng
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
                  <th className="px-4 py-3.5">Mã</th>
                  <th className="px-4 py-3.5">Loại kho</th>
                  <th className="px-4 py-3.5">Kích thước (D × R × C)</th>
                  <th className="px-4 py-3.5">Sức chứa</th>
                  <th className="px-4 py-3.5">Giá niêm yết</th>
                  <th className="px-4 py-3.5">Ô kho</th>
                  <th className="px-4 py-3.5 text-center">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDED] text-sm">
                {filteredUnitTypes.map((ut) => {
                  const isActive = ut.status === 'ACTIVE';

                  return (
                    <tr
                      key={ut.id}
                      className={`font-bold text-[#4B4B4B] transition-colors hover:bg-[#F2FAFF] ${
                        isActive ? 'bg-white' : 'bg-[#FFFCF7]'
                      }`}
                    >
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-1 text-xs font-black text-[#777777]">
                          #{ut.id}
                        </span>
                      </td>

                      <td className="max-w-[260px] px-4 py-4 align-top">
                        <div className="text-sm font-black text-[#4B4B4B]">{ut.name}</div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#777777]">
                          {ut.features || 'Chưa có mô tả đặc điểm'}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-[#4B4B4B]">
                          <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">straighten</span>
                          <span>{ut.dimensions || 'Chưa khai báo kích thước'}</span>
                        </div>
                      </td>

                      <td className="max-w-[210px] px-4 py-4 align-top">
                        <div className="flex items-start gap-2 text-xs leading-5 text-[#777777]">
                          <span className="material-symbols-outlined mt-0.5 text-[17px] text-[#FF9600]">shelves</span>
                          <span className="line-clamp-2">{ut.suggestedCapacity || 'Chưa có gợi ý sức chứa'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <span className="text-[15px] font-black text-[#58A700]">
                          {formatVND(ut.basePriceMonthly)}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-bold text-[#AFAFAF]">
                          mỗi tháng
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <div className="text-sm font-black text-[#4B4B4B]">{ut.totalUnits || 0} ô</div>
                        <div className="mt-1 text-[11px] font-bold text-[#777777]">
                          <span className="text-[#58A700]">{ut.availableUnits || 0} trống</span>
                          <span className="mx-1 text-[#D1D1D1]">·</span>
                          <span>{ut.occupiedUnits || 0} đang thuê</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center align-top whitespace-nowrap">
                        <span
                          className={`duo-badge text-[11px] font-black uppercase tracking-wider ${
                            isActive
                              ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                              : 'bg-[#FFF4E5] text-[#E65100] border border-[#FFD8A8]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isActive ? 'check_circle' : 'pause_circle'}
                          </span>
                          {isActive ? 'Kinh doanh' : 'Tạm ngưng'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right align-top whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(ut)}
                            title="Chỉnh sửa thông số & giá"
                            className="duo-btn-white p-2 text-xs text-[#58CC02] hover:text-[#46A302]"
                          >
                            <span className="material-symbols-outlined text-[18px] block">edit</span>
                          </button>

                          <button
                            onClick={() => openStatusModal(ut)}
                            title={isActive ? 'Tạm ngưng kinh doanh' : 'Kích hoạt kinh doanh'}
                            className={`duo-btn-white p-2 text-xs ${
                              isActive ? 'text-[#FF9600]' : 'text-[#58CC02]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px] block">
                              {isActive ? 'pause_circle' : 'play_circle'}
                            </span>
                          </button>

                          <button
                            onClick={() => openDeleteModal(ut)}
                            title={ut.canDelete ? 'Xóa loại kho' : 'Loại kho đã phát sinh dữ liệu, chỉ có thể tạm ngưng'}
                            className={`duo-btn-gray p-2 text-xs ${
                              ut.canDelete
                                ? 'text-[#FF4B4B] hover:bg-[#FF4B4B] hover:text-white'
                                : 'text-[#AFAFAF]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px] block">
                              {ut.canDelete ? 'delete' : 'lock'}
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

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: THÊM MỚI LOẠI KHO (PR-M3)
      ───────────────────────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="duo-card w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            {/* Header */}
            <div className="p-6 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58CC02]">
                  <span className="material-symbols-outlined text-[24px]">add_box</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#4B4B4B]">Thêm Loại Kho Mới</h3>
                  <p className="text-xs font-bold text-[#777777]">
                    Danh mục dùng chung cho tất cả cơ sở
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#AFAFAF] hover:text-[#4B4B4B] p-2 rounded-xl hover:bg-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px] block">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {createErrors.api && (
                <div className="p-4 rounded-2xl bg-[#FFDFE0] border-2 border-[#FF4B4B] text-[#D32F2F] text-xs font-bold">
                  {createErrors.api}
                </div>
              )}

              {/* Tên loại kho */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                  Tên loại kho <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Kho Mini 3.5m², Kho Tiêu Chuẩn 6m², Kho Gia Đình 12m²..."
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className={`w-full duo-input ${createErrors.name ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                />
                {createErrors.name && (
                  <p className="text-xs font-bold text-[#FF4B4B] mt-1">{createErrors.name}</p>
                )}
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
                  Tên loại kho phải là duy nhất trong toàn hệ thống.
                </p>
              </div>

              {/* Diện tích, Thể tích, Giá */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Diện tích (m²) <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="VD: 6.00"
                    value={createForm.areaSqm}
                    onChange={(e) => setCreateForm({ ...createForm, areaSqm: e.target.value })}
                    className={`w-full duo-input ${createErrors.areaSqm ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                  />
                  {createErrors.areaSqm && (
                    <p className="text-xs font-bold text-[#FF4B4B] mt-1">{createErrors.areaSqm}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Thể tích (m³) <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="VD: 16.20"
                    value={createForm.volumeCbm}
                    onChange={(e) => setCreateForm({ ...createForm, volumeCbm: e.target.value })}
                    className={`w-full duo-input ${createErrors.volumeCbm ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                  />
                  {createErrors.volumeCbm && (
                    <p className="text-xs font-bold text-[#FF4B4B] mt-1">{createErrors.volumeCbm}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Giá niêm yết (đ/tháng) <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="1000"
                    placeholder="VD: 1850000"
                    value={createForm.basePriceMonthly}
                    onChange={(e) => setCreateForm({ ...createForm, basePriceMonthly: e.target.value })}
                    className={`w-full duo-input ${createErrors.basePriceMonthly ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                  />
                  {createErrors.basePriceMonthly && (
                    <p className="text-xs font-bold text-[#FF4B4B] mt-1">{createErrors.basePriceMonthly}</p>
                  )}
                </div>
              </div>

              {/* Kích thước & Gợi ý sức chứa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Kích thước quy chuẩn (D x R x C)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Dài"
                        value={createForm.dimensionLength}
                        onChange={(e) => setCreateForm({ ...createForm, dimensionLength: e.target.value })}
                        className={`w-full duo-input pr-7 text-center ${createErrors.dimensions ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-[#AFAFAF]">m</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Rộng"
                        value={createForm.dimensionWidth}
                        onChange={(e) => setCreateForm({ ...createForm, dimensionWidth: e.target.value })}
                        className={`w-full duo-input pr-7 text-center ${createErrors.dimensions ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-[#AFAFAF]">m</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Cao"
                        value={createForm.dimensionHeight}
                        onChange={(e) => setCreateForm({ ...createForm, dimensionHeight: e.target.value })}
                        className={`w-full duo-input pr-7 text-center ${createErrors.dimensions ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-[#AFAFAF]">m</span>
                    </div>
                  </div>
                  {createErrors.dimensions && (
                    <p className="mt-1 text-xs font-bold text-[#FF4B4B]">{createErrors.dimensions}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Gợi ý sức chứa
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Chứa vừa đồ đạc căn hộ 1 phòng ngủ, 20 thùng..."
                    value={createForm.suggestedCapacity}
                    onChange={(e) => setCreateForm({ ...createForm, suggestedCapacity: e.target.value })}
                    className="w-full duo-input"
                  />
                </div>
              </div>

              {/* Đặc điểm / Tiện ích */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                  Đặc điểm nổi bật & Tiện ích đi kèm
                </label>
                <textarea
                  rows="3"
                  placeholder="VD: Kiểm soát nhiệt độ 24/7, khóa điện tử thông minh, gần thang máy..."
                  value={createForm.features}
                  onChange={(e) => setCreateForm({ ...createForm, features: e.target.value })}
                  className="w-full duo-input"
                />
              </div>

              {/* Trạng thái ban đầu */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                  Trạng thái kinh doanh ban đầu
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, status: 'ACTIVE' })}
                    className={`p-3 rounded-2xl border-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      createForm.status === 'ACTIVE'
                        ? 'bg-[#E8F5E9] border-[#58CC02] text-[#2E7D32]'
                        : 'bg-[#F7F7F7] border-[#E5E5E5] text-[#777777]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Kinh doanh ngay
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, status: 'INACTIVE' })}
                    className={`p-3 rounded-2xl border-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      createForm.status === 'INACTIVE'
                        ? 'bg-[#FFF4E5] border-[#FF9600] text-[#E65100]'
                        : 'bg-[#F7F7F7] border-[#E5E5E5] text-[#777777]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">pause_circle</span>
                    Tạm ngưng
                  </button>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t-2 border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="duo-btn-gray px-5 py-3 text-xs"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="duo-btn-green px-6 py-3 text-xs"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo loại kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL: CHỈNH SỬA THÔNG TIN & ĐƠN GIÁ NIÊM YẾT (PR-12)
      ───────────────────────────────────────────────────────────── */}
      {editModalOpen && activeUnitType && (
        <div className="fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="duo-card w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            {/* Header */}
            <div className="p-6 border-b-2 border-[#E5E5E5] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#DDF4FF] border-2 border-[#1CB0F6] flex items-center justify-center text-[#1CB0F6]">
                  <span className="material-symbols-outlined text-[24px]">edit_note</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#4B4B4B]">
                    Chỉnh Sửa Loại Kho #{activeUnitType.id}
                  </h3>
                  <p className="text-xs font-bold text-[#777777]">
                    Cập nhật quy cách kỹ thuật & giá thuê niêm yết
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditModalOpen(false)}
                className="text-[#AFAFAF] hover:text-[#4B4B4B] p-2 rounded-xl hover:bg-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px] block">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {editErrors.api && (
                <div className="p-4 rounded-2xl bg-[#FFDFE0] border-2 border-[#FF4B4B] text-[#D32F2F] text-xs font-bold">
                  {editErrors.api}
                </div>
              )}

              {/* Notification Box: PR-12 */}
              <div className="p-4 rounded-2xl bg-[#E0F2FE] border-2 border-[#BAE6FD] text-[#0369A1] text-xs font-bold flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#0284C7] shrink-0 mt-0.5">
                  info
                </span>
                <div>
                  <span className="font-black uppercase tracking-wider block mb-1">
                    Lưu ý khi thay đổi giá:
                  </span>
                  Việc điều chỉnh giá niêm yết chỉ áp dụng cho các <strong>đơn đặt chỗ mới</strong> và <strong>lần gia hạn tiếp theo</strong>. Hợp đồng đang hiệu lực giữ nguyên mức giá đã ký kết.
                </div>
              </div>

              {/* Tên loại kho */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                  Tên loại kho <span className="text-[#FF4B4B]">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full duo-input ${editErrors.name ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                />
                {editErrors.name && (
                  <p className="text-xs font-bold text-[#FF4B4B] mt-1">{editErrors.name}</p>
                )}
              </div>

              {/* Diện tích, Thể tích, Giá */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Diện tích (m²) <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.areaSqm}
                    onChange={(e) => setEditForm({ ...editForm, areaSqm: e.target.value })}
                    className={`w-full duo-input ${editErrors.areaSqm ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                  />
                  {editErrors.areaSqm && (
                    <p className="text-xs font-bold text-[#FF4B4B] mt-1">{editErrors.areaSqm}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Thể tích (m³) <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.volumeCbm}
                    onChange={(e) => setEditForm({ ...editForm, volumeCbm: e.target.value })}
                    className={`w-full duo-input ${editErrors.volumeCbm ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                  />
                  {editErrors.volumeCbm && (
                    <p className="text-xs font-bold text-[#FF4B4B] mt-1">{editErrors.volumeCbm}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Giá niêm yết (đ/tháng) <span className="text-[#FF4B4B]">*</span>
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="1000"
                    value={editForm.basePriceMonthly}
                    onChange={(e) => setEditForm({ ...editForm, basePriceMonthly: e.target.value })}
                    className={`w-full duo-input ${editErrors.basePriceMonthly ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
                  />
                  {editErrors.basePriceMonthly && (
                    <p className="text-xs font-bold text-[#FF4B4B] mt-1">{editErrors.basePriceMonthly}</p>
                  )}
                </div>
              </div>

              {/* Kích thước & Gợi ý sức chứa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Kích thước quy chuẩn (D x R x C)
                  </label>
                  <input
                    type="text"
                    value={editForm.dimensions}
                    onChange={(e) => setEditForm({ ...editForm, dimensions: e.target.value })}
                    className="w-full duo-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                    Gợi ý sức chứa
                  </label>
                  <input
                    type="text"
                    value={editForm.suggestedCapacity}
                    onChange={(e) => setEditForm({ ...editForm, suggestedCapacity: e.target.value })}
                    className="w-full duo-input"
                  />
                </div>
              </div>

              {/* Đặc điểm */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#777777] mb-1.5">
                  Đặc điểm nổi bật & Tiện ích đi kèm
                </label>
                <textarea
                  rows="3"
                  value={editForm.features}
                  onChange={(e) => setEditForm({ ...editForm, features: e.target.value })}
                  className="w-full duo-input"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t-2 border-[#E5E5E5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="duo-btn-gray px-5 py-3 text-xs"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="duo-btn-blue px-6 py-3 text-xs"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL: ĐỔI TRẠNG THÁI ACTIVE / INACTIVE (PR-M4)
      ───────────────────────────────────────────────────────────── */}
      {statusModalOpen && activeUnitType && (
        <div className="fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="duo-card w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 shrink-0 ${
                  activeUnitType.status === 'ACTIVE'
                    ? 'bg-[#FFF4E5] border-[#FFD8A8] text-[#FF9600]'
                    : 'bg-[#D7FFB8] border-[#58CC02] text-[#58CC02]'
                }`}
              >
                <span className="material-symbols-outlined text-[28px]">
                  {activeUnitType.status === 'ACTIVE' ? 'pause_circle' : 'play_circle'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">
                  {activeUnitType.status === 'ACTIVE'
                    ? 'Tạm ngưng loại kho?'
                    : 'Kích hoạt lại loại kho?'}
                </h3>
                <p className="text-xs font-bold text-[#777777]">
                  Loại kho: <strong>{activeUnitType.name}</strong>
                </p>
              </div>
            </div>

            <div className="text-xs font-bold text-[#777777] bg-[#F7F7F7] p-4 rounded-2xl border border-[#E5E5E5] space-y-2">
              {activeUnitType.status === 'ACTIVE' ? (
                <>
                  <p className="text-[#E65100] font-black uppercase tracking-wider text-[11px]">
                    Khi chuyển sang Tạm ngưng:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[#4B4B4B]">
                    <li>Ẩn khỏi trang tìm kiếm và đặt chỗ của khách hàng.</li>
                    <li>Quản lý cơ sở không thể thêm ô kho mới thuộc loại này.</li>
                    <li>Các hợp đồng đang chạy và việc gia hạn vẫn diễn ra bình thường.</li>
                  </ul>
                </>
              ) : (
                <p className="text-[#2E7D32]">
                  Loại kho sẽ hiển thị trở lại trên danh mục tìm kiếm & đặt chỗ toàn hệ thống.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleToggleStatus}
                className={
                  activeUnitType.status === 'ACTIVE'
                    ? 'duo-btn-orange px-5 py-2.5 text-xs'
                    : 'duo-btn-green px-5 py-2.5 text-xs'
                }
              >
                {submitting
                  ? 'Đang xử lý...'
                  : activeUnitType.status === 'ACTIVE'
                  ? 'Xác nhận tạm ngưng'
                  : 'Xác nhận kích hoạt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODAL: XÓA LOẠI KHO (PR-M4)
      ───────────────────────────────────────────────────────────── */}
      {deleteModalOpen && activeUnitType && (
        <div className="fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="duo-card w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFDFE0] border-2 border-[#FF4B4B] flex items-center justify-center text-[#FF4B4B] shrink-0">
                <span className="material-symbols-outlined text-[28px]">
                  {activeUnitType.canDelete ? 'delete_forever' : 'block'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">
                  {activeUnitType.canDelete ? 'Xóa loại kho vĩnh viễn?' : 'Không thể xóa loại kho!'}
                </h3>
                <p className="text-xs font-bold text-[#777777]">
                  Loại kho: <strong>{activeUnitType.name}</strong>
                </p>
              </div>
            </div>

            {!activeUnitType.canDelete ? (
              <div className="text-xs font-bold text-[#D32F2F] bg-[#FFF5F5] p-4 rounded-2xl border border-[#FFCCD0] space-y-2">
                <p className="font-black uppercase tracking-wider text-[11px] text-[#FF4B4B]">
                  Không thể xóa dữ liệu đã phát sinh:
                </p>
                <p className="text-[#4B4B4B] leading-relaxed">
                  Loại kho này đã từng được sử dụng để tạo ô kho trong hệ thống. Quy tắc hệ thống <strong>chỉ cho phép xóa loại kho chưa từng có ô kho</strong> nhằm đảm bảo toàn vẹn dữ liệu hợp đồng & lịch sử thuê.
                </p>
                <p className="text-[#777777]">
                  Bạn có thể chuyển trạng thái sang <strong>Tạm ngưng</strong> để ẩn loại kho khỏi khách hàng.
                </p>
              </div>
            ) : (
              <div className="text-xs font-bold text-[#777777] bg-[#F7F7F7] p-4 rounded-2xl border border-[#E5E5E5]">
                <p className="leading-relaxed">
                  Loại kho này chưa từng phát sinh bất kỳ ô kho hay đơn đặt chỗ nào trong hệ thống. Bạn có chắc chắn muốn xóa hoàn toàn khỏi danh mục không?
                </p>
                <p className="text-[#FF4B4B] mt-2 font-black">
                  Hành động này không thể hoàn tác!
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="duo-btn-gray px-4 py-2.5 text-xs"
              >
                Đóng
              </button>

              {!activeUnitType.canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    openStatusModal(activeUnitType);
                  }}
                  className="duo-btn-orange px-5 py-2.5 text-xs"
                >
                  Chuyển sang Tạm ngưng
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteSubmit}
                  className="duo-btn-red px-5 py-2.5 text-xs"
                >
                  {submitting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
