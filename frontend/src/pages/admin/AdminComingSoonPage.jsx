// Trang tạm cho các mục Admin chưa làm — mỗi UC xong sẽ thay element trong App.jsx
export default function AdminComingSoonPage({ title, uc, icon }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-[#4B4B4B]">{title}</h1>
      <div className="duo-card mt-6 p-10 flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#F3E3FF] text-[#CE82FF] flex items-center justify-center">
          <span className="material-symbols-outlined text-[36px]">{icon}</span>
        </div>
        <span className="duo-badge border-2 bg-[#F3E3FF] text-[#A559D9] border-[#CE82FF]">{uc}</span>
        <p className="text-sm font-bold text-[#777777]">Chức năng đang được xây dựng.</p>
      </div>
    </div>
  );
}
