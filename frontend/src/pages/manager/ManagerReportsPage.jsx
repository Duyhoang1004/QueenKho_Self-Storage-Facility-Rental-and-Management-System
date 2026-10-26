import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getOccupancyReport,
  getRevenueByUnitType,
  getRevenueOverview,
  getRevenueTimeline,
  getRevenueTransactions,
} from '../../services/revenueService'
import { getOverdueContracts } from '../../services/contractService'

// Flow 5 (UC-30 mở rộng): Báo cáo cơ sở cho Facility Manager — ô trống / đang thuê, doanh thu,
// tỷ lệ sử dụng, quá hạn. Dùng lại API doanh thu của BOM; backend tự khoá facilityId = cơ sở của FM (PR-90),
// nên số liệu ở đây luôn khớp với số BOM xem cho cùng cơ sở.

const TYPE_LABELS = {
  DEPOSIT: 'Đặt cọc + thuê',
  MONTHLY_RENT: 'Gia hạn',
  LATE_FEE: 'Phí trễ',
  DAMAGE_FEE: 'Phí sự cố',
  REFUND: 'Hoàn tiền',
}
const METHOD_LABELS = { VNPAY: 'VNPAY', BANK_TRANSFER: 'Chuyển khoản', CASH: 'Tiền mặt', DEPOSIT_OFFSET: 'Trừ cọc' }

function formatVND(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`
}

function formatShort(value) {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}tr`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function KpiCard({ icon, label, value, sub, tone }) {
  return (
    <div className={`duo-card p-4 border-2 flex flex-col gap-1 ${tone}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider opacity-80">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        {label}
      </div>
      <span className="text-2xl font-black">{value}</span>
      {sub && <span className="text-[11px] font-bold opacity-70">{sub}</span>}
    </div>
  )
}

function exportCsv(rows, fileName) {
  const header = ['Mã giao dịch', 'Thời gian', 'Khách hàng', 'Hợp đồng', 'Loại', 'Phương thức', 'Số tiền', 'Trạng thái', 'Mã FT']
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map((t) => [
    t.txnRef, formatTime(t.paidAt), t.customerName, t.contractCode, TYPE_LABELS[t.paymentType] || t.paymentType,
    METHOD_LABELS[t.paymentMethod] || t.paymentMethod, Math.round(Number(t.amount || 0)), t.status, t.bankTxnCode,
  ].map(escape).join(','))
  // ﻿: Excel đọc đúng tiếng Việt UTF-8
  const blob = new Blob(['﻿' + [header.map(escape).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function ManagerReportsPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const now = new Date()
  const [period, setPeriod] = useState('MONTH')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [reloadTick, setReloadTick] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  const queryKey = JSON.stringify({ period, year, month, quarter, reloadTick })
  const loading = result.key !== queryKey
  const data = result.data

  useEffect(() => {
    let cancelled = false
    const overviewParams = { period, year, month: period === 'MONTH' ? month : undefined, quarter: period === 'QUARTER' ? quarter : undefined }
    Promise.all([
      getRevenueOverview(overviewParams),
      getRevenueTimeline({ year }),
      getRevenueByUnitType({}),
      getOccupancyReport({}),
      getRevenueTransactions({}),
      getOverdueContracts(user.userId, 'OVERDUE'),
    ])
      .then(([overview, timeline, byUnitType, occupancy, transactions, overdue]) => {
        if (!cancelled) {
          setResult({ key: queryKey, data: { overview, timeline, byUnitType, occupancy, transactions, overdue }, error: '' })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setResult((current) => ({ key: queryKey, data: current.data, error: err.response?.data?.message || 'Không tải được báo cáo cơ sở.' }))
        }
      })
    return () => { cancelled = true }
    // queryKey gói đủ kỳ báo cáo + lần tải lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const periodLabel = period === 'MONTH' ? `Tháng ${month}/${year}` : period === 'QUARTER' ? `Quý ${quarter}/${year}` : `Năm ${year}`
  const timeline = useMemo(() => data?.timeline || [], [data])
  const maxBar = Math.max(1, ...timeline.map((t) => Number(t.rent || 0) + Number(t.fees || 0)))
  const transactions = data?.transactions || []
  const occupancy = data?.occupancy
  const overview = data?.overview
  const overdue = data?.overdue || []
  const overdueFeeTotal = overdue.reduce((sum, c) => sum + (c.lateFeeWaived ? 0 : Number(c.lateFeeAmount || 0)), 0)

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 flex flex-col gap-6">
      <div className="pb-4 border-b-2 border-[#E5E5E5] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Báo cáo cơ sở</h1>
          <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
            {user.facilityName || 'Cơ sở của bạn'} · {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="duo-input text-sm">
            <option value="MONTH">Theo tháng</option>
            <option value="QUARTER">Theo quý</option>
            <option value="YEAR">Cả năm</option>
          </select>
          {period === 'MONTH' && (
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="duo-input text-sm">
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
            </select>
          )}
          {period === 'QUARTER' && (
            <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className="duo-input text-sm">
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Quý {q}</option>)}
            </select>
          )}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="duo-input text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setReloadTick((t) => t + 1)} className="duo-btn-white px-3 py-2.5 text-xs gap-1">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Làm mới
          </button>
          <button
            onClick={() => exportCsv(transactions, `QueenKho_BaoCao_${user.facilityName || 'CoSo'}_${year}.csv`)}
            disabled={transactions.length === 0}
            className="duo-btn-green px-3 py-2.5 text-xs gap-1 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Xuất CSV
          </button>
        </div>
      </div>

      {result.error && (
        <div className="duo-card border-[#FFDFDF] bg-[#FFF5F5] p-6 flex items-center gap-4">
          <span className="material-symbols-outlined text-[32px] text-[#FF4B4B]">cloud_off</span>
          <span className="flex-1 text-sm font-black text-[#FF4B4B]">{result.error}</span>
        </div>
      )}

      {!data && loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="duo-card h-[96px] animate-pulse bg-[#F7F7F7]" />)}
        </div>
      )}

      {data && (
        <div className={`flex flex-col gap-6 ${loading ? 'opacity-60' : ''}`}>
          {/* Ô kho & tỷ lệ sử dụng */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-black text-[#4B4B4B]">Ô kho & tỷ lệ sử dụng</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon="grid_view" label="Tổng ô kho" value={occupancy?.totalUnits ?? 0}
                tone="border-[#84D8FF] bg-[#F2FAFF] text-[#1899D6]" />
              <KpiCard icon="inventory_2" label="Đang cho thuê" value={occupancy?.occupiedUnits ?? 0}
                sub={`Tỷ lệ lấp đầy ${Number(occupancy?.occupancyRate || 0).toFixed(1)}%`}
                tone="border-[#58CC02] bg-[#F1FFE7] text-[#58A700]" />
              <KpiCard icon="check_box_outline_blank" label="Còn trống" value={occupancy?.availableUnits ?? 0}
                tone="border-[#E5E5E5] bg-white text-[#4B4B4B]" />
              <KpiCard icon="build" label="Đang bảo trì" value={occupancy?.maintenanceUnits ?? 0}
                tone="border-[#FF9600] bg-[#FFF8EE] text-[#E58800]" />
            </div>
            <div className="duo-card p-4">
              <div className="flex items-center justify-between text-xs font-black text-[#777777] mb-2">
                <span>Mức lấp đầy</span>
                <span>{Number(occupancy?.occupancyRate || 0).toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-[#F0F0F0] overflow-hidden">
                <div className="h-full bg-[#58CC02]" style={{ width: `${Math.min(100, Number(occupancy?.occupancyRate || 0))}%` }} />
              </div>
              <p className="text-[11px] font-bold text-[#AFAFAF] mt-2">
                Hợp đồng mới {occupancy?.newContracts ?? 0} · đã kết thúc {occupancy?.terminatedContracts ?? 0} · tỷ lệ tái ký {Number(occupancy?.retentionRate || 0).toFixed(1)}%
              </p>
            </div>
          </section>

          {/* Doanh thu */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-black text-[#4B4B4B]">Doanh thu · {periodLabel}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon="trending_up" label="Doanh thu thuần" value={formatVND(overview?.netRevenue)}
                sub={`So kỳ trước ${Number(overview?.growthRate || 0) >= 0 ? '+' : ''}${Number(overview?.growthRate || 0).toFixed(1)}%`}
                tone="border-[#58CC02] bg-[#F1FFE7] text-[#58A700]" />
              <KpiCard icon="payments" label="Cọc + tiền thuê" value={formatVND(overview?.rentalRevenue)}
                sub={`${overview?.rentalCount ?? 0} giao dịch`} tone="border-[#84D8FF] bg-[#F2FAFF] text-[#1899D6]" />
              <KpiCard icon="timer_off" label="Phí trễ + sự cố" value={formatVND(overview?.feesRevenue)}
                tone="border-[#FFC800] bg-[#FFFBEA] text-[#B38F00]" />
              <KpiCard icon="currency_exchange" label="Đã hoàn cho khách" value={formatVND(overview?.refundDisbursed)}
                sub={`${overview?.refundCount ?? 0} lượt · cọc đang giữ ${formatVND(overview?.depositsHeld)}`}
                tone="border-[#E5E5E5] bg-[#F7F7F7] text-[#777777]" />
            </div>

            <div className="duo-card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black text-[#4B4B4B]">Doanh thu theo tháng · {year}</span>
                <span className="flex items-center gap-3 text-[11px] font-bold text-[#777777]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1CB0F6]" />Thuê</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#FFC800]" />Phí</span>
                </span>
              </div>
              <div className="flex items-end gap-2 h-[180px]">
                {timeline.map((t) => {
                  const rent = Number(t.rent || 0)
                  const fees = Number(t.fees || 0)
                  return (
                    <div key={t.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${t.label}: thuê ${formatVND(rent)}, phí ${formatVND(fees)}, hoàn ${formatVND(t.refund)}`}>
                      <span className="text-[10px] font-black text-[#777777]">{rent + fees > 0 ? formatShort(rent + fees) : ''}</span>
                      <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style={{ height: `${((rent + fees) / maxBar) * 100}%`, minHeight: rent + fees > 0 ? 4 : 0 }}>
                        <div className="bg-[#FFC800]" style={{ height: `${rent + fees > 0 ? (fees / (rent + fees)) * 100 : 0}%` }} />
                        <div className="bg-[#1CB0F6] flex-1" />
                      </div>
                      <span className="text-[10px] font-bold text-[#AFAFAF]">{t.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Theo loại kho */}
            <section className="duo-card p-5 flex flex-col gap-3">
              <h2 className="text-base font-black text-[#4B4B4B]">Doanh thu theo loại kho</h2>
              {(data.byUnitType || []).length === 0 && <p className="text-xs font-bold text-[#AFAFAF]">Chưa có doanh thu</p>}
              {(data.byUnitType || []).map((u) => (
                <div key={u.typeId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#4B4B4B]">{u.typeName} <span className="text-[#AFAFAF]">· {u.totalRented} lượt thuê</span></span>
                    <span className="font-black text-[#4B4B4B]">{formatVND(u.revenue)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                    <div className="h-full bg-[#1CB0F6]" style={{ width: `${Math.min(100, Number(u.percentage || 0))}%` }} />
                  </div>
                </div>
              ))}
            </section>

            {/* Quá hạn */}
            <section className="duo-card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-[#4B4B4B]">Hợp đồng quá hạn ({overdue.length})</h2>
                <Link to="/manager/overdue" className="text-xs font-black text-[#1CB0F6] hover:underline">Xử lý →</Link>
              </div>
              <p className="text-xs font-bold text-[#777777]">Phí trễ đang tích luỹ: <span className="font-black text-[#FF4B4B]">{formatVND(overdueFeeTotal)}</span></p>
              {overdue.length === 0 && <p className="text-xs font-bold text-[#AFAFAF]">Không có hợp đồng quá hạn 🎉</p>}
              {overdue.slice(0, 6).map((c) => (
                <div key={c.contractId} className="flex items-center justify-between gap-3 border-b-2 border-[#F7F7F7] pb-2 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#4B4B4B] truncate">#{c.contractCode} · {c.customerName}</p>
                    <p className="text-[11px] font-bold text-[#AFAFAF]">Ô {c.storageUnitId} · quá hạn {c.overdueDays} ngày</p>
                  </div>
                  <span className={`text-xs font-black ${c.lateFeeWaived ? 'text-[#58A700]' : 'text-[#FF4B4B]'}`}>
                    {c.lateFeeWaived ? 'Đã miễn phí trễ' : formatVND(c.lateFeeAmount)}
                  </span>
                </div>
              ))}
            </section>
          </div>

          {/* Giao dịch */}
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-black text-[#4B4B4B]">Giao dịch gần nhất</h2>
            <div className="duo-card overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b-2 border-[#E5E5E5]">
                    {['Thời gian', 'Khách hàng', 'Hợp đồng', 'Loại', 'Phương thức', 'Số tiền'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm font-black text-[#AFAFAF]">Chưa có giao dịch</td></tr>
                  )}
                  {transactions.slice(0, 15).map((t) => (
                    <tr key={t.id} className="border-b-2 border-[#F7F7F7] last:border-b-0">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-[#777777]">{formatTime(t.paidAt)}</td>
                      <td className="px-4 py-3 font-bold text-[#4B4B4B]">{t.customerName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#777777]">{t.contractCode || '—'}</td>
                      <td className="px-4 py-3 font-bold text-[#4B4B4B]">{TYPE_LABELS[t.paymentType] || t.paymentType}</td>
                      <td className="px-4 py-3 font-bold text-[#777777]">{METHOD_LABELS[t.paymentMethod] || t.paymentMethod}</td>
                      <td className={`px-4 py-3 font-black whitespace-nowrap ${t.paymentType === 'REFUND' ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
                        {t.paymentType === 'REFUND' ? '−' : '+'}{formatVND(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length > 15 && (
              <p className="text-xs font-bold text-[#AFAFAF]">Hiển thị 15 / {transactions.length} giao dịch — bấm "Xuất CSV" để lấy đầy đủ.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
