export default function ManagerDashboardPage() {
  return (
    <div className="max-w-content-max-width mx-auto px-gutter py-space-lg">
      <div className="flex flex-col w-full gap-space-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <span>Cơ sở Tân Bình</span>
              <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
              <span>Vận hành</span>
              <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
              <span className="text-secondary font-label-md text-label-md">Bảng điều khiển cơ sở</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-primary tracking-tight">Bảng Điều Khiển Quản Trị Cơ Sở Tân Bình</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Tổng quan sức chứa, mặt bằng lưu trữ, đơn đặt chỗ chờ duyệt và cảnh báo ca trực theo thời gian thực.</p>
          </div>
          <div className="flex items-center gap-space-sm self-start md:self-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 shadow-sm" style={{ backgroundColor: 'rgb(220, 252, 231)', border: '1px solid rgb(134, 239, 172)', color: 'rgb(21, 128, 61)' }}>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-label-md text-label-md font-semibold">Đang trực ca: 08:00 - 17:00</span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest text-on-surface font-label-lg text-label-lg rounded-lg shadow-sm hover:bg-surface-container transition-all" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)', color: 'rgb(31, 41, 55)' }}>
              <span className="material-symbols-outlined text-[18px]">summarize</span>
              <span>Báo cáo ngày</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Tổng số ô kho</span>
                <span className="font-display-lg text-display-lg text-primary mt-1">120 <span className="font-title-md text-title-md font-normal text-on-surface-variant">ô</span></span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[26px]">grid_4x4</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between font-label-sm text-label-sm bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl" style={{ backgroundColor: 'rgb(248, 250, 252)', borderTop: '1px solid rgb(226, 232, 240)' }}>
              <span className="text-on-surface font-semibold">Tỷ lệ lấp đầy: 91.6%</span>
              <span className="text-on-surface-variant">110 đang thuê</span>
            </div>
          </div>
          
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Ô kho còn trống</span>
                <span className="font-display-lg text-display-lg text-emerald-700 mt-1">07 <span className="font-title-md text-title-md font-normal text-on-surface-variant">ô</span></span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-[26px]">door_open</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between font-label-sm text-label-sm bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl" style={{ backgroundColor: 'rgb(248, 250, 252)', borderTop: '1px solid rgb(226, 232, 240)' }}>
              <span className="text-emerald-700 font-semibold">Sẵn sàng nhận khách</span>
              <span className="text-amber-700">3 ô bảo trì kỹ thuật</span>
            </div>
          </div>
          
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Đơn chờ gán phòng</span>
                <span className="font-display-lg text-display-lg text-amber-700 mt-1">03 <span className="font-title-md text-title-md font-normal text-on-surface-variant">đơn</span></span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                <span className="material-symbols-outlined text-[26px]">assignment_add</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between font-label-sm text-label-sm bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl" style={{ backgroundColor: 'rgb(248, 250, 252)', borderTop: '1px solid rgb(226, 232, 240)' }}>
              <span className="text-amber-700 font-semibold">Khách đã cọc online</span>
              <span className="text-on-surface-variant font-code-md text-code-md">Cần duyệt ngay</span>
            </div>
          </div>
          
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Doanh thu tháng tại cơ sở</span>
                <span className="font-headline-lg text-headline-lg text-primary mt-1 font-bold">650.000.000₫</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">payments</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between font-label-sm text-label-sm bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl" style={{ backgroundColor: 'rgb(248, 250, 252)', borderTop: '1px solid rgb(226, 232, 240)' }}>
              <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                <span>+8.5% so kỳ trước</span>
              </div>
              <span className="text-on-surface-variant">Kế hoạch: 700M₫</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
              <div className="bg-surface-container-low/70 px-space-md py-3.5 flex items-center justify-between" style={{ backgroundColor: 'rgb(248, 250, 252)', borderBottom: '1px solid rgb(226, 232, 240)' }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">layers</span>
                  <h2 className="font-title-md text-title-md text-on-surface">Sơ Đồ &amp; Tỷ Lệ Sử Dụng Mặt Bằng Theo Tầng</h2>
                </div>
                <span className="bg-primary/10 text-primary text-label-sm font-label-sm px-2.5 py-0.5 rounded-full font-semibold">Cập nhật 5 phút trước</span>
              </div>
              <div className="p-space-lg flex flex-col gap-space-lg">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-primary text-on-primary font-code-md text-code-md flex items-center justify-center font-bold">G</span>
                      <div>
                        <span className="font-label-lg text-label-lg text-on-surface font-semibold">Tầng Trệt</span>
                        <span className="text-on-surface-variant font-body-sm text-body-sm ml-2">(Kho tự quản lớn &amp; Thương mại)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-title-md text-title-md text-primary font-bold">48</span>
                      <span className="text-on-surface-variant font-body-sm text-body-sm">/ 50 ô</span>
                      <span className="ml-2 font-label-md text-label-md px-2 py-0.5 rounded bg-primary-container text-on-primary">96%</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-primary-container rounded-full" style={{ width: '96%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant">
                    <span>Trống: 02 ô (DT: 20m² - 45m²)</span>
                    <span>Đang hoạt động ổn định</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-secondary text-on-secondary font-code-md text-code-md flex items-center justify-center font-bold">1</span>
                      <div>
                        <span className="font-label-lg text-label-lg text-on-surface font-semibold">Tầng 1</span>
                        <span className="text-on-surface-variant font-body-sm text-body-sm ml-2">(Kho tiêu chuẩn &amp; Kho mát kiểm soát ẩm)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-title-md text-title-md text-secondary font-bold">42</span>
                      <span className="text-on-surface-variant font-body-sm text-body-sm">/ 45 ô</span>
                      <span className="ml-2 font-label-md text-label-md px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed">93%</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full" style={{ width: '93.3%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant">
                    <span>Trống: 0 ô • Bảo trì cách ly: 03 ô</span>
                    <span className="text-amber-700 font-medium">Độ ẩm trung bình: 52% (Chuẩn)</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-sky-600 text-white font-code-md text-code-md flex items-center justify-center font-bold">2</span>
                      <div>
                        <span className="font-label-lg text-label-lg text-on-surface font-semibold">Tầng 2</span>
                        <span className="text-on-surface-variant font-body-sm text-body-sm ml-2">(Kho mini compact cá nhân)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-title-md text-title-md text-sky-700 font-bold">20</span>
                      <span className="text-on-surface-variant font-body-sm text-body-sm">/ 25 ô</span>
                      <span className="ml-2 font-label-md text-label-md px-2 py-0.5 rounded bg-sky-100 text-sky-800">80%</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant">
                    <span>Trống: 05 ô (Dung tích 2m³ - 6m³)</span>
                    <span>Khách thuê cá nhân dài hạn</span>
                  </div>
                </div>

                <div className="p-space-md rounded-xl flex items-center justify-between gap-4" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
                      <span className="material-symbols-outlined text-[22px]">verified_user</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-lg text-label-lg font-bold" style={{ color: '#1F2937' }}>Hạ tầng an ninh &amp; Kỹ thuật vận hành</span>
                      <span className="font-body-sm text-body-sm" style={{ color: '#64748B' }}>Cảm biến PCCC, kiểm soát mã khóa và camera 360° hoạt động 100%</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold whitespace-nowrap" style={{ backgroundColor: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D' }}>AN TOÀN</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
              <div className="flex items-center gap-space-sm">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shrink-0">
                  <span className="material-symbols-outlined text-[24px]">map</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-title-md text-title-md text-primary">Xem ma trận mặt bằng trực quan</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Chuyển sang chế độ sơ đồ chi tiết từng khoang để kiểm tra trạng thái khóa.</span>
                </div>
              </div>
              <button className="px-5 py-2.5 bg-primary-container text-on-primary font-label-lg text-label-lg rounded-lg shadow-sm hover:bg-primary transition-all whitespace-nowrap">
                Mở Sơ Đồ Cơ Sở
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
              <div className="bg-surface-container-low/70 px-space-md py-3.5 flex items-center justify-between" style={{ backgroundColor: 'rgb(248, 250, 252)', borderBottom: '1px solid rgb(226, 232, 240)' }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-amber-700">warning</span>
                  <h2 className="font-title-md text-title-md text-on-surface">Cảnh Báo &amp; Việc Cần Xử Lý Khẩn Cấp</h2>
                </div>
                <span className="font-label-sm text-label-sm bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-bold">03 việc</span>
              </div>
              
              <div className="p-space-md flex flex-col gap-space-md">
                <div className="p-space-md rounded-xl shadow-sm flex flex-col gap-space-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(252, 211, 77)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0"></span>
                      <span className="font-label-lg text-label-lg font-bold" style={{ color: '#1F2937' }}>03 Đơn cọc mới chờ gán số phòng</span>
                    </div>
                    <span className="font-code-md text-code-md px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', color: '#B45309' }}>Ưu tiên cao</span>
                  </div>
                  <p className="font-body-sm text-body-sm" style={{ color: '#64748B' }}>Khách thanh toán cọc giữ chỗ qua cổng VNPAY. Cần thẩm định nhu cầu lưu trữ và xếp khoang thực tế.</p>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="font-label-sm text-label-sm" style={{ color: '#64748B' }}>Thời gian tạo: 15 phút trước</span>
                    <button className="px-4 py-1.5 bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:bg-primary transition-all flex items-center gap-1">
                      <span>Xử lý ngay</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                <div className="p-space-md rounded-xl shadow-sm flex flex-col gap-space-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(252, 165, 165)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0"></span>
                      <span className="font-label-lg text-label-lg font-bold" style={{ color: '#1F2937' }}>02 Hợp đồng quá hạn &gt; 5 ngày</span>
                    </div>
                    <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C' }}>Mã PIN đã khóa</span>
                  </div>
                  <div className="font-body-sm text-body-sm flex flex-col gap-1" style={{ color: '#64748B' }}>
                    <span style={{ color: '#1F2937', fontWeight: 500 }}>• HĐ #KV-8921 (Khoang B-204) - Nợ 12 ngày (14.200.000₫)</span>
                    <span style={{ color: '#1F2937', fontWeight: 500 }}>• HĐ #KV-9034 (Khoang A-102) - Nợ 06 ngày (6.500.000₫)</span>
                  </div>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="font-label-sm text-label-sm" style={{ color: '#64748B' }}>Đã gửi SMS nhắc lần 3</span>
                    <button className="px-3.5 py-1.5 font-label-md text-label-md rounded-lg shadow-sm transition-all" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C' }}>Đối soát nợ</button>
                  </div>
                </div>

                <div className="p-space-md rounded-xl shadow-sm flex flex-col gap-space-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '1px solid rgb(203, 213, 225)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0"></span>
                      <span className="font-label-lg text-label-lg font-bold" style={{ color: '#1F2937' }}>Khoang A-108: Lỗi cảm biến nhiệt</span>
                    </div>
                    <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', color: '#4B5563' }}>Kỹ thuật</span>
                  </div>
                  <p className="font-body-sm text-body-sm" style={{ color: '#64748B' }}>Tín hiệu IoT ngắt quãng từ 06:20 sáng nay. Đã ngắt điện thứ cấp buồng để kiểm tra dây tín hiệu.</p>
                  <div className="pt-2 flex items-center justify-between text-label-sm border-t border-slate-100" style={{ color: '#64748B' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">engineering</span>
                      <span>Phân công: <strong style={{ color: '#1F2937' }}>KTV Vũ Quốc Hùng</strong></span>
                    </div>
                    <span className="text-secondary font-semibold cursor-pointer hover:underline">Chi tiết lỗi</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary-container text-on-primary rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm relative overflow-hidden" style={{ border: '1px solid rgb(203, 213, 225)' }}>
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Thông điệp ca trực hôm nay</span>
                <span className="material-symbols-outlined text-primary-fixed-dim text-[20px]">campaign</span>
              </div>
              <p className="font-body-md text-body-md text-surface-container-lowest font-medium leading-snug">
                Kiểm tra đột xuất lối thoát hiểm cửa phía Tây lúc 14:30. Đảm bảo toàn bộ xe tải xuất nhập hàng xếp gọn gàng theo vạch chỉ định tại sân bãi Tân Bình.
              </p>
              <div className="flex items-center justify-between pt-2">
                <span className="font-label-sm text-label-sm text-primary-fixed-dim">Người lập: Quản lý Trần Văn Dũng</span>
                <span className="font-code-md text-code-md text-primary-fixed">08:00 - 15/10</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
