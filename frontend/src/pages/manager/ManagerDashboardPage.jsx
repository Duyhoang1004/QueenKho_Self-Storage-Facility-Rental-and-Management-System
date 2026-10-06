export default function ManagerDashboardPage() {
  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      <div className="flex flex-col w-full gap-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
              <span>Cơ sở Tân Bình</span>
              <span>/</span>
              <span>Vận hành</span>
              <span>/</span>
              <span className="text-[#58CC02]">Bảng điều khiển</span>
            </div>
            <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
              Bảng Điều Khiển Cơ Sở Tân Bình
            </h1>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Tổng quan sức chứa, mặt bằng lưu trữ, đơn đặt chỗ chờ duyệt và cảnh báo an ninh thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#58CC02] animate-pulse"></span>
              <span className="text-xs font-black uppercase tracking-wider">Đang trực ca: 08:00 - 17:00</span>
            </div>
            <button className="duo-btn-white px-4 py-2.5 text-xs tracking-wider">
              <span className="material-symbols-outlined text-[18px] mr-1">summarize</span>
              <span>BÁO CÁO NGÀY</span>
            </button>
          </div>
        </div>

        {/* 4 Duolingo 2.5D Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="duo-card p-5 flex flex-col justify-between hover:border-[#58CC02] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Tổng số ô kho</span>
                <span className="text-3xl font-black text-[#4B4B4B] mt-1">120 <span className="text-sm text-[#AFAFAF]">ô</span></span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#D7FFB8] border-2 border-b-4 border-[#58CC02] flex items-center justify-center text-[#58A700]">
                <span className="material-symbols-outlined text-[26px]">grid_4x4</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className="text-[#58CC02] font-black">Lấp đầy: 91.6%</span>
              <span className="text-[#AFAFAF]">110 đang thuê</span>
            </div>
          </div>
          
          <div className="duo-card p-5 flex flex-col justify-between hover:border-[#1CB0F6] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Ô kho còn trống</span>
                <span className="text-3xl font-black text-[#1CB0F6] mt-1">07 <span className="text-sm text-[#AFAFAF]">ô</span></span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] flex items-center justify-center text-[#1CB0F6]">
                <span className="material-symbols-outlined text-[26px]">door_open</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className="text-[#1CB0F6] font-black">Sẵn sàng nhận khách</span>
              <span className="text-[#AFAFAF]">3 ô bảo trì</span>
            </div>
          </div>
          
          <div className="duo-card p-5 flex flex-col justify-between hover:border-[#FF9600] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Đơn chờ gán phòng</span>
                <span className="text-3xl font-black text-[#FF9600] mt-1">03 <span className="text-sm text-[#AFAFAF]">đơn</span></span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFE8CC] border-2 border-b-4 border-[#E58800] flex items-center justify-center text-[#E58800]">
                <span className="material-symbols-outlined text-[26px]">assignment_add</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <span className="text-[#E58800] font-black">Khách đã cọc online</span>
              <span className="text-[#AFAFAF]">Cần duyệt ngay</span>
            </div>
          </div>
          
          <div className="duo-card p-5 flex flex-col justify-between hover:border-[#58CC02] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-[#AFAFAF]">Doanh thu tháng</span>
                <span className="text-2xl font-black text-[#58CC02] mt-1">650M₫</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#D7FFB8] border-2 border-b-4 border-[#58CC02] text-[#58A700] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">payments</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold border-t-2 border-[#E5E5E5]">
              <div className="flex items-center gap-1 text-[#58A700] font-black">
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                <span>+8.5% so kỳ trước</span>
              </div>
              <span className="text-[#AFAFAF]">Mục tiêu: 700M₫</span>
            </div>
          </div>
        </div>

        {/* 2 Cột chi tiết */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Cột trái: Tỷ lệ sử dụng mặt bằng */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="duo-card overflow-hidden">
              <div className="px-6 py-4 bg-[#FAFAFA] border-b-2 border-[#E5E5E5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-[#1CB0F6]">layers</span>
                  <h2 className="font-black text-sm uppercase tracking-wider text-[#4B4B4B]">
                    Tỷ Lệ Lấp Đầy Theo Tầng
                  </h2>
                </div>
                <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]">
                  Cập nhật live
                </span>
              </div>

              <div className="p-6 flex flex-col gap-6">
                {/* Tầng trệt */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-[#58CC02] border-b border-[#58A700] text-white flex items-center justify-center font-black text-xs">G</span>
                      <div>
                        <span className="text-sm font-black text-[#4B4B4B]">Tầng Trệt</span>
                        <span className="text-xs font-bold text-[#AFAFAF] ml-2">(Kho lớn & Thương mại)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#58CC02]">48</span>
                      <span className="text-xs text-[#AFAFAF]"> / 50 ô</span>
                      <span className="ml-2 duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">96%</span>
                    </div>
                  </div>
                  <div className="w-full h-3.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#58CC02] rounded-full" style={{ width: '96%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#AFAFAF]">
                    <span>Trống: 02 ô (DT: 20m² - 45m²)</span>
                    <span className="text-[#58A700]">Hoạt động ổn định</span>
                  </div>
                </div>

                {/* Tầng 1 */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-[#58CC02] border-b border-[#58A700] text-white flex items-center justify-center font-black text-xs">1</span>
                      <div>
                        <span className="text-sm font-black text-[#4B4B4B]">Tầng 1</span>
                        <span className="text-xs font-bold text-[#AFAFAF] ml-2">(Kho tiêu chuẩn & Kho mát)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#58CC02]">42</span>
                      <span className="text-xs text-[#AFAFAF]"> / 45 ô</span>
                      <span className="ml-2 duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">93%</span>
                    </div>
                  </div>
                  <div className="w-full h-3.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#58CC02] rounded-full" style={{ width: '93.3%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#AFAFAF]">
                    <span>Trống: 0 ô • Bảo trì: 03 ô</span>
                    <span className="text-[#FF9600]">Độ ẩm: 52% (Chuẩn)</span>
                  </div>
                </div>

                {/* Tầng 2 */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-[#58CC02] border-b border-[#58A700] text-white flex items-center justify-center font-black text-xs">2</span>
                      <div>
                        <span className="text-sm font-black text-[#4B4B4B]">Tầng 2</span>
                        <span className="text-xs font-bold text-[#AFAFAF] ml-2">(Kho mini compact)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#58CC02]">20</span>
                      <span className="text-xs text-[#AFAFAF]"> / 25 ô</span>
                      <span className="ml-2 duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">80%</span>
                    </div>
                  </div>
                  <div className="w-full h-3.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#58CC02] rounded-full" style={{ width: '80%' }}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#AFAFAF]">
                    <span>Trống: 05 ô (Dung tích 2m³ - 6m³)</span>
                    <span className="text-[#58A700]">Khách thuê cá nhân</span>
                  </div>
                </div>


                {/* Hạ tầng an ninh card */}
                <div className="duo-card p-4 flex items-center justify-between gap-4 bg-[#FAFAFA]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700] shrink-0">
                      <span className="material-symbols-outlined text-[24px]">verified_user</span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#4B4B4B]">Hạ tầng an ninh & SmartLock</p>
                      <p className="text-[11px] font-bold text-[#AFAFAF]">Cảm biến PCCC, SmartLock IoT & Camera AI 100% Online</p>
                    </div>
                  </div>
                  <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
                    AN TOÀN
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Cảnh báo & Việc cần xử lý */}
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
                  03 việc
                </span>
              </div>
              
              <div className="p-5 flex flex-col gap-4">
                {/* Việc 1 — Cảnh báo (cam) */}
                <div className="duo-card p-4 border-2 border-b-4 border-[#FF9600] bg-[#FFFBF5]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF9600] shrink-0"></span>
                      <span className="text-xs font-black text-[#4B4B4B]">03 Đơn cọc mới chờ gán kho</span>
                    </div>
                    <span className="duo-badge bg-[#FFE8CC] text-[#E58800] border border-[#FF9600] text-[10px]">🟠 Cảnh báo</span>
                  </div>
                  <p className="text-xs font-bold text-[#AFAFAF] mt-1">Khách đã cọc thành công. Cần chỉ định ô kho vật lý.</p>
                  <div className="pt-2 mt-2 flex items-center justify-between border-t-2 border-[#E5E5E5]">
                    <span className="text-[11px] font-bold text-[#AFAFAF]">15 phút trước</span>
                    <button className="duo-btn-green px-3 py-1.5 text-[11px]">
                      XỬ LÝ NGAY
                    </button>
                  </div>
                </div>

                {/* Việc 2 — Khẩn cấp (đỏ) */}
                <div className="duo-card p-4 border-2 border-b-4 border-[#FF4B4B] bg-[#FFF5F5]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF4B4B] shrink-0"></span>
                      <span className="text-xs font-black text-[#4B4B4B]">02 Hợp đồng quá hạn nợ phí</span>
                    </div>
                    <span className="duo-badge bg-[#FFDFDF] text-[#FF4B4B] border border-[#FF4B4B] text-[10px]">🔴 Khẩn cấp</span>
                  </div>
                  <p className="text-xs font-bold text-[#AFAFAF] mt-1">Khoang B-204 nợ 12 ngày (14.2M₫) • Khoang A-102 nợ 6 ngày.</p>
                  <div className="pt-2 mt-2 flex items-center justify-between border-t-2 border-[#E5E5E5]">
                    <span className="text-[11px] font-bold text-[#AFAFAF]">Đã gửi SMS nhắc lần 3</span>
                    <button className="duo-btn-red px-3 py-1.5 text-[11px]">
                      ĐỐI SOÁT NỢ
                    </button>
                  </div>
                </div>

                {/* Việc 3 — Thông tin kỹ thuật (xanh dương) */}
                <div className="duo-card p-4 border-2 border-b-4 border-[#1CB0F6] bg-[#F5FBFF]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1CB0F6] shrink-0"></span>
                      <span className="text-xs font-black text-[#4B4B4B]">Khoang A-108: Cảm biến ẩm ngắt</span>
                    </div>
                    <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border border-[#1CB0F6] text-[10px]">🔵 Kỹ thuật</span>
                  </div>
                  <p className="text-xs font-bold text-[#AFAFAF] mt-1">Phân công KTV Vũ Quốc Hùng kiểm tra buồng đo.</p>
                  <div className="pt-2 mt-2 flex items-center justify-between border-t-2 border-[#E5E5E5]">
                    <span className="text-[11px] font-bold text-[#AFAFAF]">Hôm nay 06:20</span>
                    <button className="duo-btn-blue px-3 py-1.5 text-[11px]">
                      CHI TIẾT LỖI
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Thông điệp ca trực Duolingo Green Card */}
            <div className="duo-card p-5 bg-[#58CC02] border-2 border-b-4 border-[#58A700] text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-100">Thông điệp ca trực</span>
                <span className="material-symbols-outlined text-[22px]">campaign</span>
              </div>
              <p className="text-xs font-bold leading-relaxed text-emerald-50">
                Kiểm tra đột xuất lối thoát hiểm cửa phía Tây lúc 14:30. Đảm bảo toàn bộ xe tải xuất nhập hàng xếp gọn gàng theo vạch chỉ định tại sân bãi Tân Bình.
              </p>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/20 text-[11px] font-bold text-emerald-100">
                <span>Quản lý Trần Văn Dũng</span>
                <span>08:00 - 15/10</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
