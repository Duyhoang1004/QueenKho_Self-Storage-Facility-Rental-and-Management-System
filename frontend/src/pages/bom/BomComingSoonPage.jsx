// Trang placeholder cho các chức năng BOM theo phong cách Stitch
export default function BomComingSoonPage({ title, uc, icon }) {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        <p className="text-xs text-slate-500 mt-1">Phân hệ vận hành chuỗi QueenKho Storage Platform</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center text-center gap-4 shadow-2xs">
        <div className="w-16 h-16 rounded-2xl bg-[#072448] text-[#38BDF8] flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[32px]">{icon}</span>
        </div>
        <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#0066CC] font-bold text-xs tracking-wider">
          {uc}
        </span>
        <h3 className="text-base font-bold text-slate-800">
          Chức năng đang được tích hợp
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Dữ liệu và giao diện đang được xây dựng bám sát tài liệu đặc tả nghiệp vụ QueenKho.
        </p>
      </div>
    </div>
  );
}
