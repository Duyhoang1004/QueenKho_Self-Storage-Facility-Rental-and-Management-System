import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getContractsByManager } from '../../services/contractService'

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function formatDate(val) {
  if (!val) return '—'
  const [y, m, d] = String(val).split('-')
  return `${d}/${m}/${y}`
}

const STATUS_MAP = {
  ACTIVE:              { label: 'Đang hoạt động',        cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]' },
  TERMINATION_PENDING: { label: 'Chờ kiểm tra trả kho', cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]' },
  OVERDUE:             { label: 'Quá hạn',               cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' },
  LIQUIDATED:          { label: 'Đã thanh lý',           cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
}

function initials(name) {
  if (!name) return 'KH'
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

export default function CustomerContractsPage() {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const managerId = user.userId

  useEffect(() => {
    if (!managerId) return
    setLoading(true)
    getContractsByManager(managerId)
      .then(setContracts)
      .catch(err => setError(err.response?.data?.error || 'Không tải được danh sách hợp đồng.'))
      .finally(() => setLoading(false))
  }, [managerId])

  const filtered = contracts.filter(c =>
    c.customerFullName?.toLowerCase().includes(search.toLowerCase()) ||
    c.contractCode?.toLowerCase().includes(search.toLowerCase()) ||
    c.storageUnitId?.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:   contracts.length,
    active:  contracts.filter(c => c.status === 'ACTIVE').length,
    overdue: contracts.filter(c => c.status === 'OVERDUE').length,
    ended:   contracts.filter(c => c.status === 'TERMINATED' || c.status === 'LIQUIDATED').length,
  }

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      {/* Header */}
      <div className="pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <h1 className="text-3xl font-black text-[#4B4B4B] tracking-tight">Khách Hàng & Hợp Đồng</h1>
        <p className="text-xs font-bold text-[#AFAFAF] mt-1 uppercase tracking-wider">
          Danh sách toàn bộ hợp đồng thuê kho tự quản tại chi nhánh cơ sở của bạn.
        </p>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng hợp đồng',    value: stats.total,   icon: 'description',  color: 'text-[#1CB0F6]', bgColor: 'bg-[#DDF4FF]', borderColor: 'border-[#1CB0F6]' },
          { label: 'Đang hoạt động',   value: stats.active,  icon: 'check_circle', color: 'text-[#58CC02]', bgColor: 'bg-[#D7FFB8]', borderColor: 'border-[#58CC02]' },
          { label: 'Quá hạn nợ',       value: stats.overdue, icon: 'warning',      color: 'text-[#FF9600]', bgColor: 'bg-[#FFE8CC]', borderColor: 'border-[#FF9600]' },
          { label: 'Đã kết thúc',      value: stats.ended,   icon: 'cancel',       color: 'text-[#777777]', bgColor: 'bg-[#F7F7F7]', borderColor: 'border-[#E5E5E5]' },
        ].map(s => (
          <div key={s.label} className="duo-card p-4 flex items-center gap-3.5 hover:border-[#1CB0F6] transition-all">
            <div className={`w-12 h-12 rounded-2xl ${s.bgColor} border-2 border-b-4 ${s.borderColor} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[24px] ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] block">{s.label}</span>
              <p className="text-2xl font-black text-[#4B4B4B] mt-0.5">
                {loading ? '—' : s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, mã hợp đồng, mã ô kho..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="duo-input w-full pl-11 text-xs"
          />
        </div>
      </div>

      {/* Table Duolingo Card */}
      <div className="duo-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-[#58CC02] text-[36px] animate-spin">
              progress_activity
            </span>
            <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải danh sách hợp đồng...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[40px]">error</span>
            <p className="text-xs font-black text-[#FF4B4B]">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <span className="material-symbols-outlined text-[#AFAFAF] text-[48px]">description</span>
            <p className="text-sm font-black text-[#4B4B4B]">
              {search ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có hợp đồng nào tại cơ sở này.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
                <tr>
                  {['Mã HĐ', 'Khách hàng', 'Ô kho', 'Ngày BĐ', 'Ngày KT', 'Tiền cọc giữ', 'Trạng thái', 'Thao tác'].map(h => (
                    <th
                      key={h}
                      className="text-left px-5 py-3.5 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#E5E5E5] text-xs font-bold text-[#4B4B4B]">
                {filtered.map(c => {
                  const statusInfo = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' }
                  return (
                    <tr key={c.contractId} className="hover:bg-[#FDFDFD] transition-colors">
                      {/* Mã HĐ */}
                      <td className="px-5 py-4 font-black font-mono text-[#1CB0F6]">
                        {c.contractCode}
                      </td>

                      {/* Khách hàng */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#58CC02] border-b border-[#58A700] text-white flex items-center justify-center font-black text-xs shrink-0">
                            {initials(c.customerFullName)}
                          </div>
                          <div>
                            <p className="font-black text-[#4B4B4B] whitespace-nowrap">
                              {c.customerFullName}
                            </p>
                            <p className="text-[11px] font-bold text-[#AFAFAF]">{c.customerPhone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Ô kho */}
                      <td className="px-5 py-4">
                        <p className="font-black text-[#4B4B4B]">{c.storageUnitId}</p>
                        <p className="text-[11px] font-bold text-[#AFAFAF] whitespace-nowrap">
                          {c.unitTypeName} • {c.areaSqm}m²
                        </p>
                      </td>

                      {/* Ngày BĐ */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {formatDate(c.startDate)}
                      </td>

                      {/* Ngày KT */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {formatDate(c.endDate)}
                      </td>

                      {/* Tiền cọc */}
                      <td className="px-5 py-4 font-black text-[#58CC02] whitespace-nowrap">
                        {formatVND(c.depositHeldAmount)}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`duo-badge ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Nút xem HĐ */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/manager/contracts/${c.contractId}`)}
                          className="duo-btn-green px-3 py-1.5 text-[11px]"
                        >
                          <span className="material-symbols-outlined text-[15px] mr-1">open_in_new</span>
                          <span>XEM HĐ</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!loading && !error && filtered.length > 0 && (
          <div className="border-t-2 border-[#E5E5E5] px-6 py-3 bg-[#FAFAFA]">
            <p className="text-xs font-bold text-[#AFAFAF]">
              Hiển thị <span className="font-black text-[#4B4B4B]">{filtered.length}</span> / {contracts.length} hợp đồng
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
