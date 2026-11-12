import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getOverdueContracts,
  addOverdueContact,
  getOverdueContactLogs,
  liquidateContract,
  refundRemainingDeposit,
  waiveLateFee,
} from '../../services/contractService'
import SimulationButton from '../../components/SimulationButton'
import { simulateFailedContacts, simulateOverdue } from '../../services/simulationService'
import PaginationBar, { ListBoxHeader } from '../../components/PaginationBar'
import ContractDetailModal from '../../components/ContractDetailModal'
import TimeFilterBar from '../../components/TimeFilterBar'
import { applyTimeFilter, makeTimeFilter } from '../../utils/timeFilter'
import { getOverdueFeeBreakdown } from '../../utils/overdueFee'

const PAGE_SIZE = 5

// (10/11/2026) Lọc / sắp theo thời gian — mặc định hết hạn sớm nhất (quá hạn lâu nhất) lên trên
const TIME_FIELDS = [
  { key: 'endDate', label: 'Ngày hết hạn', get: (c) => c.endDate },
  { key: 'lastContactAt', label: 'Lần liên hệ gần nhất', get: (c) => c.lastContactAt },
]

function formatVND(v) {
  if (v == null || isNaN(v)) return '0₫'
  return Number(v).toLocaleString('vi-VN') + '₫'
}

function formatDate(val) {
  if (!val) return '—'
  const [y, m, d] = String(val).split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(val) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return String(val)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${mins} ${day}/${month}/${year}`
  } catch {
    return String(val)
  }
}

export default function OverdueContractsPage() {
  const navigate = useNavigate()
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const managerId = user.userId || user.id

  const [activeTab, setActiveTab] = useState('OVERDUE') // 'OVERDUE' | 'LIQUIDATED'
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [successToast, setSuccessToast] = useState('')
  const [timeFilter, setTimeFilter] = useState(() => makeTimeFilter(TIME_FIELDS))
  // (10/11/2026) Xem hợp đồng bằng popup thay vì rời trang
  const [peekId, setPeekId] = useState(null)

  // Modal 1: Ghi chú liên hệ
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [contactLogs, setContactLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [contactNote, setContactNote] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState('')

  // Modal 2: Thanh lý hợp đồng
  const [liquidateModalOpen, setLiquidateModalOpen] = useState(false)
  const [liquidateContractTarget, setLiquidateContractTarget] = useState(null)
  const [liquidateNote, setLiquidateNote] = useState('')
  const [liquidateSubmitting, setLiquidateSubmitting] = useState(false)
  const [liquidateError, setLiquidateError] = useState('')

  // Action Hoàn tiền cọc còn lại
  const [refundSubmittingId, setRefundSubmittingId] = useState(null)

  // Modal 3 (Flow 6): Miễn phí trễ — chỉ khi chính sách cơ sở cho phép (BOM bật)
  const [waiveTarget, setWaiveTarget] = useState(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [waiveOverstay, setWaiveOverstay] = useState(false)
  const [waiveSubmitting, setWaiveSubmitting] = useState(false)
  const [waiveError, setWaiveError] = useState('')

  const handleSubmitWaive = async (e) => {
    e.preventDefault()
    const reason = waiveReason.trim()
    if (reason.length < 5 || reason.length > 400) {
      setWaiveError('Lý do miễn phí trễ bắt buộc, từ 5 đến 400 ký tự.')
      return
    }
    setWaiveSubmitting(true)
    setWaiveError('')
    try {
      await waiveLateFee(waiveTarget.contractId, reason, waiveOverstay)
      setSuccessToast(`Đã miễn phí trễ${waiveOverstay ? ' và phí chiếm dụng' : ''} cho HĐ #${waiveTarget.contractCode}.`)
      setTimeout(() => setSuccessToast(''), 4000)
      setWaiveTarget(null)
      fetchContracts()
    } catch (err) {
      setWaiveError(err.response?.data?.message || 'Không miễn được phí trễ, vui lòng thử lại.')
    } finally {
      setWaiveSubmitting(false)
    }
  }

  const fetchContracts = () => {
    if (!managerId) return
    setLoading(true)
    setError('')
    getOverdueContracts(managerId, activeTab)
      .then((data) => {
        setContracts(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.response?.data?.error || 'Không tải được danh sách hợp đồng.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchContracts()
  }, [managerId, activeTab])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, search, timeFilter])

  // Xử lý mở Modal Ghi chú liên hệ
  const handleOpenContactModal = async (c) => {
    setSelectedContract(c)
    setContactNote('')
    setContactError('')
    setContactModalOpen(true)
    setLogsLoading(true)
    try {
      const logs = await getOverdueContactLogs(c.contractId, managerId)
      setContactLogs(Array.isArray(logs) ? logs : [])
    } catch (err) {
      setContactLogs([])
      setContactError(err.response?.data?.message || 'Không thể tải lịch sử liên hệ.')
    } finally {
      setLogsLoading(false)
    }
  }

  // Submit ghi chú liên hệ
  const handleSubmitContactLog = async (e) => {
    e.preventDefault()
    if (!contactNote.trim()) {
      setContactError('Vui lòng nhập nội dung liên hệ.')
      return
    }
    if (contactNote.length > 400) {
      setContactError('Nội dung không được vượt quá 400 ký tự.')
      return
    }
    setContactSubmitting(true)
    setContactError('')
    try {
      await addOverdueContact(selectedContract.contractId, {
        managerId,
        note: contactNote.trim(),
      })
      setSuccessToast(`Đã lưu ghi chú liên hệ cho HĐ #${selectedContract.contractCode}`)
      setTimeout(() => setSuccessToast(''), 4000)
      setContactModalOpen(false)
      fetchContracts()
    } catch (err) {
      setContactError(err.response?.data?.message || err.response?.data?.error || 'Không thể lưu ghi chú.')
    } finally {
      setContactSubmitting(false)
    }
  }

  // Xử lý mở Modal Thanh lý
  const handleOpenLiquidateModal = (c) => {
    setLiquidateContractTarget(c)
    setLiquidateNote('')
    setLiquidateError('')
    setLiquidateModalOpen(true)
  }

  // Submit thanh lý hợp đồng
  const handleSubmitLiquidate = async (e) => {
    e.preventDefault()
    if (!liquidateNote.trim()) {
      setLiquidateError('Bắt buộc nhập ghi chú quá trình liên hệ và lý do cưỡng chế dọn kho.')
      return
    }
    setLiquidateSubmitting(true)
    setLiquidateError('')
    try {
      await liquidateContract(liquidateContractTarget.contractId, {
        managerId,
        note: liquidateNote.trim(),
      })
      setSuccessToast(`Đã cưỡng chế dọn kho thành công hợp đồng #${liquidateContractTarget.contractCode}`)
      setTimeout(() => setSuccessToast(''), 4000)
      setLiquidateModalOpen(false)
      fetchContracts()
    } catch (err) {
      setLiquidateError(err.response?.data?.message || err.response?.data?.error || 'Cưỡng chế dọn kho thất bại.')
    } finally {
      setLiquidateSubmitting(false)
    }
  }

  // Xử lý hoàn tiền cọc còn lại sau thanh lý
  const handleRefundDeposit = async (c) => {
    setRefundSubmittingId(c.contractId)
    try {
      await refundRemainingDeposit(c.contractId, { managerId })
      navigate('/manager/refunds')
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Không thể tạo yêu cầu hoàn cọc.')
      setRefundSubmittingId(null)
    }
  }

  const filteredContracts = applyTimeFilter(contracts.filter((c) =>
    (c.contractCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerPhone || '').includes(search) ||
    (c.storageUnitId || '').toLowerCase().includes(search.toLowerCase())
  ), timeFilter, TIME_FIELDS)
  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedContracts = filteredContracts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  // PR-Q9 / PR-Q14 / PR-Q16: thanh lý trừ cọc phí trễ + phí chiếm dụng + phí dọn & di dời hàng; vượt cọc thành nợ của khách
  const liquidationCharge = liquidateContractTarget
    ? Number(liquidateContractTarget.lateFeeAmount || 0) + Number(liquidateContractTarget.overstayFeeAmount || 0)
      + Number(liquidateContractTarget.goodsMovingFeeAmount || 0)
    : 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Toast thông báo */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700] px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#4B4B4B] uppercase tracking-wide flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[28px]">event_busy</span>
            Quản lý Hợp Đồng Quá Hạn & Cưỡng Chế Dọn Kho
          </h1>
          <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider mt-1">
            Theo dõi công nợ, lịch sử đôn đốc và quy trình cưỡng chế dọn kho hợp đồng tại cơ sở
          </p>
          {/* PR-Q8 / PR-Q10: lịch liên hệ đề xuất để kịp cưỡng chế dọn kho khi quá 15 ngày */}
          <p className="text-[11px] font-bold text-[#777777] mt-1">
            Lịch liên hệ đề xuất: ngày quá hạn thứ 1 · 3 · 7 (đủ 3 lần). Quá mốc cưỡng chế dọn kho theo chính sách (bản mới 15 ngày) là được cưỡng chế dọn kho để ô sớm cho thuê lại.
          </p>
        </div>
      </div>

      {/* Segmented Tabs Duolingo style */}
      <div className="flex items-center gap-3 mb-6 border-b-2 border-[#E5E5E5] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('OVERDUE')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wide transition-all cursor-pointer ${
            activeTab === 'OVERDUE'
              ? 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600] shadow-xs'
              : 'text-[#777777] hover:bg-[#F7F7F7] border-2 border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">warning</span>
          <span>Đang Quá Hạn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LIQUIDATED')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wide transition-all cursor-pointer ${
            activeTab === 'LIQUIDATED'
              ? 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B] shadow-xs'
              : 'text-[#777777] hover:bg-[#F7F7F7] border-2 border-transparent'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">gavel</span>
          <span>Đã Cưỡng Chế Dọn Kho</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AFAFAF] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã HĐ, tên khách, SĐT, mã ô kho..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] focus:border-[#1CB0F6] focus:outline-none transition-colors"
          />
        </div>
        <span className="text-xs font-extrabold text-[#AFAFAF] uppercase tracking-wider">
          Tìm thấy: <strong className="text-[#4B4B4B]">{filteredContracts.length}</strong> hợp đồng
        </span>
        <TimeFilterBar className="w-full" value={timeFilter} onChange={setTimeFilter} fields={TIME_FIELDS} />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 mb-6 bg-[#FFF5F5] border-2 border-[#FFDFDF] rounded-2xl text-[#FF4B4B] text-xs font-black flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Table Content */}
      <div className="duo-card overflow-hidden">
        <ListBoxHeader
          icon={activeTab === 'OVERDUE' ? 'warning' : 'gavel'}
          title={activeTab === 'OVERDUE' ? 'Hợp đồng đang quá hạn' : 'Hợp đồng đã cưỡng chế dọn kho'}
          subtitle="Theo dõi công nợ, lịch sử đôn đốc và cưỡng chế dọn kho"
          count={filteredContracts.length}
          countLabel="hợp đồng"
          accentColor={
            activeTab === 'OVERDUE'
              ? 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]'
              : 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]'
          }
        />
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3">
            <span className="material-symbols-outlined text-[36px] text-[#58CC02] animate-spin">
              progress_activity
            </span>
            <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải dữ liệu...</span>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center gap-3">
            <span className="material-symbols-outlined text-[48px] text-[#AFAFAF]">
              {activeTab === 'OVERDUE' ? 'check_circle' : 'inventory_2'}
            </span>
            <p className="text-sm font-black text-[#777777]">
              {activeTab === 'OVERDUE'
                ? 'Không có hợp đồng nào đang quá hạn tại cơ sở.'
                : 'Chưa có hợp đồng nào bị cưỡng chế dọn kho tại cơ sở.'}
            </p>
          </div>
        ) : activeTab === 'OVERDUE' ? (
          /* TAB 1: ĐANG QUÁ HẠN */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E5E5E5] bg-[#FAFAFA] text-[#AFAFAF] uppercase font-black tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Mã Hợp Đồng</th>
                  <th className="py-3.5 px-4">Khách Hàng</th>
                  <th className="py-3.5 px-4">Ô Kho</th>
                  <th className="py-3.5 px-4 text-center">Quá Hạn</th>
                  <th className="py-3.5 px-4 text-right">Tổng Phạt (Trễ + Chiếm Dụng)</th>
                  <th className="py-3.5 px-4">Ghi Chú Đôn Đốc Gần Nhất</th>
                  <th className="py-3.5 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#F0F0F0]">
                {paginatedContracts.map((c) => {
                  const daysLeft = (c.liquidationDaysThreshold || 7) - (c.overdueDays || 0)
                  const { lateFee, overstayFee, totalPenalty, lateFeeWaived, overstayFeeWaived } = getOverdueFeeBreakdown(c)
                  return (
                    <tr key={c.contractId} className="hover:bg-[#F9F9F9] transition-colors">
                      <td className="py-3.5 px-4">
                        <button type="button" title="Xem hợp đồng" onClick={() => setPeekId(c.contractId)}
                          className="font-mono font-bold text-[#1CB0F6] hover:underline cursor-pointer">
                          #{c.contractCode}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#4B4B4B]">{c.customerName || '—'}</div>
                        <div className="text-[11px] text-[#AFAFAF] font-mono">{c.customerPhone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#4B4B4B]">
                        {c.storageUnitId || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-[#FFE8CC] text-[#E58800] border border-[#FF9600]">
                          {c.overdueDays || 1} ngày
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#FF4B4B]">
                        {totalPenalty === 0 && lateFeeWaived && overstayFeeWaived ? (
                          <span className="text-[#58A700]" title={c.lateFeeWaiverNote || ''}>0₫ (Đã miễn toàn bộ)</span>
                        ) : (
                          <span>{formatVND(totalPenalty)}</span>
                        )}
                        <div className="mt-0.5 space-y-0.5 text-[10px] font-bold text-[#777777]">
                          <div>
                            Phí trễ:{' '}
                            {lateFeeWaived ? (
                              <span className="text-[#58A700]" title={c.lateFeeWaiverNote || ''}>Đã miễn</span>
                            ) : formatVND(lateFee)}
                            {c.isMaxLateFeeReached && !lateFeeWaived ? <span className="text-[#FF9600]"> (trần cọc)</span> : null}
                          </div>
                          <div title="Phí chiếm dụng ô: giá ngày × % chính sách × số ngày quá hạn">
                            Chiếm dụng:{' '}
                            {overstayFeeWaived ? (
                              <span className="text-[#58A700]">Đã miễn</span>
                            ) : formatVND(overstayFee)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {c.lastContactNote ? (
                          <div>
                            <p className="text-xs text-[#4B4B4B] line-clamp-2" title={c.lastContactNote}>
                              "{c.lastContactNote}"
                            </p>
                            <span className="text-[10px] text-[#AFAFAF]">
                              {formatDateTime(c.lastContactAt || c.lastContactedAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#AFAFAF] italic">Chưa ghi nhận</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenContactModal(c)}
                            className="px-3 py-1.5 rounded-xl border-2 border-[#1CB0F6] bg-[#DDF4FF] text-[#1CB0F6] hover:bg-[#84D8FF]/30 font-black text-[11px] uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[15px]">call</span>
                            <span>Liên hệ</span>
                          </button>

                          {!c.lateFeeWaived && Number(c.lateFeeAmount) > 0 && (
                            <button
                              type="button"
                              onClick={() => { setWaiveTarget(c); setWaiveReason(''); setWaiveOverstay(false); setWaiveError('') }}
                              className="px-3 py-1.5 rounded-xl border-2 border-[#58CC02] bg-[#D7FFB8] text-[#58A700] hover:bg-[#c4f59c] font-black text-[11px] uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">volunteer_activism</span>
                              <span>Miễn phí trễ</span>
                            </button>
                          )}

                          {c.canLiquidate && (c.contactCount || 0) >= (c.minContactsRequired || 3) ? (
                            <button
                              type="button"
                              onClick={() => handleOpenLiquidateModal(c)}
                              className="px-3 py-1.5 rounded-xl border-2 border-[#FF4B4B] bg-[#FFDFDF] text-[#FF4B4B] hover:bg-red-200 font-black text-[11px] uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1 shadow-xs whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-[15px]">gavel</span>
                              <span>Cưỡng chế dọn kho</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title={c.canLiquidate
                                ? `Cần ghi nhận ít nhất ${c.minContactsRequired || 3} lần liên hệ khách trước khi cưỡng chế dọn kho (Điều khoản xử lý tài sản)`
                                : `Còn ${daysLeft > 0 ? daysLeft : 0} ngày nữa mới đủ điều kiện cưỡng chế dọn kho`}
                              className="px-3 py-1.5 rounded-xl border-2 border-[#E5E5E5] bg-[#F7F7F7] text-[#AFAFAF] font-black text-[11px] uppercase tracking-wide cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined text-[15px]">gavel</span>
                              <span>Cưỡng chế dọn kho</span>
                              <span className="text-[9px] font-normal lowercase">
                                ({c.canLiquidate ? `${c.contactCount || 0}/${c.minContactsRequired || 3} liên hệ` : `${daysLeft}d`})
                              </span>
                            </button>
                          )}

                          {/* Demo: tua qua mốc cưỡng chế dọn kho của chính sách (bản mới 15 ngày) để bật nút */}
                          {!c.canLiquidate && (
                            <SimulationButton
                              label={`${(c.liquidationDaysThreshold || 15) + 1} ngày`}
                              description={`Cho HĐ #${c.contractCode} quá hạn ${(c.liquidationDaysThreshold || 15) + 1} ngày để vượt mốc ${c.liquidationDaysThreshold || 15} ngày và bật nút Cưỡng chế dọn kho.`}
                              onRun={() => simulateOverdue(c.contractId, (c.liquidationDaysThreshold || 15) + 1)}
                              onDone={() => fetchContracts()}
                            />
                          )}
                          {/* Demo: đã gọi khách 3 lần không được → đủ điều kiện liên hệ để cưỡng chế dọn kho */}
                          {c.canLiquidate && (c.contactCount || 0) < (c.minContactsRequired || 3) && (
                            <SimulationButton
                              label="3 lần liên hệ"
                              description={`Ghi ${c.minContactsRequired || 3} lần gọi khách HĐ #${c.contractCode} không nghe máy (cách nhau 1 tuần) để đủ điều kiện cưỡng chế dọn kho theo điều khoản.`}
                              onRun={() => simulateFailedContacts(c.contractId)}
                              onDone={() => fetchContracts()}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: ĐÃ THANH LÝ */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E5E5E5] bg-[#FAFAFA] text-[#AFAFAF] uppercase font-black tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Mã Hợp Đồng</th>
                  <th className="py-3.5 px-4">Khách Hàng</th>
                  <th className="py-3.5 px-4">Ô Kho</th>
                  <th className="py-3.5 px-4 text-right">Tổng Phạt Khấu Trừ</th>
                  <th className="py-3.5 px-4 text-right">Còn Giữ Cọc</th>
                  <th className="py-3.5 px-4 text-center">Trạng Thái Hoàn</th>
                  <th className="py-3.5 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#F0F0F0]">
                {paginatedContracts.map((c) => {
                  const held = Number(c.depositHeldAmount || 0)
                  const isRefunding = refundSubmittingId === c.contractId
                  const fee = getOverdueFeeBreakdown(c)
                  return (
                    <tr key={c.contractId} className="hover:bg-[#F9F9F9] transition-colors">
                      <td className="py-3.5 px-4">
                        <button type="button" title="Xem hợp đồng" onClick={() => setPeekId(c.contractId)}
                          className="font-mono font-bold text-[#1CB0F6] hover:underline cursor-pointer">
                          #{c.contractCode}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#4B4B4B]">{c.customerName || '—'}</div>
                        <div className="text-[11px] text-[#AFAFAF] font-mono">{c.customerPhone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#4B4B4B]">
                        {c.storageUnitId || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#FF4B4B]">
                        <div>{formatVND(fee.totalPenalty)}</div>
                        {(fee.overstayFee > 0 || fee.lateFeeWaived || fee.overstayFeeWaived) && (
                          <div className="text-[10px] text-[#777777] font-bold">
                            Trễ: {fee.lateFeeWaived ? 'Miễn' : formatVND(fee.lateFee)} · Chiếm dụng: {fee.overstayFeeWaived ? 'Miễn' : formatVND(fee.overstayFee)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#58CC02] text-sm">
                        {formatVND(held)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {c.refundRequested ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#DDF4FF] text-[#1CB0F6] border border-[#84D8FF]">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            Đã tạo lệnh hoàn
                          </span>
                        ) : held > 0 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#FFE8CC] text-[#E58800] border border-[#FF9600]">
                            Chờ quản lý tạo lệnh
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-[#F7F7F7] text-[#777777] border border-[#E5E5E5]">
                            Đã khấu trừ hết cọc
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {c.refundRequested ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 rounded-xl border-2 border-[#E5E5E5] bg-[#F7F7F7] text-[#AFAFAF] font-black text-[11px] uppercase tracking-wide cursor-not-allowed"
                          >
                            Đã tạo lệnh hoàn
                          </button>
                        ) : held > 0 ? (
                          <button
                            type="button"
                            disabled={isRefunding}
                            onClick={() => handleRefundDeposit(c)}
                            className="px-3 py-1.5 rounded-xl border-2 border-[#58CC02] bg-[#D7FFB8] text-[#58A700] hover:bg-[#58CC02] hover:text-white font-black text-[11px] uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1 mx-auto disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">payments</span>
                            <span>{isRefunding ? 'Đang tạo...' : 'Hoàn phần cọc còn lại'}</span>
                          </button>
                        ) : (
                          <span className="text-[#AFAFAF] text-xs font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredContracts.length > 0 && (
          <PaginationBar
            currentPage={safePage}
            totalItems={filteredContracts.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="hợp đồng"
          />
        )}
      </div>

      {/* MODAL 1: GHI CHÚ LIÊN HỆ */}
      {contactModalOpen && selectedContract && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-[540px] max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1CB0F6] text-[24px]">call</span>
                <h3 className="text-base font-black text-[#4B4B4B] uppercase">
                  Đôn đốc HĐ #{selectedContract.contractCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[#AFAFAF] font-bold uppercase text-[10px] block">Khách hàng</span>
                  <span className="font-bold text-[#4B4B4B]">{selectedContract.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#AFAFAF] font-bold uppercase text-[10px] block">Số điện thoại</span>
                  <span className="font-mono font-bold text-[#1CB0F6]">{selectedContract.customerPhone}</span>
                </div>
              </div>

              {/* Lịch sử liên hệ */}
              <div>
                <h4 className="text-xs font-black uppercase text-[#4B4B4B] mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#AFAFAF]">history</span>
                  Lịch sử liên hệ ({contactLogs.length})
                </h4>
                {logsLoading ? (
                  <div className="py-6 text-center text-xs text-[#AFAFAF] flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Đang tải lịch sử...
                  </div>
                ) : contactLogs.length === 0 ? (
                  <p className="text-xs text-[#AFAFAF] italic py-2">Chưa có ghi chú liên hệ nào.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {contactLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-[#AFAFAF] mb-1">
                          <span className="font-bold text-[#777777]">{log.managerName || 'Quản lý'}</span>
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                        <p className="text-[#4B4B4B] font-medium leading-relaxed">{log.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form thêm ghi chú mới */}
              <form onSubmit={handleSubmitContactLog} className="flex flex-col gap-3 pt-2 border-t border-slate-200">
                {contactError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{contactError}</span>
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black uppercase text-[#4B4B4B]">
                      Thêm ghi chú đôn đốc mới:
                    </label>
                    <span className={`text-[11px] font-bold ${contactNote.length > 380 ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
                      {contactNote.length} / 400
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    placeholder="VD: Đã gọi khách lần 2, khách hẹn thứ 6 đến thanh toán phí trễ và nhận lại đồ..."
                    className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-[#1CB0F6] focus:outline-none text-xs text-[#4B4B4B] resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(false)}
                    className="px-4 py-2 rounded-xl border-2 border-[#E5E5E5] text-[#777777] font-bold text-xs hover:bg-[#F7F7F7] cursor-pointer"
                  >
                    HỦY
                  </button>
                  <button
                    type="submit"
                    disabled={contactSubmitting || !contactNote.trim()}
                    className="px-5 py-2 rounded-xl bg-[#1CB0F6] hover:bg-[#1899D6] text-white font-black text-xs uppercase tracking-wide cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    {contactSubmitting ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>Lưu ghi chú</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: XÁC NHẬN THANH LÝ HỢP ĐỒNG */}
      {liquidateModalOpen && liquidateContractTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-[560px] max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-red-100 bg-red-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#FF4B4B]">
                <span className="material-symbols-outlined text-[24px]">gavel</span>
                <h3 className="text-base font-black uppercase">
                  Xác nhận cưỡng chế dọn kho HĐ #{liquidateContractTarget.contractCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLiquidateModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmitLiquidate} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {liquidateError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{liquidateError}</span>
                </div>
              )}

              {/* Điều khoản xử lý tài sản: khách đã đồng ý chưa → có được bán thanh lý hàng sau 60 ngày lưu giữ không */}
              {liquidateContractTarget.termsVersion ? (
                <div className="p-3 rounded-xl bg-[#D7FFB8]/50 border border-[#58CC02] text-xs font-bold text-[#4B4B4B] flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#58A700]">verified</span>
                  <span>
                    Khách đã đồng ý <b>Điều khoản xử lý tài sản ({liquidateContractTarget.termsVersion})</b> khi đặt kho:
                    sau cưỡng chế dọn kho sẽ mở kho, kiểm kê, lưu giữ hàng 60 ngày, quá hạn được bán thanh lý để trừ nợ.
                    Hệ thống sẽ sinh task <b>Cưỡng chế dọn kho</b>.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#FFF8E1] border border-[#FFC800] text-xs font-bold text-[#4B4B4B] flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#B78900]">warning</span>
                  <span>
                    Đơn cũ — khách <b>chưa đồng ý</b> điều khoản xử lý tài sản: chỉ được lưu giữ hàng và trả lại khách
                    hoặc giao cơ quan chức năng, <b>không được bán</b>. Hệ thống vẫn sinh task Cưỡng chế dọn kho.
                  </span>
                </div>
              )}

              {/* Thông tin tài chính khấu trừ */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[#777777]">
                  <span>Tiền cọc ban đầu được bảo lưu:</span>
                  <span className="font-bold text-[#4B4B4B]">
                    {formatVND(liquidateContractTarget.depositHeldAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-red-600 font-black">
                  <span>Tổng tiền phạt quá hạn ({liquidateContractTarget.overdueDays} ngày):</span>
                  <span>-{formatVND(getOverdueFeeBreakdown(liquidateContractTarget).totalPenalty)}</span>
                </div>
                <div className="pl-3 space-y-1 border-l-2 border-red-200">
                  <div className="flex justify-between items-center text-red-600/90 font-bold">
                    <span>• Phí phạt trễ hạn:</span>
                    <span>-{formatVND(liquidateContractTarget.lateFeeAmount)}</span>
                  </div>
                  {Number(liquidateContractTarget.overstayFeeAmount) > 0 && (
                    <div className="flex justify-between items-center text-red-600/90 font-bold">
                      <span>• Phí chiếm dụng ô ({liquidateContractTarget.overdueDays} ngày):</span>
                      <span>-{formatVND(liquidateContractTarget.overstayFeeAmount)}</span>
                    </div>
                  )}
                </div>
                {Number(liquidateContractTarget.goodsMovingFeeAmount) > 0 && (
                  <div className="flex justify-between items-center text-red-600 font-bold">
                    <span>Phí dọn & di dời hàng sang khu lưu giữ:</span>
                    <span>-{formatVND(liquidateContractTarget.goodsMovingFeeAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-black">
                  <span className="text-[#4B4B4B] uppercase text-[11px]">Cọc còn lại sau cưỡng chế dọn kho:</span>
                  <span className="text-base text-[#58CC02]">
                    {formatVND(Math.max(0, Number(liquidateContractTarget.depositHeldAmount || 0) - liquidationCharge))}
                  </span>
                </div>
                {liquidationCharge > Number(liquidateContractTarget.depositHeldAmount || 0) && (
                  <div className="flex justify-between items-center text-[#FF4B4B] font-black">
                    <span>Vượt cọc → khoản nợ của khách:</span>
                    <span>{formatVND(liquidationCharge - Number(liquidateContractTarget.depositHeldAmount || 0))}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
                <div className="font-black flex items-center gap-1 text-amber-900">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Hành động cưỡng chế dọn kho sẽ kích hoạt:
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-900">
                  <li>Chuyển trạng thái HĐ sang <strong>LIQUIDATED</strong>.</li>
                  <li>Hủy toàn bộ mã PIN SmartLock và mã RFID của khách.</li>
                  <li>Chuyển khoang kho <strong>{liquidateContractTarget.storageUnitId}</strong> sang trạng thái bảo trì/dọn dẹp.</li>
                  <li>Hủy mọi yêu cầu trả kho đang mở.</li>
                </ul>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-[#4B4B4B] block mb-1">
                  Ghi chú quá trình liên hệ khách <span className="text-red-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  required
                  value={liquidateNote}
                  onChange={(e) => setLiquidateNote(e.target.value)}
                  placeholder="Ghi rõ các mốc liên hệ không thành công hoặc thỏa thuận cưỡng chế dọn kho với khách..."
                  className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-[#FF4B4B] focus:outline-none text-xs text-[#4B4B4B] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setLiquidateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border-2 border-[#E5E5E5] text-[#777777] font-bold text-xs hover:bg-[#F7F7F7] cursor-pointer"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={liquidateSubmitting || !liquidateNote.trim()}
                  className="px-5 py-2 rounded-xl bg-[#FF4B4B] hover:bg-red-600 text-white font-black text-xs uppercase tracking-wide cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {liquidateSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">gavel</span>
                      <span>Xác nhận cưỡng chế dọn kho</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3 (Flow 6): Miễn phí trễ */}
      {waiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b-2 border-[#E5E5E5] pb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700]">
                <span className="material-symbols-outlined text-[24px]">volunteer_activism</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-[#4B4B4B]">Miễn phí trễ HĐ #{waiveTarget.contractCode}</h3>
                {(() => {
                  const fee = getOverdueFeeBreakdown(waiveTarget)
                  return (
                    <p className="text-xs font-bold text-[#AFAFAF]">
                      {waiveTarget.customerName} · quá hạn {waiveTarget.overdueDays} ngày · tổng phạt {formatVND(fee.totalPenalty)}
                      {' '}(phí trễ {fee.lateFeeWaived ? '0₫ (đã miễn)' : formatVND(fee.lateFee)} + chiếm dụng {fee.overstayFeeWaived ? '0₫ (đã miễn)' : formatVND(fee.overstayFee)})
                    </p>
                  )
                })()}
              </div>
            </div>
            <p className="text-xs font-bold text-[#777777] leading-relaxed">
              Không thu phí trễ của đợt quá hạn này (khi gia hạn hoặc khi trả kho). Phí chiếm dụng mặc định vẫn tính 100% giá ngày
              (tiền thuê những ngày đã dùng ô, bỏ phần phạt) — có thể chọn miễn luôn bên dưới. Nếu khách bị cưỡng chế dọn kho, mọi khoản phí
              vẫn được trừ vào cọc theo quy định (D-09). Chỉ dùng được khi chính sách thuê của cơ sở cho phép.
            </p>
            <form onSubmit={handleSubmitWaive} className="flex flex-col gap-3">
              <label className="text-xs font-black uppercase text-[#4B4B4B]">
                Lý do miễn <span className="text-[#FF4B4B]">*</span>
              </label>
              <textarea
                rows={3}
                value={waiveReason}
                maxLength={400}
                onChange={(e) => { setWaiveReason(e.target.value); setWaiveError('') }}
                placeholder="VD: Khách nằm viện, đã liên hệ và cam kết gia hạn trong hôm nay..."
                className="duo-input w-full text-xs resize-none"
              />
              <label className="flex items-start gap-2 text-xs font-bold text-[#4B4B4B] cursor-pointer">
                <input type="checkbox" checked={waiveOverstay} onChange={(e) => setWaiveOverstay(e.target.checked)} className="mt-0.5" />
                <span>
                  Miễn luôn phí chiếm dụng
                  <span className="block text-[11px] text-[#AFAFAF]">Chọn khi lỗi không do khách hoặc có lý do đặc biệt — khách không trả tiền những ngày quá hạn.</span>
                </span>
              </label>
              {waiveError && (
                <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{waiveError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
                <button type="button" onClick={() => setWaiveTarget(null)} disabled={waiveSubmitting} className="duo-btn-gray px-4 py-2.5 text-xs">
                  Hủy
                </button>
                <button type="submit" disabled={waiveSubmitting} className="duo-btn-green px-5 py-2.5 text-xs gap-1.5 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {waiveSubmitting ? 'Đang lưu...' : 'Xác nhận miễn phí trễ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {peekId && (
        <ContractDetailModal
          key={peekId}
          contractId={peekId}
          onClose={() => { setPeekId(null); fetchContracts() }}
        />
      )}
    </div>
  )
}

