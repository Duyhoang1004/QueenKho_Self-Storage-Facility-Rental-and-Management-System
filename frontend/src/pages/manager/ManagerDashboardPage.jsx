import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFacilityDashboard, getAllFacilities } from '../../services/facilityService';

export default function ManagerDashboardPage() {
  const navigate = useNavigate();

  // Lấy thông tin user đăng nhập từ sessionStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(() => {
    try {
      const saved = sessionStorage.getItem('user');
      const user = saved ? JSON.parse(saved) : null;
      return user?.facilityId ? Number(user.facilityId) : 1;
    } catch (e) {
      return 1;
    }
  });

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capacityTab, setCapacityTab] = useState('zone'); // 'zone' | 'unittype'
  const [showReportModal, setShowReportModal] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Tải danh sách cơ sở nếu user là ADMIN/BOM có nhu cầu đổi cơ sở xem thử
  useEffect(() => {
    getAllFacilities()
      .then(res => setFacilities(res || []))
      .catch(() => {});
  }, []);

  // Hàm tải dữ liệu Dashboard từ backend
  const fetchDashboard = useCallback(async () => {
    if (!selectedFacilityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFacilityDashboard(selectedFacilityId);
      setDashboardData(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Lỗi tải dữ liệu dashboard:', err);
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu bảng điều khiển cơ sở.');
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const kpi = dashboardData?.kpi;
  const facility = dashboardData?.facility;
  const zoneCapacities = dashboardData?.zoneCapacities || [];
  const unitTypeCapacities = dashboardData?.unitTypeCapacities || [];
  const alerts = dashboardData?.alerts || [];

  // Xác định màu tiến trình lấp đầy
  const getProgressColor = (rate) => {
    if (rate >= 90) return 'bg-[#58CC02]';
    if (rate >= 75) return 'bg-[#1CB0F6]';
    if (rate >= 50) return 'bg-[#FF9600]';
    return 'bg-[#AFAFAF]';
  };

  return (
    <div className="max-w-[1240px] mx-auto px-6 py-8">
      <div className="flex flex-col w-full gap-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
              <span>QueenKho</span>
              <span>/</span>
              <span>{facility?.name || `Cơ sở #${selectedFacilityId}`}</span>
              <span>/</span>
              <span className="text-[#58CC02]">Bảng điều khiển</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
                Bảng Điều Khiển {facility?.name || 'Cơ Sở'}
              </h1>

              {/* Selector chuyển cơ sở — FM chỉ xem cơ sở được gán (PR-90, backend trả 403 nếu chọn cơ sở khác) */}
              {facilities.length > 1 && currentUser?.role !== 'FACILITY_MANAGER' && (
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(Number(e.target.value))}
                  className="text-xs font-bold bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-xl px-3 py-1.5 text-[#4B4B4B] focus:outline-none focus:border-[#1CB0F6]"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.city})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs font-bold text-[#AFAFAF]">
              {facility?.address ? `${facility.address} • Hotline: ${facility.hotline || '1900 6868'}` : 'Tổng quan năng lực vận hành, tình trạng lấp đầy khoang và sự vụ khẩn thời gian thực.'}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center flex-wrap">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#58CC02] animate-pulse"></span>
              <span className="text-xs font-black uppercase tracking-wider">
                Hệ thống trực tuyến • {lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <button 
              onClick={fetchDashboard} 
              disabled={loading}
              title="Làm mới số liệu realtime"
              className="duo-btn-white px-3.5 py-2 text-xs flex items-center gap-1.5"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
              <span>LÀM MỚI</span>
            </button>

            <button 
              onClick={() => setShowReportModal(true)}
              className="duo-btn-green px-4 py-2 text-xs tracking-wider flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">summarize</span>
              <span>BÁO CÁO NGÀY</span>
            </button>
          </div>
        </div>

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div className="p-4 rounded-2xl bg-[#FFF5F5] border-2 border-[#FF4B4B] text-[#FF4B4B] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
            <button 
              onClick={fetchDashboard}
              className="px-3 py-1 bg-[#FF4B4B] text-white text-xs font-black rounded-xl hover:opacity-90"
            >
              THỬ LẠI
            </button>
          </div>
        )}

        {/* 4 Duolingo 2.5D Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          
          {/* Card 1: Tổng số ô kho & Lấp đầy */}
          <div className="duo-card p-5 flex flex-col justify-between hover:border-[#58CC02] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Tổng số ô kho</span>
                <span className="text-3xl font-black text-[#4B4B4B] mt-1">
                  {loading ? '...' : (kpi?.totalUnits ?? 0)} <span className="text-sm text-[#AFAFAF]">ô</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#D7FFB8] border-2 border-b-4 border-[#58CC02] flex items-center justify-center text-[#58A700]">
                <span className="material-symbols-outlined text-[26px]">grid_4x4</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className="text-[#58CC02] font-black">
                Lấp đầy: {kpi ? `${kpi.occupancyRate}%` : '0%'}
              </span>
              <span className="text-[#AFAFAF]">
                {kpi?.occupiedUnits ?? 0} đang thuê
              </span>
            </div>
          </div>
          
          {/* Card 2: Ô kho còn trống */}
          <div 
            onClick={() => navigate('/manager/storage')}
            className="duo-card p-5 flex flex-col justify-between hover:border-[#1CB0F6] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Ô kho còn trống</span>
                <span className="text-3xl font-black text-[#1CB0F6] mt-1">
                  {loading ? '...' : String(kpi?.availableUnits ?? 0).padStart(2, '0')}{' '}
                  <span className="text-sm text-[#AFAFAF]">ô</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] flex items-center justify-center text-[#1CB0F6] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[26px]">door_open</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className="text-[#1CB0F6] font-black">Sẵn sàng nhận khách</span>
              <span className="text-[#AFAFAF]">
                {kpi?.maintenanceUnits ?? 0} ô bảo trì
              </span>
            </div>
          </div>
          
          {/* Card 3: Đơn cọc mới chờ duyệt & gán phòng */}
          <div 
            onClick={() => navigate('/manager/pending')}
            className="duo-card p-5 flex flex-col justify-between hover:border-[#FF9600] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Đơn chờ gán phòng</span>
                <span className="text-3xl font-black text-[#FF9600] mt-1">
                  {loading ? '...' : String(kpi?.pendingReservationsCount ?? 0).padStart(2, '0')}{' '}
                  <span className="text-sm text-[#AFAFAF]">đơn</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFE8CC] border-2 border-b-4 border-[#E58800] flex items-center justify-center text-[#E58800] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[26px]">assignment_add</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className="text-[#E58800] font-black">Khách đã cọc online</span>
              <span className="text-[#AFAFAF]">
                {(kpi?.pendingReservationsCount ?? 0) > 0 ? 'Cần duyệt ngay' : 'Đã sạch đơn'}
              </span>
            </div>
          </div>
          
          {/* Card 4: Hợp đồng quá hạn nợ phí */}
          <div 
            onClick={() => navigate('/manager/overdue')}
            className="duo-card p-5 flex flex-col justify-between hover:border-[#FF4B4B] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Hợp đồng quá hạn</span>
                <span className={`text-3xl font-black mt-1 ${(kpi?.overdueContractsCount ?? 0) > 0 ? 'text-[#FF4B4B]' : 'text-[#4B4B4B]'}`}>
                  {loading ? '...' : String(kpi?.overdueContractsCount ?? 0).padStart(2, '0')}{' '}
                  <span className="text-sm text-[#AFAFAF]">HĐ</span>
                </span>
              </div>
              <div className={`w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center group-hover:scale-105 transition-transform ${
                (kpi?.overdueContractsCount ?? 0) > 0 
                  ? 'bg-[#FFDFDF] border-[#FF4B4B] text-[#FF4B4B]' 
                  : 'bg-[#F0F0F0] border-[#D0D0D0] text-[#888888]'
              }`}>
                <span className="material-symbols-outlined text-[26px]">warning</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className={(kpi?.overdueContractsCount ?? 0) > 0 ? 'text-[#FF4B4B] font-black' : 'text-[#58CC02] font-black'}>
                {(kpi?.overdueContractsCount ?? 0) > 0 ? 'Khẩn cấp nợ phí' : 'Hoạt động ổn định'}
              </span>
              <span className="text-[#AFAFAF]">
                {kpi?.activeContractsCount ?? 0} HĐ đang thuê
              </span>
            </div>
          </div>

        </div>

        {/* 2 Cột chi tiết */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Cột trái: Tỷ lệ sử dụng mặt bằng theo Khu/Tầng hoặc Loại kho */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="duo-card overflow-hidden">
              <div className="px-6 py-4 bg-[#FAFAFA] border-b-2 border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-[#1CB0F6]">layers</span>
                  <h2 className="font-black text-sm uppercase tracking-wider text-[#4B4B4B]">
                    Công Suất & Tỷ Lệ Lấp Đầy
                  </h2>
                </div>
                
                {/* Switch Tab */}
                <div className="flex items-center bg-[#E5E5E5] p-1 rounded-xl gap-1">
                  <button
                    onClick={() => setCapacityTab('zone')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      capacityTab === 'zone' 
                        ? 'bg-white text-[#1CB0F6] shadow-sm' 
                        : 'text-[#777777] hover:text-[#4B4B4B]'
                    }`}
                  >
                    THEO KHU VỰC
                  </button>
                  <button
                    onClick={() => setCapacityTab('unittype')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      capacityTab === 'unittype' 
                        ? 'bg-white text-[#1CB0F6] shadow-sm' 
                        : 'text-[#777777] hover:text-[#4B4B4B]'
                    }`}
                  >
                    THEO LOẠI KHO
                  </button>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-6">
                {loading ? (
                  <div className="flex flex-col gap-4 py-8 items-center justify-center text-[#AFAFAF]">
                    <span className="material-symbols-outlined text-4xl animate-spin text-[#1CB0F6]">sync</span>
                    <span className="text-xs font-bold">Đang tải dữ liệu mặt bằng...</span>
                  </div>
                ) : capacityTab === 'zone' ? (
                  // Tab 1: Phân bổ theo Khu Vực / Tầng
                  zoneCapacities.length === 0 ? (
                    <p className="text-xs font-bold text-[#AFAFAF] text-center py-4">Chưa có dữ liệu phân khu.</p>
                  ) : (
                    zoneCapacities.map((zone) => (
                      <div key={zone.key} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-xl bg-[#1CB0F6] border-b border-[#1899D6] text-white flex items-center justify-center font-black text-xs">
                              {zone.key}
                            </span>
                            <div>
                              <span className="text-sm font-black text-[#4B4B4B]">{zone.name}</span>
                              <span className="text-xs font-bold text-[#AFAFAF] ml-2">({zone.description})</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-[#4B4B4B]">
                              {zone.occupiedUnits}
                            </span>
                            <span className="text-xs text-[#AFAFAF]"> / {zone.totalUnits} ô</span>
                            <span className="ml-2 duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[11px]">
                              {zone.occupancyRate}%
                            </span>
                          </div>
                        </div>

                        {/* Thanh Progress */}
                        <div className="w-full h-3.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(zone.occupancyRate)}`} 
                            style={{ width: `${Math.min(zone.occupancyRate, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-bold text-[#AFAFAF]">
                          <span>Trống: {zone.availableUnits} ô • Bảo trì: {zone.maintenanceUnits} ô</span>
                          <span className={zone.occupancyRate >= 90 ? 'text-[#58A700]' : 'text-[#1CB0F6]'}>
                            {zone.occupancyRate >= 90 ? 'Lấp đầy tối ưu' : 'Còn ô khả dụng'}
                          </span>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  // Tab 2: Phân bổ theo Loại Khoang
                  unitTypeCapacities.length === 0 ? (
                    <p className="text-xs font-bold text-[#AFAFAF] text-center py-4">Chưa có dữ liệu loại kho.</p>
                  ) : (
                    unitTypeCapacities.map((ut) => (
                      <div key={ut.unitTypeId} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-black text-[#4B4B4B]">{ut.unitTypeName}</span>
                            <span className="text-xs font-bold text-[#AFAFAF] ml-2">
                              ({ut.areaSqm} m² • {(Number(ut.basePriceMonthly) || 0).toLocaleString()} ₫/tháng)
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-[#4B4B4B]">{ut.occupiedUnits}</span>
                            <span className="text-xs text-[#AFAFAF]"> / {ut.totalUnits} ô</span>
                            <span className="ml-2 duo-badge bg-[#DDF4FF] text-[#1CB0F6] border border-[#1899D6] text-[11px]">
                              {ut.occupancyRate}%
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-3.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(ut.occupancyRate)}`} 
                            style={{ width: `${Math.min(ut.occupancyRate, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-bold text-[#AFAFAF]">
                          <span>Sẵn sàng: {ut.availableUnits} ô trống</span>
                          <span className="text-[#58A700]">Tỉ lệ: {ut.occupancyRate}%</span>
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* Hạ tầng an ninh card */}
                <div className="duo-card p-4 flex items-center justify-between gap-4 bg-[#FAFAFA]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700] shrink-0">
                      <span className="material-symbols-outlined text-[24px]">verified_user</span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#4B4B4B]">Hạ tầng an ninh & SmartLock IoT</p>
                      <p className="text-[11px] font-bold text-[#AFAFAF]">Cảm biến nhiệt/ẩm, Khóa mã PIN SmartLock & Camera 100% Online</p>
                    </div>
                  </div>
                  <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
                    AN TOÀN
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Cảnh Báo & Xử Lý Khẩn */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="duo-card overflow-hidden">
              <div className="px-6 py-4 bg-[#FAFAFA] border-b-2 border-[#E5E5E5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-[#FF9600]">warning</span>
                  <h2 className="font-black text-sm uppercase tracking-wider text-[#4B4B4B]">
                    Cảnh Báo & Xử Lý Khẩn
                  </h2>
                </div>
                <span className="duo-badge bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]">
                  {alerts.length} việc cần xử lý
                </span>
              </div>
              
              <div className="p-5 flex flex-col gap-4">
                {loading ? (
                  <div className="py-6 text-center text-xs font-bold text-[#AFAFAF]">
                    Đang quét danh sách sự vụ...
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-[#F8FFF4] border-2 border-[#58CC02] text-[#58A700] flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                    <span className="text-xs font-black">Tuyệt vời! Cơ sở hoạt động ổn định</span>
                    <span className="text-[11px] text-[#AFAFAF]">Không có đơn tồn đọng hoặc hợp đồng nợ phí quá hạn.</span>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const isCritical = alert.type === 'CRITICAL';
                    const isWarning = alert.type === 'WARNING';

                    return (
                      <div 
                        key={alert.id}
                        className={`duo-card p-4 border-2 border-b-4 ${
                          isCritical 
                            ? 'border-[#FF4B4B] bg-[#FFF5F5]' 
                            : isWarning 
                              ? 'border-[#FF9600] bg-[#FFFBF5]' 
                              : 'border-[#1CB0F6] bg-[#F5FBFF]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isCritical ? 'bg-[#FF4B4B]' : isWarning ? 'bg-[#FF9600]' : 'bg-[#1CB0F6]'
                            }`}></span>
                            <span className="text-xs font-black text-[#4B4B4B]">{alert.title}</span>
                          </div>
                          <span className={`duo-badge text-[10px] ${
                            isCritical 
                              ? 'bg-[#FFDFDF] text-[#FF4B4B] border border-[#FF4B4B]' 
                              : isWarning 
                                ? 'bg-[#FFE8CC] text-[#E58800] border border-[#FF9600]' 
                                : 'bg-[#DDF4FF] text-[#1CB0F6] border border-[#1CB0F6]'
                          }`}>
                            {isCritical ? '🔴 Khẩn cấp' : isWarning ? '🟠 Cảnh báo' : '🔵 Thông tin'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#AFAFAF] mt-1 leading-relaxed">
                          {alert.message}
                        </p>
                        <div className="pt-2 mt-2 flex items-center justify-between border-t-2 border-[#E5E5E5]">
                          <span className="text-[11px] font-bold text-[#AFAFAF]">{alert.timeAgo}</span>
                          <button 
                            onClick={() => alert.actionUrl && navigate(alert.actionUrl)}
                            className={`px-3 py-1.5 text-[11px] font-black rounded-xl border-b-2 active:translate-y-0.5 transition-all ${
                              isCritical 
                                ? 'duo-btn-red' 
                                : isWarning 
                                  ? 'duo-btn-green' 
                                  : 'duo-btn-blue'
                            }`}
                          >
                            {alert.actionText || 'XỬ LÝ'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Thông điệp ca trực Duolingo Green Card */}
            <div className="duo-card p-5 bg-[#58CC02] border-2 border-b-4 border-[#58A700] text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-100">Thông điệp ca trực</span>
                <span className="material-symbols-outlined text-[22px]">campaign</span>
              </div>
              <p className="text-xs font-bold leading-relaxed text-emerald-50">
                Tuân thủ quy trình kiểm tra an toàn PCCC định kỳ ca sáng và chiều. Hướng dẫn khách thuê mới đổi mã PIN bảo mật cá nhân ngay trong lần đầu check-in nhận phòng.
              </p>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/20 text-[11px] font-bold text-emerald-100">
                <span>Quản lý: {currentUser?.fullName || 'Trần Văn Dũng'}</span>
                <span>{lastRefreshed.toLocaleDateString('vi-VN')}</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Modal Báo Cáo Ngày / Xuất Tổng Kết (UC-30 Quick Report) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border-4 border-[#E5E5E5] flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#E5E5E5]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#58CC02] text-2xl">summarize</span>
                <h3 className="text-lg font-black text-[#4B4B4B]">Báo Cáo Hoạt Động Cơ Sở Trong Ngày</h3>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 rounded-full bg-[#F7F7F7] hover:bg-[#E5E5E5] flex items-center justify-center text-[#777777]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs font-bold text-[#4B4B4B]">
              <div className="p-3 rounded-2xl bg-[#F7F7F7] flex flex-col gap-1">
                <span className="text-[#AFAFAF] uppercase text-[10px] font-black">Cơ sở vận hành:</span>
                <span className="text-sm font-black text-[#1CB0F6]">{facility?.name}</span>
                <span className="text-[11px] text-[#AFAFAF]">{facility?.address}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-[#F0FFF0] border border-[#58CC02]">
                  <span className="text-[10px] uppercase text-[#58A700] font-black">Tổng sức chứa:</span>
                  <p className="text-xl font-black text-[#58A700] mt-1">{kpi?.totalUnits} ô</p>
                  <p className="text-[11px] text-[#58A700]">Tỷ lệ lấp đầy: {kpi?.occupancyRate}%</p>
                </div>
                <div className="p-3 rounded-2xl bg-[#F5FBFF] border border-[#1CB0F6]">
                  <span className="text-[10px] uppercase text-[#1CB0F6] font-black">Khả dụng:</span>
                  <p className="text-xl font-black text-[#1CB0F6] mt-1">{kpi?.availableUnits} ô</p>
                  <p className="text-[11px] text-[#1CB0F6]">Đang thuê: {kpi?.occupiedUnits} ô</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#FFF9F0] border border-[#FF9600] flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>Đơn đặt cọc chờ gán:</span>
                  <span className="font-black text-[#FF9600]">{kpi?.pendingReservationsCount} đơn</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Hợp đồng quá hạn nợ phí:</span>
                  <span className="font-black text-[#FF4B4B]">{kpi?.overdueContractsCount} hợp đồng</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Số ô kho bảo trì / vệ sinh:</span>
                  <span className="font-black text-[#777777]">{kpi?.maintenanceUnits} ô</span>
                </div>
              </div>

              <p className="text-[11px] text-[#AFAFAF] italic text-center">
                Số liệu được chốt lúc: {new Date().toLocaleString('vi-VN')}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#E5E5E5]">
              <button 
                onClick={() => window.print()}
                className="duo-btn-white px-4 py-2 text-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>IN BÁO CÁO</span>
              </button>
              <button 
                onClick={() => setShowReportModal(false)}
                className="duo-btn-green px-5 py-2 text-xs"
              >
                ĐÃ HIỂU
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
