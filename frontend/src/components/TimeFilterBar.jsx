import { hasDateRange, localToday } from '../utils/timeFilter'
import DateInput from './DateInput'

// (10/11/2026) Thanh lọc theo thời gian dùng chung cho các list.
// value/onChange: state từ makeTimeFilter(fields); fields: [{ key, label, get }]
// defaultLabel (tuỳ chọn): có thì thêm nấc "giữ thứ tự mặc định" khi bấm đổi thứ tự
const ORDER_META = {
  default: { icon: 'sort', label: null },
  asc: { icon: 'arrow_upward', label: 'Sớm nhất trước' },
  desc: { icon: 'arrow_downward', label: 'Muộn nhất trước' },
}

export default function TimeFilterBar({ value, onChange, fields, defaultLabel, className = '' }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const today = localToday()
  const isToday = value.from === today && value.to === today
  const cycle = defaultLabel ? ['default', 'asc', 'desc'] : ['asc', 'desc']
  const nextOrder = cycle[(cycle.indexOf(value.order) + 1) % cycle.length]
  const meta = ORDER_META[value.order] || ORDER_META.asc

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="material-symbols-outlined text-[18px] text-[#AFAFAF]">event</span>

      {fields.length > 1 ? (
        <select
          value={value.field}
          onChange={(e) => set({ field: e.target.value })}
          className="duo-input text-xs py-1.5 w-auto cursor-pointer"
          aria-label="Theo mốc thời gian"
        >
          {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      ) : (
        <span className="text-[11px] font-black uppercase text-[#777777]">{fields[0].label}</span>
      )}

      <button
        type="button"
        onClick={() => set({ order: nextOrder })}
        className="px-3 py-1.5 rounded-xl border-2 border-b-4 border-[#E5E5E5] bg-white text-[11px] font-black text-[#4B4B4B] hover:bg-[#F7F7F7] flex items-center gap-1 cursor-pointer"
        title="Đổi thứ tự sắp xếp"
      >
        <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">
          {meta.icon}
        </span>
        {meta.label || defaultLabel}
      </button>

      <div className="flex items-center gap-1">
        <DateInput
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => set({ from: e.target.value })}
          className="duo-input text-xs py-1.5 w-[140px]"
          aria-label="Từ ngày"
          title="Từ ngày"
        />
        <span className="text-[#AFAFAF] text-xs font-black">→</span>
        <DateInput
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => set({ to: e.target.value })}
          className="duo-input text-xs py-1.5 w-[140px]"
          aria-label="Đến ngày"
          title="Đến ngày"
        />
      </div>

      <button
        type="button"
        onClick={() => set(isToday ? { from: '', to: '' } : { from: today, to: today })}
        className={`px-3 py-1.5 rounded-xl border-2 border-b-4 text-[11px] font-black cursor-pointer ${
          isToday ? 'bg-[#DDF4FF] border-[#84D8FF] text-[#1CB0F6]' : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7]'
        }`}
      >
        Hôm nay
      </button>

      {hasDateRange(value) && (
        <button
          type="button"
          onClick={() => set({ from: '', to: '' })}
          className="text-[11px] font-black text-[#FF4B4B] hover:underline cursor-pointer"
        >
          Xoá lọc ngày
        </button>
      )}
    </div>
  )
}
