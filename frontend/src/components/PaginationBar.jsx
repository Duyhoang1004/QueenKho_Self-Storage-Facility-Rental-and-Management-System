function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

export function ListBoxHeader({
  icon = 'format_list_bulleted',
  title = 'Danh sách',
  currentPage = 1,
  totalPages = 1,
  pageSize = 5,
  itemLabel = 'mục',
  rightSlot = null,
}) {
  return (
    <div className="px-5 py-3.5 bg-[#FBFBFB] border-b-2 border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#DDF4FF] border-2 border-[#84D8FF] flex items-center justify-center text-[#1CB0F6] shrink-0">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-black text-[#4B4B4B] uppercase tracking-wider">
            {title}
          </h3>
          <p className="text-[11px] font-bold text-[#AFAFAF]">
            Trang {currentPage} / {Math.max(1, totalPages)} · Mỗi trang {pageSize} {itemLabel}
          </p>
        </div>
      </div>
      {rightSlot && <div className="flex items-center gap-2.5 flex-wrap">{rightSlot}</div>}
    </div>
  )
}

export default function PaginationBar({
  currentPage = 1,
  totalItems = 0,
  pageSize = 5,
  onPageChange,
  itemLabel = 'mục',
  extraInfo = null,
}) {
  if (totalItems === 0) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  return (
    <div className="px-6 py-4 bg-[#FBFBFB] border-t-2 border-[#E5E5E5] flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
      <div className="text-xs font-bold text-[#777777] flex flex-wrap items-center gap-1.5">
        <span>Hiển thị</span>
        <span className="font-black text-[#4B4B4B] font-mono">{startIndex + 1}</span>
        <span>–</span>
        <span className="font-black text-[#4B4B4B] font-mono">{endIndex}</span>
        <span>trong tổng số</span>
        <span className="font-black text-[#1CB0F6] font-mono">{totalItems}</span>
        <span>{itemLabel}</span>
        {extraInfo && <span className="ml-1 text-[#AFAFAF]">• {extraInfo}</span>}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* Về trang đầu << */}
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => onPageChange(1)}
          className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
            safePage === 1
              ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
              : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
          }`}
          title="Về trang đầu (<<)"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span>
        </button>

        {/* Trang trước < */}
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
            safePage === 1
              ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
              : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
          }`}
          title="Trang trước (<)"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>

        {/* Số trang */}
        {getPageNumbers(safePage, totalPages).map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="w-7 text-center text-xs font-black text-[#AFAFAF]">
                ...
              </span>
            )
          }
          const isActive = p === safePage
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] h-9 px-2 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1CB0F6] border-[#1899D6] text-white shadow-xs'
                  : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2'
              }`}
            >
              {p}
            </button>
          )
        })}

        {/* Trang sau > */}
        <button
          type="button"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
            safePage === totalPages
              ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
              : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
          }`}
          title="Trang sau (>)"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>

        {/* Đến trang cuối >> */}
        <button
          type="button"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(totalPages)}
          className={`w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center font-black text-xs transition-all ${
            safePage === totalPages
              ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#C7C7C7] cursor-not-allowed opacity-60'
              : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7] active:border-b-2 cursor-pointer'
          }`}
          title="Đến trang cuối (>>)"
        >
          <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_right</span>
        </button>
      </div>
    </div>
  )
}
