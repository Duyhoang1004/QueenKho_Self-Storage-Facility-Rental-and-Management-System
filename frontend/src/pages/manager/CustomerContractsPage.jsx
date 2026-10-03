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
  ACTIVE:              { label: 'Đang hoạt động',        cls: 'bg-[#ECFDF5] text-[#10B981]' },
  TERMINATION_PENDING: { label: 'Chờ kiểm tra trả kho', cls: 'bg-orange-100 text-orange-800' },
  OVERDUE:             { label: 'Quá hạn',               cls: 'bg-[#FEF3C7] text-[#D97706]' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-[#F1F5F9] text-[#64748B]' },
  LIQUIDATED:          { label: 'Đã thanh lý',           cls: 'bg-[#FEE2E2] text-[#EF4444]' },
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-headline-md font-headline-md text-on-surface">Khách hàng & Hợp đồng</h1>
        <p className="text-body-md font-body-md text-on-surface-variant mt-1">
          Danh sách hợp đồng thuê kho tại cơ sở của bạn.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng hợp đồng',    value: stats.total,   icon: 'description',  color: 'text-primary' },
          { label: 'Đang hoạt động',   value: stats.active,  icon: 'check_circle', color: 'text-[#10B981]' },
          { label: 'Quá hạn',          value: stats.overdue, icon: 'warning',      color: 'text-[#D97706]' },
          { label: 'Đã kết thúc',      value: stats.ended,   icon: 'cancel',       color: 'text-[#64748B]' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-surface-container-high p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center flex-shrink-0">
              <span className={`material-symbols-outlined text-[22px] ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <p className="text-headline-sm font-headline-sm text-on-surface font-bold">
                {loading ? '—' : s.value}
              </p>
              <p className="text-body-sm font-body-sm text-on-surface-variant">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng, mã hợp đồng, ô kho..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-container-high overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-on-surface-variant text-[32px] animate-spin">
              progress_activity
            </span>
            <span className="text-body-md text-on-surface-variant">Đang tải danh sách hợp đồng...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="material-symbols-outlined text-error text-[40px]">error</span>
            <p className="text-body-md text-error">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-[48px]">description</span>
            <p className="text-body-md text-on-surface-variant font-semibold">
              {search ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có hợp đồng nào tại cơ sở này.'}
            </p>
            {!search && (
              <p className="text-body-sm text-on-surface-variant">
                Hợp đồng sẽ được tạo tự động sau khi bạn gán ô kho cho khách.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-surface-container-high bg-surface-container-low">
                  {['Mã HĐ', 'Khách hàng', 'Ô kho', 'Ngày BĐ', 'Ngày KT', 'Tiền cọc giữ', 'Trạng thái', ''].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filtered.map(c => {
                  const statusInfo = STATUS_MAP[c.status] || { label: c.status, cls: 'bg-surface-container text-on-surface-variant' }
                  return (
                    <tr key={c.contractId} className="hover:bg-surface-container-low/50 transition-colors">
                      {/* Mã HĐ */}
                      <td className="px-4 py-3">
                        <span className="text-body-sm font-body-sm text-secondary font-semibold font-mono">
                          {c.contractCode}
                        </span>
                      </td>

                      {/* Khách hàng */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold flex-shrink-0">
                            {initials(c.customerFullName)}
                          </div>
                          <div>
                            <p className="text-body-sm font-body-sm text-on-surface font-semibold whitespace-nowrap">
                              {c.customerFullName}
                            </p>
                            <p className="text-label-sm font-label-sm text-on-surface-variant">{c.customerPhone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Ô kho */}
                      <td className="px-4 py-3">
                        <p className="text-body-sm font-body-sm text-on-surface font-mono">{c.storageUnitId}</p>
                        <p className="text-label-sm font-label-sm text-on-surface-variant whitespace-nowrap">
                          {c.unitTypeName} • {c.areaSqm}m²
                        </p>
                      </td>

                      {/* Ngày BĐ */}
                      <td className="px-4 py-3 text-body-sm font-body-sm text-on-surface whitespace-nowrap">
                        {formatDate(c.startDate)}
                      </td>

                      {/* Ngày KT */}
                      <td className="px-4 py-3 text-body-sm font-body-sm text-on-surface whitespace-nowrap">
                        {formatDate(c.endDate)}
                      </td>

                      {/* Tiền cọc */}
                      <td className="px-4 py-3 text-body-sm font-body-sm text-on-surface font-semibold whitespace-nowrap">
                        {formatVND(c.depositHeldAmount)}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-4 py-3">
                        <span className={`text-label-sm font-label-sm px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Nút xem HĐ */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/manager/contracts/${c.contractId}`)}
                          className="flex items-center gap-1 text-secondary text-label-sm font-label-sm hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          Xem HĐ
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
          <div className="border-t border-surface-container px-4 py-2.5">
            <p className="text-label-sm font-label-sm text-on-surface-variant">
              Hiển thị <span className="font-semibold text-on-surface">{filtered.length}</span> / {contracts.length} hợp đồng
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
