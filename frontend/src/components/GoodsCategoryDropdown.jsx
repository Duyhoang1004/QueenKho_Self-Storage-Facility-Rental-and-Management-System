import { useEffect, useRef, useState } from 'react'

// BR-131 (05/11/2026): dropdown chọn nhiều loại hàng gửi kho. Loại cần kho lạnh bị khoá khi ô là kho thường.
export default function GoodsCategoryDropdown({ categories, value, onChange, temperatureClass = 'NORMAL' }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const coldOk = temperatureClass === 'COLD' || temperatureClass === 'FROZEN'
  const selected = categories.filter((c) => value.includes(c.code))

  const toggle = (code) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code])
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="duo-input w-full flex items-center justify-between gap-2 text-left min-h-[46px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex flex-wrap gap-1.5 min-w-0">
          {selected.length === 0 && <span className="text-[#AFAFAF]">Chọn loại hàng sẽ gửi kho...</span>}
          {selected.map((c) => (
            <span key={c.code} className="text-[11px] font-black bg-[#DDF4FF] border border-[#84D8FF] text-[#1899D6] px-2 py-0.5 rounded-full">
              {c.name}
            </span>
          ))}
        </span>
        <span className="material-symbols-outlined text-[20px] text-[#AFAFAF] shrink-0">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <ul role="listbox" aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-lg py-1 max-h-72 overflow-y-auto">
          {categories.map((c) => {
            const locked = c.requiresColdStorage && !coldOk
            const checked = value.includes(c.code)
            return (
              <li key={c.code}>
                <label className={`flex items-start gap-3 px-4 py-2.5 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#F7F7F7]'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked && !checked}
                    onChange={() => toggle(c.code)}
                    className="mt-0.5 w-4 h-4 accent-[#1CB0F6]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#4B4B4B]">{c.name}</span>
                    {locked ? (
                      <span className="block text-[11px] font-bold text-[#FF4B4B]">Chỉ gửi được ở kho lạnh / kho đông</span>
                    ) : c.description ? (
                      <span className="block text-[11px] font-bold text-[#AFAFAF]">{c.description}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
