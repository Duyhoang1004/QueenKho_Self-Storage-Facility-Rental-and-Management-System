import { useState } from 'react';

export default function AssignmentPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState({
    orderCode: '',
    clientName: '',
    phone: '',
    storageType: '',
    amount: '',
    targetDate: ''
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const openAssignModal = (orderCode, clientName, phone, storageType, amount, targetDate) => {
    setSelectedOrder({ orderCode, clientName, phone, storageType, amount, targetDate });
    setIsModalOpen(true);
  };

  const closeAssignModal = () => {
    setIsModalOpen(false);
  };

  const confirmAssignment = () => {
    closeAssignModal();
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4500);
  };

  const refreshQueue = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  };

  return (
    <div className="max-w-content-max-width mx-auto px-gutter py-space-lg">
      <div className="flex flex-col w-full">
        {/* Top Operational Alert / Processing Banner */}
        <div className="mb-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
          <div className="flex items-start gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[28px]">inventory_2</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider bg-secondary-fixed/50 px-2 py-0.5 rounded-full">Hàng đợi xử lý</span>
                <span className="text-outline text-label-sm">•</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Cập nhật theo thời gian thực (VietQR Auto-hook)</span>
              </div>
              <h1 className="font-display-lg text-display-lg text-primary tracking-tight mt-1">Duyệt Đơn Đặt Chỗ &amp; Gán Ô Kho Thực Tế</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">Khách hàng đã thanh toán cọc online. Quản lý lựa chọn số ô kho thực tế phù hợp để kích hoạt hợp đồng, cấp mã thẻ từ và gửi thông báo bàn giao.</p>
            </div>
          </div>
          <div className="flex items-center gap-space-md shrink-0 self-start md:self-center">
            <div className="bg-surface-container-low px-space-md py-space-xs rounded-xl flex items-center gap-space-sm text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[22px]">pending_actions</span>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Chờ gán kho</span>
                <span className="font-title-md text-title-md text-primary">03 đơn mới</span>
              </div>
            </div>
            <button className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg rounded-lg flex items-center gap-space-xs transition-colors" onClick={refreshQueue}>
              <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Metric Counters & Realtime Status Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md mb-space-lg">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Đơn cọc hôm nay</div>
              <div className="font-display-lg text-display-lg text-primary mt-1">14 <span className="font-body-sm text-body-sm text-tertiary-container font-semibold">+18%</span></div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tiền cọc giữ chỗ (Ngày)</div>
              <div className="font-display-lg text-display-lg text-primary mt-1">26.85<span className="text-title-lg font-title-lg"> tr ₫</span></div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Ô kho sẵn sàng (Trống)</div>
              <div className="font-display-lg text-display-lg text-tertiary mt-1">19 <span className="font-body-sm text-body-sm text-outline font-normal">/ 140 ô</span></div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/30 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[24px]">meeting_room</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tỷ lệ lấp đầy cơ sở</div>
              <div className="font-display-lg text-display-lg text-primary mt-1">86.4<span className="text-title-lg font-title-lg">%</span></div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[24px]">pie_chart</span>
            </div>
          </div>
        </div>

        {/* Main Management Panel & Data Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col mb-space-2xl" style={{ border: '1px solid rgb(203, 213, 225)', borderRadius: '0.75rem', boxShadow: 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px' }}>
          {/* Filter Bar Header */}
          <div className="bg-surface-container-low/70 px-space-lg py-space-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
            <div className="relative flex-1 max-w-lg">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
              <input className="w-full h-10 pl-10 pr-space-md bg-surface-container-lowest text-on-surface rounded-lg font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary transition-all" placeholder="Tìm theo mã cọc, tên khách, số điện thoại..." type="text" />
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="flex items-center bg-surface-container-lowest rounded-lg p-1">
                <button className="px-3 py-1.5 rounded text-label-sm font-label-sm bg-primary text-on-primary">Tất cả</button>
                <button className="px-3 py-1.5 rounded text-label-sm font-label-sm text-on-surface-variant hover:text-on-surface">Kho Tiêu chuẩn (6m²)</button>
                <button className="px-3 py-1.5 rounded text-label-sm font-label-sm text-on-surface-variant hover:text-on-surface">Kho Mini (2.5m²)</button>
                <button className="px-3 py-1.5 rounded text-label-sm font-label-sm text-on-surface-variant hover:text-on-surface">Kho Lớn (12m²)</button>
              </div>
              <button className="h-10 px-3 bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant font-label-md text-label-md rounded-lg flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                <span>Bộ lọc</span>
              </button>
              <button className="h-10 px-3 bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant font-label-md text-label-md rounded-lg flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Xuất danh sách</span>
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50 text-outline text-label-sm font-label-sm uppercase tracking-wider">
                  <th className="py-3.5 px-space-md">Mã đặt cọc</th>
                  <th className="py-3.5 px-space-md">Ngày cọc</th>
                  <th className="py-3.5 px-space-md">Tên khách hàng</th>
                  <th className="py-3.5 px-space-md">Số điện thoại</th>
                  <th className="py-3.5 px-space-md">Loại kho đã chọn</th>
                  <th className="py-3.5 px-space-md">Chu kỳ thuê</th>
                  <th className="py-3.5 px-space-md">Ngày hẹn nhận kho</th>
                  <th className="py-3.5 px-space-md">Tiền cọc đã thu</th>
                  <th className="py-3.5 px-space-md text-right pr-space-lg">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-body-md font-body-md text-on-surface">
                {/* Row 1 */}
                <tr style={{ backgroundColor: 'rgb(255, 255, 255)', borderBottom: '1px solid rgb(229, 231, 235)' }} className="transition-colors hover:bg-slate-50">
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                      <span className="font-code-md text-code-md font-semibold text-secondary">#DC-2024-8892</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle text-on-surface-variant font-code-md text-code-md">25/10/2024</td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-title-md text-label-sm">NT</div>
                      <div className="flex flex-col">
                        <span className="font-title-md text-body-md text-on-surface leading-snug">Nguyễn Thu Trang</span>
                        <span className="font-label-sm text-label-sm text-secondary">Khách mới • Cá nhân</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle font-code-md text-code-md text-on-surface">0908 123 456</td>
                  <td className="py-4 px-4 align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-label-md text-label-md" style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}>
                      <span className="material-symbols-outlined text-[16px]">grid_goldenratio</span>
                      Khoang Tiêu Chuẩn 6.0 m²
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle font-label-lg text-label-lg text-on-surface">Thuê 6 Tháng</td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-title-md text-body-md text-primary font-code-md text-code-md">01/11/2024</span>
                      <span className="text-label-sm font-label-sm text-error font-semibold">Sau 7 ngày</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-tertiary-container font-semibold">1.850.000₫</span>
                      <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-tertiary-container">check_circle</span>
                        Đã nhận VietQR
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle text-right pr-space-lg">
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg text-label-lg shadow-sm transition-all transform active:scale-95" 
                      onClick={() => openAssignModal('#DC-2024-8892', 'Nguyễn Thu Trang', '0908 123 456', 'Khoang Tiêu Chuẩn 6.0 m²', '1.850.000₫', '01/11/2024')}>
                      <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                      <span>Gán ô kho ngay</span>
                    </button>
                  </td>
                </tr>
                {/* Row 2 */}
                <tr style={{ backgroundColor: 'rgb(248, 250, 252)', borderBottom: '1px solid rgb(229, 231, 235)' }} className="transition-colors hover:bg-slate-100">
                  <td className="py-4 px-4 align-middle">
                    <span className="font-code-md text-code-md text-on-surface-variant font-medium">#DC-2024-8895</span>
                  </td>
                  <td className="py-4 px-4 align-middle text-on-surface-variant font-code-md text-code-md">25/10/2024</td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center font-title-md text-label-sm">LH</div>
                      <div className="flex flex-col">
                        <span className="font-title-md text-body-md text-on-surface leading-snug">Lê Hoàng Nam</span>
                        <span className="font-label-sm text-label-sm text-outline">Gia hạn định kỳ</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle font-code-md text-code-md text-on-surface">0912 345 678</td>
                  <td className="py-4 px-4 align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-label-md text-label-md" style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}>
                      <span className="material-symbols-outlined text-[16px]">crop_square</span>
                      Kho Mini 2.5 m²
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle font-label-lg text-label-lg text-on-surface">Thuê 1 Tháng</td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-title-md text-body-md text-on-surface font-code-md text-code-md">26/10/2024</span>
                      <span className="text-label-sm font-label-sm text-secondary font-semibold">Ngày mai</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface">950.000₫</span>
                      <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-tertiary-container">check_circle</span>
                        Đã nhận thẻ Napas
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle text-right pr-space-lg">
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg text-label-lg shadow-sm transition-all" 
                      onClick={() => openAssignModal('#DC-2024-8895', 'Lê Hoàng Nam', '0912 345 678', 'Kho Mini 2.5 m²', '950.000₫', '26/10/2024')}>
                      <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                      <span>Gán ô kho ngay</span>
                    </button>
                  </td>
                </tr>
                {/* Row 3 */}
                <tr style={{ backgroundColor: 'rgb(255, 255, 255)', borderBottom: '1px solid rgb(229, 231, 235)' }} className="transition-colors hover:bg-slate-50">
                  <td className="py-4 px-4 align-middle">
                    <span className="font-code-md text-code-md text-on-surface-variant font-medium">#DC-2024-8890</span>
                  </td>
                  <td className="py-4 px-4 align-middle text-on-surface-variant font-code-md text-code-md">24/10/2024</td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-title-md text-label-sm">AC</div>
                      <div className="flex flex-col">
                        <span className="font-title-md text-body-md text-on-surface leading-snug">Công ty TNHH Á Châu</span>
                        <span className="font-label-sm text-label-sm text-outline">Doanh nghiệp • Xuất hóa đơn VAT</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle font-code-md text-code-md text-on-surface">028 3822 9911</td>
                  <td className="py-4 px-4 align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-label-md text-label-md" style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}>
                      <span className="material-symbols-outlined text-[16px]">warehouse</span>
                      Kho Lớn 12.0 m²
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle font-label-lg text-label-lg text-on-surface">Thuê 12 Tháng</td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-title-md text-body-md text-on-surface font-code-md text-code-md">28/10/2024</span>
                      <span className="text-label-sm font-label-sm text-outline">Còn 3 ngày</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface">3.450.000₫</span>
                      <span className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-tertiary-container">check_circle</span>
                        Chuyển khoản VCB
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle text-right pr-space-lg">
                    <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-lg text-label-lg shadow-sm transition-all" 
                      onClick={() => openAssignModal('#DC-2024-8890', 'Công ty TNHH Á Châu', '028 3822 9911', 'Kho Lớn 12.0 m²', '3.450.000₫', '28/10/2024')}>
                      <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                      <span>Gán ô kho ngay</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Table Pagination Footer */}
          <div className="px-space-lg py-3.5 bg-surface-container-low/40 flex items-center justify-between">
            <div className="font-body-sm text-body-sm text-on-surface-variant">
              Hiển thị <span className="font-semibold text-on-surface">3</span> trên tổng số <span className="font-semibold text-on-surface">3</span> đơn đặt cọc trực tuyến cần duyệt
            </div>
            <div className="flex items-center gap-2">
              <button className="h-8 px-3 rounded bg-surface-container-highest/60 text-outline cursor-not-allowed font-label-sm text-label-sm" disabled>Trước</button>
              <button className="h-8 w-8 rounded bg-primary text-on-primary font-label-sm text-label-sm flex items-center justify-center">1</button>
              <button className="h-8 px-3 rounded bg-surface-container-highest/60 text-outline cursor-not-allowed font-label-sm text-label-sm" disabled>Sau</button>
            </div>
          </div>
        </div>

        {/* Facility Overview & Quick Floor Plan Status Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg mb-space-2xl">
          <div className="lg:col-span-2 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">map</span>
                  <span className="font-title-lg text-title-lg text-primary">Sơ đồ tình trạng kho theo tầng (Cơ sở Tân Bình)</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Tầng 1 (Khu A &amp; Khu B)</span>
              </div>
              <div className="grid grid-cols-6 gap-2 p-3 bg-surface-container-low rounded-xl">
                <div className="p-2 rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center justify-center text-center" style={{ border: '1px solid rgb(203, 213, 225)' }}>
                  <span className="font-code-md text-code-md font-bold text-on-surface">A-101</span>
                  <span className="text-label-sm font-label-sm text-outline">6.0 m²</span>
                  <span className="mt-1 px-1.5 py-0.5 rounded font-label-sm text-[10px] font-semibold" style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}>Trống</span>
                </div>
                <div className="p-2 rounded-lg text-on-secondary shadow-md flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgb(29, 78, 216)', border: '1px solid rgb(147, 197, 253)' }}>
                  <span className="font-code-md text-code-md font-bold">A-102</span>
                  <span className="text-label-sm font-label-sm text-secondary-fixed">6.0 m²</span>
                  <span className="mt-1 px-1.5 py-0.5 rounded font-label-sm text-[10px] font-bold" style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}>Đề xuất</span>
                </div>
                <div className="p-2 rounded-lg bg-surface-container-high/70 flex flex-col items-center justify-center text-center opacity-70">
                  <span className="font-code-md text-code-md font-bold text-on-surface-variant">A-103</span>
                  <span className="text-label-sm font-label-sm text-outline">6.0 m²</span>
                  <span className="mt-1 px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant font-label-sm text-[10px]">Đang thuê</span>
                </div>
                <div className="p-2 rounded-lg bg-surface-container-high/70 flex flex-col items-center justify-center text-center opacity-70">
                  <span className="font-code-md text-code-md font-bold text-on-surface-variant">A-104</span>
                  <span className="text-label-sm font-label-sm text-outline">6.0 m²</span>
                  <span className="mt-1 px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant font-label-sm text-[10px]">Đang thuê</span>
                </div>
                <div className="p-2 rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center justify-center text-center" style={{ border: '1px solid rgb(203, 213, 225)' }}>
                  <span className="font-code-md text-code-md font-bold text-on-surface">A-105</span>
                  <span className="text-label-sm font-label-sm text-outline">6.0 m²</span>
                  <span className="mt-1 px-1.5 py-0.5 rounded font-label-sm text-[10px] font-semibold" style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}>Trống</span>
                </div>
                <div className="p-2 rounded-lg bg-error-container/40 flex flex-col items-center justify-center text-center">
                  <span className="font-code-md text-code-md font-bold text-on-error-container">A-106</span>
                  <span className="text-label-sm font-label-sm text-outline">6.0 m²</span>
                  <span className="mt-1 px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[10px]">Bảo trì</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-space-lg pt-space-md text-label-sm font-label-sm text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-tertiary-fixed"></span>
                <span>Còn trống</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-secondary"></span>
                <span>Được ưu tiên chọn</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-surface-container-high"></span>
                <span>Đang sử dụng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-error-container"></span>
                <span>Bảo trì / Kiểm tra</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-space-sm text-primary">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
                <span className="font-title-lg text-title-lg">Quy chuẩn bàn giao kho</span>
              </div>
              <ul className="flex flex-col gap-space-sm font-body-sm text-body-sm text-on-surface-variant mt-3">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                  <span>Kiểm tra niêm phong khóa thông minh SmartLock trước khi kích hoạt mã PIN.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                  <span>Hệ thống tự động kích hoạt hợp đồng điện tử và gửi SMS kèm link xem mã QR cửa tự động.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                  <span>Bộ phận kỹ thuật viên tại cơ sở hỗ trợ check-in khi khách hàng đến nhận kho trực tiếp.</span>
                </li>
              </ul>
            </div>
            <div className="bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between mt-space-md">
              <span className="font-label-md text-label-md text-on-surface">Cần hỗ trợ đổi cơ sở?</span>
              <span className="font-code-md text-code-md text-secondary font-semibold cursor-pointer hover:underline">Xem sơ đồ cụm kho</span>
            </div>
          </div>
        </div>

        {/* ACTIVE MODAL OVERLAY: Phân Bổ Ô Kho Thực Tế */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/45 backdrop-blur-sm transition-opacity duration-200">
            <div className="bg-surface-container-lowest rounded-2xl w-full max-w-[620px] shadow-2xl flex flex-col overflow-hidden max-h-[921px]" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)', borderRadius: '1rem', color: 'rgb(31, 41, 55)' }}>
              {/* Modal Header */}
              <div className="bg-surface-container-low px-space-lg py-space-md flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <span className="material-symbols-outlined text-[24px]">key</span>
                  </div>
                  <div className="flex flex-col">
                    <h2 className="font-title-lg text-title-lg text-primary tracking-tight">Phân Bổ Ô Kho Thực Tế Cho Khách Hàng {selectedOrder.orderCode}</h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      Khách hàng: <span className="font-semibold text-on-surface">{selectedOrder.clientName}</span> • Yêu cầu: <span className="font-semibold text-secondary">{selectedOrder.storageType} (Tầng 1 hoặc Trệt)</span>
                    </p>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors" onClick={closeAssignModal}>
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-space-lg overflow-y-auto flex flex-col gap-space-lg">
                <div className="bg-surface-container-low p-space-md rounded-xl grid grid-cols-3 gap-space-sm text-left">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Mã đặt cọc</span>
                    <span className="font-code-md text-code-md text-primary font-bold">{selectedOrder.orderCode}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Tiền cọc đã thu</span>
                    <span className="font-title-md text-title-md text-tertiary-container font-semibold">{selectedOrder.amount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Hẹn nhận dự kiến</span>
                    <span className="font-code-md text-code-md text-on-surface font-semibold">{selectedOrder.targetDate}</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <label className="font-title-md text-title-md flex items-center gap-1.5" style={{ color: '#1F2937' }}>
                      <span>Chọn ô kho trống phù hợp để cấp quyền</span>
                      <span className="text-error">*</span>
                    </label>
                    <span className="font-label-sm text-label-sm font-semibold flex items-center gap-1" style={{ color: '#15803D' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#15803D' }}></span>
                      3 ô đang khả dụng
                    </span>
                  </div>
                  
                  {/* Unit Card 1 */}
                  <label className="relative flex items-center justify-between p-space-md rounded-xl cursor-pointer transition-all shadow-sm hover:bg-slate-50" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
                    <div className="flex items-center gap-space-md">
                      <input className="w-4 h-4 text-secondary focus:ring-secondary accent-secondary cursor-pointer" name="unit_select" type="radio" value="KV-TB-A101" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-code-md text-title-md font-bold text-on-surface">KV-TB-A101</span>
                          <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">6.0 m²</span>
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Tầng 1 - Khu A • Ngay sát thang máy vận chuyển hàng</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1" style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#15803D' }}></span>
                        Sẵn sàng
                      </span>
                    </div>
                  </label>
                  
                  {/* Unit Card 2 (ACTIVE RECOMMENDED) */}
                  <label className="relative flex items-center justify-between p-space-md rounded-xl cursor-pointer shadow-sm" style={{ backgroundColor: 'rgb(240, 247, 255)', border: '1.5px solid rgb(147, 197, 253)' }}>
                    <div className="flex items-center gap-space-md">
                      <input defaultChecked className="w-4 h-4 text-secondary focus:ring-secondary accent-secondary cursor-pointer" name="unit_select" type="radio" value="KV-TB-A102" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-code-md text-title-md font-bold text-secondary">KV-TB-A102</span>
                          <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold">6.0 m²</span>
                          <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold flex items-center gap-1" style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}>
                            <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                            Khuyên dùng gán ngay
                          </span>
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface mt-0.5">Tầng 1 - Khu A • Giữa dãy hành lang • Thông thoáng khí tươi</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold" style={{ color: '#1D4ED8', border: '1px solid #93C5FD', backgroundColor: '#DBEAFE' }}>
                        Đang chọn
                      </span>
                    </div>
                  </label>
                  
                  {/* Unit Card 3 */}
                  <label className="relative flex items-center justify-between p-space-md rounded-xl cursor-pointer transition-all shadow-sm hover:bg-slate-50" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
                    <div className="flex items-center gap-space-md">
                      <input className="w-4 h-4 text-secondary focus:ring-secondary accent-secondary cursor-pointer" name="unit_select" type="radio" value="KV-TB-A105" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-code-md text-title-md font-bold text-on-surface">KV-TB-A105</span>
                          <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">6.0 m²</span>
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Tầng 1 - Khu B • Cửa cuốn tự động tải trọng lớn</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1" style={{ color: '#15803D', border: '1px solid #86EFAC', backgroundColor: '#DCFCE7' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#15803D' }}></span>
                        Sẵn sàng
                      </span>
                    </div>
                  </label>
                </div>
                
                {/* Internal Notes & Smart Device Setup */}
                <div className="flex flex-col gap-space-xs">
                  <label className="font-title-md text-body-md text-primary flex items-center gap-1.5" htmlFor="assignNote">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit_note</span>
                    <span>Ghi chú bàn giao &amp; Kích hoạt thẻ bảo mật</span>
                  </label>
                  <div className="relative">
                    <textarea className="w-full p-space-sm bg-surface-container-lowest text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all" id="assignNote" rows="2" defaultValue="Đã vệ sinh sạch sẽ, mã thẻ từ & cảm biến SmartLock #RF-8821 đã sẵn sàng cấp phát."></textarea>
                  </div>
                  <p className="font-label-sm text-label-sm text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Nội dung này sẽ lưu vào lịch sử bàn giao cơ sở và biên bản điện tử gửi kèm.
                  </p>
                </div>
                
                {/* Automated Notification Confirmation Option */}
                <div className="flex items-center gap-space-sm p-3 bg-surface-container-low/70 rounded-xl">
                  <input defaultChecked className="w-4 h-4 text-secondary accent-secondary rounded cursor-pointer" id="autoNotify" type="checkbox" />
                  <label className="font-body-sm text-body-sm text-on-surface cursor-pointer select-none" htmlFor="autoNotify">
                    Tự động gửi tin nhắn SMS Brandname &amp; thông báo Zalo ZNS kèm mã QR mở khóa phòng lưu kho cho khách.
                  </label>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="bg-surface-container-low px-space-lg py-space-md flex items-center justify-between">
                <button className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg rounded-lg transition-colors" onClick={closeAssignModal} type="button">
                  Hủy bỏ
                </button>
                <button className="h-10 px-space-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg rounded-lg flex items-center gap-2 shadow-sm transition-all" onClick={confirmAssignment} type="button">
                  <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                  <span>Xác nhận gán phòng &amp; Gửi thông báo SMS/Zalo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Toast Notification */}
        <div className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 flex items-center gap-3 bg-primary text-on-primary px-space-lg py-space-md rounded-xl shadow-2xl ${showToast ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <div className="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container">
            <span className="material-symbols-outlined text-[20px]">check</span>
          </div>
          <div className="flex flex-col">
            <span className="font-title-md text-body-md font-semibold text-on-primary">Gán ô kho thành công!</span>
            <span className="font-body-sm text-label-sm text-surface-container-high">Đã kích hoạt hợp đồng &amp; gửi SMS mã cửa SmartLock đến khách.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
