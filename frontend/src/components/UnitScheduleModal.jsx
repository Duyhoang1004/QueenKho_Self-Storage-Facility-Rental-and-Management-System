import { useEffect, useMemo, useState } from 'react'
import { getUnitSchedule } from '../services/storageUnitService'
import ContractDetailModal from './ContractDetailModal'

// D-18 (08/11/2026): popup "Lịch ô kho" — mỗi ô 1 hàng, thanh màu = khoảng đã có khách đặt, nền xanh = khoảng trống.
// Ngày dạng 'yyyy-MM-dd', tính theo UTC để không lệch múi giờ.

const DAY = 86400000
const parse = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toIso = (t) => new Date(t).toISOString().slice(0, 10)
const addDays = (iso, n) => toIso(parse(iso) + n * DAY)
const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return toIso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)))
}
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY)
const fmt = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '—')
const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const STATUS = {
  ACTIVE: { label: 'Đang thuê', color: '#58CC02', dark: '#58A700' },
  PENDING_CHECK_IN: { label: 'Đã gán, chờ nhận kho', color: '#1CB0F6', dark: '#1899D6' },
  TERMINATION_PENDING: { label: 'Đã hẹn trả kho', color: '#FF9600', dark: '#E58800' },
  OVERDUE: { label: 'Quá hạn', color: '#FF4B4B', dark: '#EA2B2B' },
}
const UNIT_STATUS = {
  AVAILABLE: { label: 'Trống hôm nay', cls: 'bg-[#D7FFB8] text-[#58A700]' },
  OCCUPIED: { label: 'Đang có khách', cls: 'bg-[#DDF4FF] text-[#1899D6]' },
  MAINTENANCE: { label: 'Bảo trì', cls: 'bg-[#F0F0F0] text-[#777777]' },
}
const WINDOWS = [1, 3, 6, 12]
const STRIPES = 'repeating-linear-gradient(45deg, rgba(255,255,255,.45) 0 4px, transparent 4px 8px)'

export default function UnitScheduleModal({ isOpen, onClose, ...props }) {
  if (!isOpen) return null
  // Mỗi lần mở dựng lại từ đầu (khoảng xem, bộ lọc theo đơn đang gán)
  return <ScheduleBoard onClose={onClose} {...props} />
}

function ScheduleBoard({ onClose, unitTypeId = null, highlight = null, selectableIds = null, onSelectUnit = null, selectedUnitId = null }) {
  const today = localToday()
  // Đang gán ô cho 1 đơn → mở đủ rộng để thấy hết thời gian thuê của đơn
  const initialMonths = highlight?.to
    ? WINDOWS.find(m => addMonths(today, m) >= highlight.to) || 12
    : 3
  const [from, setFrom] = useState(today)
  const [months, setMonths] = useState(initialMonths)
  const [typeId, setTypeId] = useState(unitTypeId ? String(unitTypeId) : '')
  const [result, setResult] = useState({ key: null, data: null, error: '' })
  const [types, setTypes] = useState([])
  const [selected, setSelected] = useState(selectedUnitId ? { unitId: selectedUnitId } : null)
  // (10/11/2026) Xem / đổi ô hợp đồng ngay trong popup thay vì mở tab mới (tab mới mất phiên đăng nhập)
  const [peek, setPeek] = useState(null)
  const [reload, setReload] = useState(0)

  const to = addMonths(from, months)
  const requestKey = `${from}|${to}|${typeId}|${reload}`
  // Đang tải = kết quả hiện có chưa khớp khoảng xem / bộ lọc đang chọn (giữ dữ liệu cũ cho tới khi có dữ liệu mới)
  const loading = result.key !== requestKey
  const data = result.data
  const error = result.key === requestKey ? result.error : ''

  useEffect(() => {
    let cancelled = false
    getUnitSchedule({ from, to, unitTypeId: typeId || undefined })
      .then(res => {
        if (cancelled) return
        setResult({ key: requestKey, data: res, error: '' })
        // Danh sách loại kho lấy từ lần tải không lọc
        if (!typeId) {
          const map = new Map()
          ;(res.units || []).forEach(u => u.unitTypeId && map.set(u.unitTypeId, u.unitTypeName))
          setTypes([...map.entries()].map(([id, name]) => ({ id, name })))
        }
      })
      .catch(err => {
        if (!cancelled) {
          setResult(prev => ({ key: requestKey, data: prev.data, error: err.response?.data?.message || 'Không tải được lịch ô kho.' }))
        }
      })
    return () => { cancelled = true }
  }, [from, to, typeId, requestKey, reload])

  // Lọc theo loại khi mở từ modal gán ô: lần đầu cần danh sách loại đầy đủ
  useEffect(() => {
    if (!unitTypeId) return
    getUnitSchedule({ from: today, to: addDays(today, 1) })
      .then(res => {
        const map = new Map()
        ;(res.units || []).forEach(u => u.unitTypeId && map.set(u.unitTypeId, u.unitTypeName))
        setTypes([...map.entries()].map(([id, name]) => ({ id, name })))
      })
      .catch(() => {})
  }, [unitTypeId, today])

  const total = parse(to) - parse(from)
  const pos = (iso) => Math.min(100, Math.max(0, ((parse(iso) - parse(from)) / total) * 100))
  const span = (start, end) => {
    const left = pos(start < from ? from : start)
    const right = pos(!end || end > to ? to : end)
    return { left, width: right - left }
  }

  // Vạch chia: mỗi tuần khi xem 1 tháng, mỗi đầu tháng khi xem dài hơn
  const ticks = useMemo(() => {
    const list = []
    if (months === 1) {
      for (let d = addDays(from, 7); d < to; d = addDays(d, 7)) list.push({ iso: d, label: fmt(d).slice(0, 5) })
    } else {
      const [y, m] = from.split('-').map(Number)
      for (let i = 1; i <= months + 1; i++) {
        const d = toIso(Date.UTC(y, m - 1 + i, 1))
        if (d >= to) break
        list.push({ iso: d, label: `Th${Number(d.slice(5, 7))}/${d.slice(2, 4)}` })
      }
    }
    return list
  }, [from, to, months])

  const units = data?.units || []
  const selectedRow = selected ? units.find(u => u.unitId === selected.unitId) : null
  const selectedBooking = selectedRow && selected.contractId
    ? selectedRow.bookings.find(b => b.contractId === selected.contractId)
    : null
  const freeCount = units.filter(u => (u.freeRanges || []).some(r => r.from <= today && (!r.to || r.to > today))).length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div className="duo-card bg-white w-full max-w-[1240px] max-h-[94vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b-2 border-[#E5E5E5] bg-[#FAFAFA] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#1CB0F6] border-b-2 border-[#1899D6] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">calendar_month</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-[#4B4B4B]">Lịch ô kho{data?.facilityName ? ` — ${data.facilityName}` : ''}</h2>
              <p className="text-[11px] font-bold text-[#AFAFAF]">
                Thanh màu = đã có khách đặt (phần sọc = {data?.cleanupDays ?? 2} ngày dọn ô) · nền xanh = còn trống.
                Bấm vào ô / thanh để xem chi tiết.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-[#E5E5E5] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 sm:px-6 py-3 border-b-2 border-[#F0F0F0] flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setFrom(addMonths(from, -Math.max(1, Math.floor(months / 2))))}
              className="duo-btn-white w-9 h-9 p-0 flex items-center justify-center" title="Lùi">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button type="button" onClick={() => setFrom(today)} className="duo-btn-white px-3 h-9 text-xs">Hôm nay</button>
            <button type="button" onClick={() => setFrom(addMonths(from, Math.max(1, Math.floor(months / 2))))}
              className="duo-btn-white w-9 h-9 p-0 flex items-center justify-center" title="Tới">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
          <span className="text-xs font-black text-[#4B4B4B] px-1">{fmt(from)} → {fmt(addDays(to, -1))}</span>
          <div className="flex rounded-xl border-2 border-[#E5E5E5] overflow-hidden ml-auto">
            {WINDOWS.map(m => (
              <button key={m} type="button" onClick={() => setMonths(m)}
                className={`px-3 h-8 text-[11px] font-black ${months === m ? 'bg-[#1CB0F6] text-white' : 'bg-white text-[#777777] hover:bg-[#F7F7F7]'}`}>
                {m} tháng
              </button>
            ))}
          </div>
          <select value={typeId} onChange={e => setTypeId(e.target.value)} className="duo-input h-9 py-0 text-xs w-auto min-w-[150px]">
            <option value="">Tất cả loại kho</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Chú thích + cảnh báo */}
        <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-[#777777]">
          {Object.entries(STATUS).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="w-4 h-3 rounded" style={{ background: s.color }} />{s.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded" style={{ background: '#AFAFAF', backgroundImage: STRIPES }} />Bảo trì
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded bg-[#D7FFB8] border border-[#A5ED6E]" />Trống
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3 bg-[#FF4B4B]" />Hôm nay
          </span>
          {data && <span className="ml-auto text-[#58A700]">{freeCount}/{units.length} ô trống hôm nay</span>}
        </div>
        {highlight && (
          <div className="mx-4 sm:mx-6 mb-2 rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF] px-4 py-2 text-xs font-bold text-[#1899D6]">
            {highlight.label || 'Khoảng cần ô'}: {fmt(highlight.from)} → {fmt(highlight.to)} (vùng viền xanh trên lịch).
            {onSelectUnit && ' Ô nào có nền xanh phủ kín vùng này thì gán được — bấm tên ô để chọn.'}
          </div>
        )}
        {data?.conflictCount > 0 && (
          <div className="mx-4 sm:mx-6 mb-2 rounded-2xl border-2 border-[#FFDFDF] bg-[#FFF5F5] px-4 py-2 text-xs font-black text-[#FF4B4B] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            {data.conflictCount} hợp đồng bị trùng lịch / nằm trên ô bảo trì (viền đỏ) — bấm vào thanh để đổi ô cho khách.
          </div>
        )}

        {/* Lưới lịch */}
        <div className="flex-1 overflow-auto border-t-2 border-[#F0F0F0]">
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center gap-2 text-[#AFAFAF]">
              <span className="material-symbols-outlined animate-spin text-[28px] text-[#1CB0F6]">sync</span>
              <span className="text-xs font-bold">Đang tải lịch ô kho...</span>
            </div>
          ) : error ? (
            <div className="m-6 rounded-2xl border-2 border-[#FFDFDF] bg-[#FFF5F5] px-4 py-3 text-xs font-bold text-[#FF4B4B]">{error}</div>
          ) : units.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold text-[#AFAFAF]">Không có ô kho nào.</div>
          ) : (
            <div className={`min-w-[860px] ${loading ? 'opacity-60' : ''}`}>
              {/* Hàng tiêu đề tháng / tuần */}
              <div className="flex sticky top-0 z-20 bg-white border-b-2 border-[#E5E5E5]">
                <div className="w-[180px] shrink-0 sticky left-0 z-30 bg-white px-3 py-2 text-[10px] font-black uppercase text-[#AFAFAF]">Ô kho</div>
                <div className="relative flex-1 h-8">
                  <span className="absolute left-1 top-2 text-[10px] font-black text-[#AFAFAF]">{fmt(from).slice(0, 5)}</span>
                  {ticks.map(t => (
                    <span key={t.iso} className="absolute top-2 text-[10px] font-black text-[#777777] -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(t.iso)}%` }}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>

              {units.map(row => {
                const selectable = selectableIds ? selectableIds.has(row.unitId) : true
                const isSelectedRow = selected?.unitId === row.unitId || selectedUnitId === row.unitId
                const st = UNIT_STATUS[row.status] || UNIT_STATUS.AVAILABLE
                return (
                  <div key={row.unitId} className={`flex border-b border-[#F0F0F0] ${isSelectedRow ? 'bg-[#F2FBFF]' : 'hover:bg-[#FAFAFA]'}`}>
                    <button
                      type="button"
                      onClick={() => setSelected({ unitId: row.unitId })}
                      className={`w-[180px] shrink-0 sticky left-0 z-10 px-3 py-1.5 text-left border-r-2 ${
                        isSelectedRow ? 'bg-[#F2FBFF] border-[#1CB0F6]' : 'bg-white border-[#F0F0F0]'
                      } ${selectableIds && !selectable ? 'opacity-60' : ''}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-[#4B4B4B]">{row.unitId}</span>
                        {row.conflict && <span className="material-symbols-outlined text-[14px] text-[#FF4B4B]">warning</span>}
                        {selectableIds && selectable && <span className="material-symbols-outlined text-[14px] text-[#58CC02]" title="Gán được cho đơn này">check_circle</span>}
                      </span>
                      <span className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-black px-1.5 rounded-full ${st.cls}`}>{st.label}</span>
                        <span className="text-[10px] font-bold text-[#AFAFAF] truncate">{row.unitTypeName}</span>
                      </span>
                    </button>

                    <div className="relative flex-1 h-12">
                      {/* vạch chia */}
                      {ticks.map(t => (
                        <span key={t.iso} className="absolute top-0 bottom-0 w-px bg-[#F0F0F0]" style={{ left: `${pos(t.iso)}%` }} />
                      ))}
                      {/* khoảng trống */}
                      {(row.freeRanges || []).map(r => {
                        const s = span(r.from, r.to)
                        if (s.width <= 0) return null
                        const tip = r.to
                          ? `Trống ${fmt(r.from)} → ${fmt(addDays(r.to, -1))} (${r.days} ngày)`
                          : `Trống từ ${fmt(r.from)} — chưa ai đặt sau đó`
                        return (
                          <div key={`f-${r.from}`} title={tip}
                            onClick={() => setSelected({ unitId: row.unitId })}
                            className="absolute top-1.5 bottom-1.5 rounded-lg bg-[#D7FFB8]/70 border border-[#A5ED6E] cursor-pointer overflow-hidden flex items-center px-1.5"
                            style={{ left: `${s.left}%`, width: `${s.width}%` }}>
                            {s.width > 9 && (
                              <span className="text-[10px] font-black text-[#58A700] truncate">
                                {r.to ? `Trống ${r.days} ngày` : 'Trống'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {/* bảo trì: chặn từ hôm nay */}
                      {row.status === 'MAINTENANCE' && (() => {
                        const s = span(today, null)
                        return s.width > 0 && (
                          <div title={`Bảo trì${row.maintenanceNote ? `: ${row.maintenanceNote}` : ''}`}
                            className="absolute top-1.5 bottom-1.5 rounded-lg flex items-center px-2 overflow-hidden"
                            style={{ left: `${s.left}%`, width: `${s.width}%`, background: '#C9C9C9', backgroundImage: STRIPES }}>
                            <span className="text-[10px] font-black text-[#4B4B4B] truncate">Bảo trì{row.maintenanceNote ? ` — ${row.maintenanceNote}` : ''}</span>
                          </div>
                        )
                      })()}
                      {/* hợp đồng */}
                      {(row.bookings || []).map(b => {
                        const meta = STATUS[b.status] || STATUS.ACTIVE
                        const main = span(b.startDate, b.endDate || b.freeFrom)
                        const tail = b.endDate && b.freeFrom ? span(b.endDate, b.freeFrom) : { width: 0 }
                        const tip = [
                          `${b.contractCode} · ${b.customerName || ''}`,
                          `${meta.label}: ${fmt(b.startDate)} → ${fmt(b.endDate)}`,
                          b.freeFrom ? `Ô giao lại được từ ${fmt(b.freeFrom)}` : null,
                          b.mayRenew ? 'Khách còn quyền gia hạn' : null,
                          b.note,
                        ].filter(Boolean).join('\n')
                        const pick = () => setSelected({ unitId: row.unitId, contractId: b.contractId })
                        return (
                          <div key={b.contractId}>
                            {main.width > 0 && (
                              <button type="button" title={tip} onClick={pick}
                                className={`absolute top-1.5 bottom-1.5 rounded-lg flex items-center px-2 overflow-hidden text-left ${
                                  b.conflict ? 'ring-2 ring-[#FF4B4B] ring-offset-1' : ''
                                } ${b.status === 'PENDING_CHECK_IN' ? 'border-2 border-dashed' : 'border-b-2'}`}
                                style={{ left: `${main.left}%`, width: `${main.width}%`, background: meta.color, borderColor: meta.dark }}>
                                {main.width > 6 && (
                                  <span className="text-[10px] font-black text-white truncate">
                                    {b.customerName || b.contractCode}{main.width > 16 ? ` · ${fmt(b.startDate).slice(0, 5)}–${fmt(b.endDate).slice(0, 5)}` : ''}
                                  </span>
                                )}
                                {b.mayRenew && main.width > 3 && (
                                  <span className="material-symbols-outlined text-[13px] text-white ml-auto" title="Khách còn quyền gia hạn">autorenew</span>
                                )}
                              </button>
                            )}
                            {tail.width > 0 && (
                              <div title={`Dọn ô tới hết ${fmt(addDays(b.freeFrom, -1))}`} onClick={pick}
                                className="absolute top-1.5 bottom-1.5 rounded-r-lg opacity-60 cursor-pointer"
                                style={{ left: `${tail.left}%`, width: `${tail.width}%`, background: meta.color, backgroundImage: STRIPES }} />
                            )}
                          </div>
                        )
                      })}
                      {/* vùng đơn đang cần ô */}
                      {highlight && (() => {
                        const s = span(highlight.from, highlight.to)
                        return s.width > 0 && (
                          <div className="absolute top-0.5 bottom-0.5 rounded-lg border-2 border-[#1CB0F6] bg-[#1CB0F6]/10 pointer-events-none"
                            style={{ left: `${s.left}%`, width: `${s.width}%` }} />
                        )
                      })()}
                      {/* hôm nay */}
                      {today >= from && today < to && (
                        <span className="absolute top-0 bottom-0 w-0.5 bg-[#FF4B4B] pointer-events-none" style={{ left: `${pos(today)}%` }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Chi tiết ô / hợp đồng đang chọn + đơn chưa gán */}
        <div className="border-t-2 border-[#E5E5E5] bg-[#FAFAFA] px-4 sm:px-6 py-3 max-h-[34vh] overflow-y-auto">
          {selectedRow ? (
            <UnitDetail
              row={selectedRow}
              booking={selectedBooking}
              today={today}
              selectable={selectableIds ? selectableIds.has(selectedRow.unitId) : false}
              onSelectUnit={onSelectUnit}
              onPickBooking={(contractId) => setSelected({ unitId: selectedRow.unitId, contractId })}
              onOpenContract={setPeek}
            />
          ) : (
            <PendingDemand items={data?.pendingReservations || []} />
          )}
        </div>
      </div>
      {peek && (
        <ContractDetailModal
          key={`${peek.id}-${peek.transfer}`}
          contractId={peek.id}
          transfer={peek.transfer}
          onClose={() => { setPeek(null); setReload(r => r + 1) }}
        />
      )}
    </div>
  )
}

function UnitDetail({ row, booking, today, selectable, onSelectUnit, onPickBooking, onOpenContract }) {
  const free = row.freeRanges || []
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-black text-[#4B4B4B]">{row.unitId}</span>
        <span className="text-[11px] font-bold text-[#AFAFAF]">
          {row.unitTypeName} · {row.floor || '—'} · Khu {row.zone || '—'} · P.{row.roomNumber || '—'}
        </span>
        {onSelectUnit && (
          selectable ? (
            <button type="button" onClick={() => onSelectUnit(row.unitId)} className="duo-btn-green ml-auto px-4 py-1.5 text-xs gap-1">
              <span className="material-symbols-outlined text-[16px]">check</span>Chọn ô này
            </button>
          ) : (
            <span className="ml-auto text-[11px] font-bold text-[#FF4B4B]">Ô này không trống suốt thời gian thuê của đơn</span>
          )
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Khoảng trống</span>
          {row.status === 'MAINTENANCE' && (
            <span className="text-xs font-bold text-[#777777]">Đang bảo trì từ hôm nay{row.maintenanceNote ? ` — ${row.maintenanceNote}` : ''}</span>
          )}
          {free.length === 0 && row.status !== 'MAINTENANCE' && (
            <span className="text-xs font-bold text-[#AFAFAF]">Không còn khoảng trống trong thời gian đang xem.</span>
          )}
          {free.map(r => (
            <span key={r.from} className="text-xs font-bold text-[#58A700] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">event_available</span>
              {r.to
                ? `${fmt(r.from)} → ${fmt(addDays(r.to, -1))} · ${r.days} ngày${r.from <= today ? ' (trống từ hôm nay)' : ''}`
                : `Từ ${fmt(r.from)} — chưa ai đặt sau đó`}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Hợp đồng trên ô</span>
          {(row.bookings || []).length === 0 && <span className="text-xs font-bold text-[#AFAFAF]">Chưa có khách đặt.</span>}
          {(row.bookings || []).map(b => {
            const meta = STATUS[b.status] || STATUS.ACTIVE
            const active = booking?.contractId === b.contractId
            const daysLeft = b.freeFrom ? daysBetween(today, b.freeFrom) : null
            return (
              <div key={b.contractId}
                onClick={() => onPickBooking(b.contractId)}
                className={`rounded-xl border-2 px-3 py-2 cursor-pointer ${active ? 'bg-white border-[#1CB0F6]' : 'bg-white border-[#E5E5E5] hover:border-[#BDBDBD]'} ${b.conflict ? 'border-[#FF4B4B]' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                  <span className="text-xs font-black text-[#4B4B4B]">{b.contractCode}</span>
                  <span className="text-[11px] font-bold text-[#777777]">{b.customerName}</span>
                  <span className="text-[10px] font-black" style={{ color: meta.dark }}>{meta.label}</span>
                </div>
                <div className="text-[11px] font-bold text-[#777777] mt-0.5">
                  {fmt(b.startDate)} → {fmt(b.endDate)}
                  {b.freeFrom && ` · ô giao lại từ ${fmt(b.freeFrom)}`}
                  {b.status !== 'PENDING_CHECK_IN' && daysLeft !== null && daysLeft > 0 && ` · còn ${daysLeft} ngày nữa ô trống`}
                  {b.status === 'PENDING_CHECK_IN' && b.startDate > today && ` · còn ${daysBetween(today, b.startDate)} ngày tới ngày nhận`}
                </div>
                {b.note && (
                  <div className={`text-[11px] font-bold mt-1 ${b.conflict ? 'text-[#FF4B4B]' : 'text-[#E58800]'}`}>{b.note}</div>
                )}
                {active && b.contractId && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" onClick={() => onOpenContract({ id: b.contractId, transfer: false })}
                      className="duo-btn-white px-3 py-1 text-[11px] gap-1">
                      <span className="material-symbols-outlined text-[14px]">description</span>Mở hợp đồng
                    </button>
                    {['PENDING_CHECK_IN', 'ACTIVE', 'TERMINATION_PENDING'].includes(b.status) && (
                      <button type="button" onClick={() => onOpenContract({ id: b.contractId, transfer: true })}
                        className="duo-btn-orange px-3 py-1 text-[11px] gap-1">
                        <span className="material-symbols-outlined text-[14px]">swap_horiz</span>Đổi ô cho khách
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PendingDemand({ items }) {
  if (items.length === 0) {
    return <p className="text-[11px] font-bold text-[#AFAFAF]">Không có đơn đã cọc đang chờ gán ô. Bấm vào 1 ô để xem khoảng trống chi tiết.</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase text-[#AFAFAF]">Đơn đã cọc, chưa gán ô ({items.length}) — chọn ô có khoảng trống phủ kín thời gian thuê</span>
      <div className="flex flex-wrap gap-2">
        {items.map(p => (
          <span key={p.reservationId} className="rounded-xl border-2 border-[#E5E5E5] bg-white px-3 py-1.5 text-[11px] font-bold text-[#4B4B4B]">
            <span className="font-black text-[#1CB0F6]">{p.reservationCode}</span> · {p.customerName} · {p.unitTypeName} · {fmt(p.startDate)} → {fmt(p.endDate)}
          </span>
        ))}
      </div>
    </div>
  )
}
