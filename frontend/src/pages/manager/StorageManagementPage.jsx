export default function StorageManagementPage() {
  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      <div className="flex flex-col w-full gap-6">

        {/* Top Section: Header & Live Metrics */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
              <span>Cơ sở Tân Bình</span>
              <span>/</span>
              <span>Mặt bằng</span>
              <span>/</span>
              <span className="text-[#58CC02]">Danh mục ô kho</span>
            </div>
            <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">
              Quản Lý Danh Mục Ô Kho
            </h1>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Tổng 120 khoang chứa tiêu chuẩn • Cập nhật tự động theo mã khoá SmartLock và hợp đồng
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="duo-card px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700]">
                <span className="material-symbols-outlined text-[22px]">door_sliding</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Tỉ lệ lấp đầy</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-[#4B4B4B]">88.3%</span>
                  <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border border-[#58CC02] text-[10px]">+2.4%</span>
                </div>
              </div>
            </div>

            <div className="duo-card px-4 py-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFDFDF] border-2 border-[#FF4B4B] flex items-center justify-center text-[#FF4B4B]">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Cần xử lý gấp</span>
                <span className="text-base font-black text-[#FF4B4B]">1 Quá hạn • 1 Lỗi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Action Bar Duolingo Card */}
        <div className="duo-card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button className="duo-btn-green px-4 py-2 text-xs" type="button">Tất cả (120)</button>
              <button className="duo-btn-gray px-4 py-2 text-xs" type="button">Tầng trệt (50)</button>
              <button className="duo-btn-gray px-4 py-2 text-xs" type="button">Tầng 1 (45)</button>
              <button className="duo-btn-gray px-4 py-2 text-xs" type="button">Tầng 2 (25)</button>
            </div>
            <div className="flex items-center gap-2.5">
              <button className="duo-btn-white px-4 py-2.5 text-xs" type="button">
                <span className="material-symbols-outlined text-[18px] mr-1">download</span>
                <span>XUẤT EXCEL</span>
              </button>
              <button className="duo-btn-green px-4 py-2.5 text-xs" type="button">
                <span className="material-symbols-outlined text-[18px] mr-1">add_box</span>
                <span>+ THÊM Ô KHO MỚI</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t-2 border-[#E5E5E5]">
            <div className="md:col-span-5 relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#AFAFAF]">search</span>
              <input className="duo-input w-full pl-10 text-xs" placeholder="Tìm kiếm mã ô kho, vị trí, khách thuê..." type="text"/>
            </div>
            <div className="md:col-span-3 relative">
              <select className="duo-input w-full text-xs cursor-pointer appearance-none">
                <option value="">Trạng thái: Tất cả</option>
                <option value="available">Còn trống (14)</option>
                <option value="reserved">Đã đặt chỗ (3)</option>
                <option value="occupied">Đang sử dụng (98)</option>
                <option value="maintenance">Bảo trì (4)</option>
                <option value="overdue">Quá hạn (1)</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#AFAFAF] pointer-events-none">expand_more</span>
            </div>
            <div className="md:col-span-3 relative">
              <select className="duo-input w-full text-xs cursor-pointer appearance-none">
                <option value="">Loại kho: Tất cả phân loại</option>
                <option value="mini">Kho Mini (2.0 - 3.5 m²)</option>
                <option value="standard">Kho Tiêu Chuẩn (4.0 - 8.0 m²)</option>
                <option value="large">Kho Lớn / Gia Đình (&gt; 10 m²)</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#AFAFAF] pointer-events-none">expand_more</span>
            </div>
            <div className="md:col-span-1 flex items-center justify-end">
              <button className="duo-btn-gray w-full h-full py-2.5 flex items-center justify-center text-xs" title="Đặt lại bộ lọc" type="button">
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              </button>
            </div>
          </div>
        </div>

        {/* High-Density Inventory Table Duolingo Card */}
        <div className="duo-card overflow-hidden">
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
                {/* Row 1 */}
                <tr className="hover:bg-[#FDFDFD] transition-colors">
                  <td className="px-5 py-3.5 font-black font-mono text-[#1CB0F6]">KV-TB-A101</td>
                  <td className="px-5 py-3.5">Kho Tiêu Chuẩn</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Tầng 1 • Dãy A</td>
                  <td className="px-5 py-3.5 text-right font-black">6.0 m²</td>
                  <td className="px-5 py-3.5 text-right font-black text-[#58CC02]">1.850.000₫</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="duo-badge bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]">
                      Còn trống
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">---</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Sẵn sàng giao</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="duo-btn-white px-3 py-1.5 text-[11px]" type="button">Khóa bảo trì</button>
                  </td>
                </tr>

                {/* Row 2 */}
                <tr className="hover:bg-[#FDFDFD] transition-colors">
                  <td className="px-5 py-3.5 font-black font-mono text-[#1CB0F6]">KV-TB-A102</td>
                  <td className="px-5 py-3.5">Kho Tiêu Chuẩn</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Tầng 1 • Dãy A</td>
                  <td className="px-5 py-3.5 text-right font-black">6.0 m²</td>
                  <td className="px-5 py-3.5 text-right font-black text-[#58CC02]">1.850.000₫</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]">
                      Đã đặt cọc
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-black text-[#4B4B4B]">Nguyễn Thu Trang</td>
                  <td className="px-5 py-3.5 text-[#1CB0F6]">Nhận: 01/11/2026</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="duo-btn-blue px-3 py-1.5 text-[11px]" type="button">Xem gán kho</button>
                  </td>
                </tr>

                {/* Row 3 */}
                <tr className="hover:bg-[#FDFDFD] transition-colors">
                  <td className="px-5 py-3.5 font-black font-mono text-[#1CB0F6]">KV-TB-B205</td>
                  <td className="px-5 py-3.5">Kho Gia Đình</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Tầng trệt • Khu B</td>
                  <td className="px-5 py-3.5 text-right font-black">12.0 m²</td>
                  <td className="px-5 py-3.5 text-right font-black text-[#58CC02]">3.450.000₫</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="duo-badge bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]">
                      Đang sử dụng
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-black text-[#4B4B4B]">Cty Hoàng Phát</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Đến 25/04/2027</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="duo-btn-white px-3 py-1.5 text-[11px]" type="button">Xem HĐ</button>
                  </td>
                </tr>

                {/* Row 4 */}
                <tr className="hover:bg-[#FDFDFD] transition-colors">
                  <td className="px-5 py-3.5 font-black font-mono text-[#1CB0F6]">KV-TB-C105</td>
                  <td className="px-5 py-3.5">Kho Mini</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Tầng 1 • Khu C</td>
                  <td className="px-5 py-3.5 text-right font-black">2.5 m²</td>
                  <td className="px-5 py-3.5 text-right font-black text-[#58CC02]">950.000₫</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="duo-badge bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]">
                      Bảo trì
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">---</td>
                  <td className="px-5 py-3.5 text-[#E58800]">Lỗi cảm biến IoT</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="duo-btn-orange px-3 py-1.5 text-[11px]" type="button">Mở lại kho</button>
                  </td>
                </tr>

                {/* Row 5 */}
                <tr className="hover:bg-[#FDFDFD] transition-colors">
                  <td className="px-5 py-3.5 font-black font-mono text-[#FF4B4B]">KV-TB-B102</td>
                  <td className="px-5 py-3.5">Kho Lớn</td>
                  <td className="px-5 py-3.5 text-[#AFAFAF]">Tầng trệt • Khu B</td>
                  <td className="px-5 py-3.5 text-right font-black">16.0 m²</td>
                  <td className="px-5 py-3.5 text-right font-black text-[#58CC02]">4.500.000₫</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="duo-badge bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]">
                      Quá hạn
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-black text-[#FF4B4B]">Trần Minh Quân</td>
                  <td className="px-5 py-3.5 text-[#FF4B4B]">Nợ cước 6 ngày</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="duo-btn-red px-3 py-1.5 text-[11px]" type="button">Khóa PIN</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-[#FAFAFA] border-t-2 border-[#E5E5E5] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-bold text-[#AFAFAF]">
              Hiển thị <span className="font-black text-[#4B4B4B]">1 - 5</span> trên tổng số <span className="font-black text-[#4B4B4B]">120</span> ô kho
            </div>
            <div className="flex items-center gap-1.5">
              <button className="duo-btn-gray w-8 h-8 rounded-xl text-xs flex items-center justify-center p-0" disabled type="button">
                ‹
              </button>
              <button className="duo-btn-green w-8 h-8 rounded-xl text-xs flex items-center justify-center p-0" type="button">1</button>
              <button className="duo-btn-white w-8 h-8 rounded-xl text-xs flex items-center justify-center p-0" type="button">2</button>
              <button className="duo-btn-white w-8 h-8 rounded-xl text-xs flex items-center justify-center p-0" type="button">3</button>
              <span className="px-1 text-[#AFAFAF] text-xs font-black">...</span>
              <button className="duo-btn-white w-8 h-8 rounded-xl text-xs flex items-center justify-center p-0" type="button">24</button>
              <button className="duo-btn-white w-8 h-8 rounded-xl text-xs flex items-center justify-center p-0" type="button">
                ›
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
