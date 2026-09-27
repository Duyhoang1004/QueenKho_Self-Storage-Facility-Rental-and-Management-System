export default function StorageManagementPage() {
  return (
    <div className="max-w-content-max-width mx-auto px-gutter py-space-lg">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Top Section: Header & Live Metrics */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-1">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Cơ sở Tân Bình</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span>Quản lý mặt bằng</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary font-bold">Danh mục ô kho</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản Lý Danh Mục Ô Kho - Tân Bình</h1>
            <p className="text-sm text-slate-600">Tổng 120 khoang chứa tiêu chuẩn • Cập nhật tự động theo mã khoá SmartLock và hợp đồng hiện hữu</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-[20px]">door_sliding</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-500">Tỉ lệ lấp đầy</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-slate-900">88.3%</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+2.4%</span>
                </div>
              </div>
            </div>
            <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-300 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-500">Cần xử lý gấp</span>
                <span className="text-base font-bold text-rose-600">1 Quá hạn • 1 Lỗi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Action & Filter Control Bar */}
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg border border-slate-300">
              <button className="px-3.5 py-1.5 rounded-md bg-primary text-white font-semibold text-xs transition-all shadow-sm" type="button">Tất cả (120)</button>
              <button className="px-3.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium text-xs transition-all" type="button">Tầng trệt (50)</button>
              <button className="px-3.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium text-xs transition-all" type="button">Tầng 1 (45)</button>
              <button className="px-3.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium text-xs transition-all" type="button">Tầng 2 (25)</button>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors" type="button">
                <span className="material-symbols-outlined text-[18px] text-slate-600">download</span>
                <span>Xuất Excel sơ đồ kho</span>
              </button>
              <button className="h-9 px-3.5 rounded-lg bg-primary hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all" type="button">
                <span className="material-symbols-outlined text-[18px]">add_box</span>
                <span>+ Thêm ô kho mới</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 border-t border-slate-200">
            <div className="md:col-span-5 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
              <input className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs focus:ring-2 focus:ring-secondary/20 transition-all" placeholder="Tìm kiếm mã ô kho, vị trí, khách thuê..." type="text"/>
            </div>
            <div className="md:col-span-3 relative">
              <select className="w-full h-9 pl-3 pr-8 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs appearance-none cursor-pointer focus:ring-2 focus:ring-secondary/20 transition-all">
                <option value="">Trạng thái: Tất cả trạng thái</option>
                <option value="available">Còn trống (14)</option>
                <option value="reserved">Đã đặt chỗ (3)</option>
                <option value="occupied">Đang sử dụng (98)</option>
                <option value="maintenance">Bảo trì (4)</option>
                <option value="overdue">Quá hạn xử lý (1)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">expand_more</span>
            </div>
            <div className="md:col-span-3 relative">
              <select className="w-full h-9 pl-3 pr-8 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs appearance-none cursor-pointer focus:ring-2 focus:ring-secondary/20 transition-all">
                <option value="">Loại kho: Tất cả phân loại</option>
                <option value="mini">Kho Mini (2.0 - 3.5 m²)</option>
                <option value="standard">Kho Tiêu Chuẩn (4.0 - 8.0 m²)</option>
                <option value="large">Kho Lớn / Gia Đình (&gt; 10 m²)</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">expand_more</span>
            </div>
            <div className="md:col-span-1 flex items-center justify-end">
              <button className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors" title="Đặt lại bộ lọc" type="button">
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              </button>
            </div>
          </div>
        </div>

        {/* High-Density Inventory Data Table Card */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-xs border-b-2 border-slate-300 h-11">
                  <th className="px-4 py-2 border-r border-slate-200">Mã ô kho</th>
                  <th className="px-4 py-2 border-r border-slate-200">Phân loại kho</th>
                  <th className="px-4 py-2 border-r border-slate-200">Vị trí mặt bằng</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right">Diện tích</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-right">Đơn giá niêm yết</th>
                  <th className="px-4 py-2 border-r border-slate-200 text-center">Trạng thái hoạt động</th>
                  <th className="px-4 py-2 border-r border-slate-200">Khách hàng thuê</th>
                  <th className="px-4 py-2 border-r border-slate-200">Hạn hợp đồng / Ghi chú</th>
                  <th className="px-4 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-800 divide-y divide-slate-200">
                <tr className="h-13 bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold font-mono text-primary border-r border-slate-200">KV-TB-A101</td>
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200">Kho Tiêu Chuẩn</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Tầng 1 • Dãy A</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 border-r border-slate-200">6.0 m²</td>
                  <td className="px-4 py-3 font-bold text-right text-slate-900 border-r border-slate-200">1.850.000₫<span className="text-[11px] font-normal text-slate-500">/th</span></td>
                  <td className="px-4 py-3 text-center border-r border-slate-200">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-500 font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>Còn trống
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 border-r border-slate-200">---</td>
                  <td className="px-4 py-3 text-slate-500 border-r border-slate-200">Sẵn sàng bàn giao</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium transition-colors" type="button">Khóa bảo trì</button>
                      <button className="px-2.5 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors" type="button">Đổi giá</button>
                    </div>
                  </td>
                </tr>
                <tr className="h-13 bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                  <td className="px-4 py-3 font-semibold font-mono text-primary border-r border-slate-200">KV-TB-A102</td>
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200">Kho Tiêu Chuẩn</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Tầng 1 • Dãy A</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 border-r border-slate-200">6.0 m²</td>
                  <td className="px-4 py-3 font-bold text-right text-slate-900 border-r border-slate-200">1.850.000₫<span className="text-[11px] font-normal text-slate-500">/th</span></td>
                  <td className="px-4 py-3 text-center border-r border-slate-200">
                    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-500 font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Đã đặt chỗ
                    </span>
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">Nguyễn Thu Trang</span>
                      <span className="text-[11px] text-blue-700 font-medium">Nhận phòng: 01/11/2024</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">HĐ giữ chỗ (6 Tháng)</td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-2.5 py-1 rounded bg-secondary text-white hover:bg-blue-700 font-medium shadow-sm transition-all" type="button">Xem gán kho</button>
                  </td>
                </tr>
                <tr className="h-13 bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold font-mono text-primary border-r border-slate-200">KV-TB-B205</td>
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200">Kho Gia Đình</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Tầng trệt • Khu B</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 border-r border-slate-200">12.0 m²</td>
                  <td className="px-4 py-3 font-bold text-right text-slate-900 border-r border-slate-200">3.450.000₫<span className="text-[11px] font-normal text-slate-500">/th</span></td>
                  <td className="px-4 py-3 text-center border-r border-slate-200">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-400 font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Đang sử dụng
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-200">Cty TNHH Hoàng Phát</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Hạn đến: <span className="font-semibold text-slate-800">25/04/2025</span></td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium transition-colors" type="button">Xem HĐ &amp; Lịch sử</button>
                  </td>
                </tr>
                <tr className="h-13 bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                  <td className="px-4 py-3 font-semibold font-mono text-primary border-r border-slate-200">KV-TB-C105</td>
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200">Kho Mini</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Tầng 1 • Khu C</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 border-r border-slate-200">2.5 m²</td>
                  <td className="px-4 py-3 font-bold text-right text-slate-900 border-r border-slate-200">950.000₫<span className="text-[11px] font-normal text-slate-500">/th</span></td>
                  <td className="px-4 py-3 text-center border-r border-slate-200">
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-500 font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Bảo trì
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 border-r border-slate-200">---</td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <div className="flex items-center gap-1 text-amber-700 font-medium">
                      <span className="material-symbols-outlined text-[16px]">build</span>
                      <span>Lỗi cảm biến SmartLock</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-2.5 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium transition-colors" type="button">Mở lại kho</button>
                  </td>
                </tr>
                <tr className="h-13 bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold font-mono text-primary border-r border-slate-200">KV-TB-A103</td>
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200">Kho Tiêu Chuẩn</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Tầng 1 • Dãy A</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 border-r border-slate-200">6.0 m²</td>
                  <td className="px-4 py-3 font-bold text-right text-slate-900 border-r border-slate-200">1.850.000₫<span className="text-[11px] font-normal text-slate-500">/th</span></td>
                  <td className="px-4 py-3 text-center border-r border-slate-200">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-400 font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Đang sử dụng
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-200">Phan Văn Bình</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Hạn đến: <span className="font-semibold text-slate-800">15/12/2024</span></td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium transition-colors" type="button">Xem HĐ</button>
                  </td>
                </tr>
                <tr className="h-13 bg-rose-50/50 hover:bg-rose-50 transition-colors">
                  <td className="px-4 py-3 font-bold font-mono text-rose-600 border-r border-slate-200">KV-TB-B102</td>
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-slate-200">Kho Lớn</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">Tầng trệt • Khu B</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 border-r border-slate-200">16.0 m²</td>
                  <td className="px-4 py-3 font-bold text-right text-slate-900 border-r border-slate-200">4.500.000₫<span className="text-[11px] font-normal text-slate-500">/th</span></td>
                  <td className="px-4 py-3 text-center border-r border-slate-200">
                    <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-500 font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>Quá hạn
                    </span>
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">Trần Minh Quân</span>
                      <span className="text-[11px] font-semibold text-rose-600">Nợ cước 6 ngày</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-[11px]">Niêm phong tạm thời</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition-all" type="button">Khóa mã PIN</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">Hiển thị <span className="font-bold text-slate-900">1 - 6</span> trên tổng số <span className="font-bold text-slate-900">120</span> ô kho</div>
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 rounded-md border border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors" disabled type="button">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button className="w-8 h-8 rounded-md bg-primary text-white font-bold text-xs shadow-sm" type="button">1</button>
              <button className="w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors" type="button">2</button>
              <button className="w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors" type="button">3</button>
              <span className="px-1 text-slate-400 text-xs">...</span>
              <button className="w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors" type="button">20</button>
              <button className="w-8 h-8 rounded-md border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors" type="button">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
