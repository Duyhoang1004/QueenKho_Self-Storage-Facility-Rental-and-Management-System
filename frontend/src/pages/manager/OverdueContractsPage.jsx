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
  const [successToast, setSuccessToast] = useState('')

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
      await waiveLateFee(waiveTarget.contractId, reason)
      setSuccessToast(`Đã miễn phí trễ cho HĐ #${waiveTarget.contractCode}. Khách gia hạn chỉ trả tiền thuê.`)
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
      setLiquidateError('Bắt buộc nhập ghi chú quá trình liên hệ và lý do thanh lý.')
      return
    }
    setLiquidateSubmitting(true)
    setLiquidateError('')
    try {
      await liquidateContract(liquidateContractTarget.contractId, {
        managerId,
        note: liquidateNote.trim(),
      })
      setSuccessToast(`Đã thanh lý thành công hợp đồng #${liquidateContractTarget.contractCode}`)
      setTimeout(() => setSuccessToast(''), 4000)
      setLiquidateModalOpen(false)
      fetchContracts()
    } catch (err) {
      setLiquidateError(err.response?.data?.message || err.response?.data?.error || 'Thanh lý hợp đồng thất bại.')
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

  const filteredContracts = contracts.filter((c) =>
    (c.contractCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerPhone || '').includes(search) ||
    (c.storageUnitId || '').toLowerCase().includes(search.toLowerCase())
  )

  // PR-Q9 / PR-Q14: thanh lý trừ cọc phí trễ + phí chiếm dụng; vượt cọc thành nợ OVERSTAY_FEE của khách
  const liquidationCharge = liquidateContractTarget
    ? Number(liquidateContractTarget.lateFeeAmount || 0) + Number(liquidateContractTarget.overstayFeeAmount || 0)
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
            Quản lý Hợp Đồng Quá Hạn & Thanh Lý
          </h1>
          <p className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wider mt-1">
            Theo dõi công nợ, lịch sử đôn đốc và quy trình thanh lý hợp đồng tại cơ sở
          </p>
          {/* PR-Q8 / PR-Q10: lịch liên hệ đề xuất để kịp thanh lý khi quá 15 ngày */}
          <p className="text-[11px] font-bold text-[#777777] mt-1">
            Lịch liên hệ đề xuất: ngày quá hạn thứ 1 · 3 · 7 (đủ 3 lần). Quá mốc thanh lý theo chính sách (bản mới 15 ngày) là được thanh lý để ô sớm cho thuê lại.
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
          <span>Đã Thanh Lý</span>
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
                : 'Chưa có hợp đồng nào bị thanh lý tại cơ sở.'}
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
                  <th className="py-3.5 px-4 text-right">Phí Trễ + Chiếm Dụng</th>
                  <th className="py-3.5 px-4">Ghi Chú Đôn Đốc Gần Nhất</th>
                  <th className="py-3.5 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#F0F0F0]">
                {filteredContracts.map((c) => {
                  const daysLeft = (c.liquidationDaysThreshold || 7) - (c.overdueDays || 0)
                  return (
                    <tr key={c.contractId} className="hover:bg-[#F9F9F9] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#4B4B4B]">
                        #{c.contractCode}
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
                        {c.lateFeeWaived ? (
                          <span className="text-[#58A700]" title={c.lateFeeWaiverNote || ''}>Đã miễn</span>
                        ) : formatVND(c.lateFeeAmount)}
                        {c.isMaxLateFeeReached && !c.lateFeeWaived && (
                          <div className="text-[10px] text-[#FF9600] font-bold">Chạm trần cọc</div>
                        )}
                        {/* PR-Q14: phí chiếm dụng (không trần) */}
                        {Number(c.overstayFeeAmount) > 0 && (
                          <div className="text-[10px] text-[#777777] font-bold" title="Phí chiếm dụng ô: giá ngày × % chính sách × số ngày quá hạn">
                            + chiếm dụng {formatVND(c.overstayFeeAmount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {c.lastContactNote ? (
                          <div>
                            <p className="text-xs text-[#4B4B4B] line-clamp-2" title={c.lastContactNote}>
                              "{c.lastContactNote}"
                            </p>
                            <span className="text-[10px] text-[#AFAFAF]">
                              {formatDateTime(c.lastContactedAt)}
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
                              onClick={() => { setWaiveTarget(c); setWaiveReason(''); setWaiveError('') }}
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
                              className="px-3 py-1.5 rounded-xl border-2 border-[#FF4B4B] bg-[#FFDFDF] text-[#FF4B4B] hover:bg-red-200 font-black text-[11px] uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[15px]">gavel</span>
                              <span>Thanh lý</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title={c.canLiquidate
                                ? `Cần ghi nhận ít nhất ${c.minContactsRequired || 3} lần liên hệ khách trước khi thanh lý (Điều khoản xử lý tài sản)`
                                : `Còn ${daysLeft > 0 ? daysLeft : 0} ngày nữa mới đủ điều kiện thanh lý`}
                              className="px-3 py-1.5 rounded-xl border-2 border-[#E5E5E5] bg-[#F7F7F7] text-[#AFAFAF] font-black text-[11px] uppercase tracking-wide cursor-not-allowed flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">gavel</span>
                              <span>Thanh lý</span>
                              <span className="text-[9px] font-normal lowercase">
                                ({c.canLiquidate ? `${c.contactCount || 0}/${c.minContactsRequired || 3} liên hệ` : `${daysLeft}d`})
                              </span>
                            </button>
                          )}

                          {/* Demo: tua qua mốc thanh lý của chính sách (bản mới 15 ngày) để bật nút Thanh lý */}
                          {!c.canLiquidate && (
                            <SimulationButton
                              label={`${(c.liquidationDaysThreshold || 15) + 1} ngày`}
                              description={`Cho HĐ #${c.contractCode} quá hạn ${(c.liquidationDaysThreshold || 15) + 1} ngày để vượt mốc thanh lý ${c.liquidationDaysThreshold || 15} ngày.`}
                              onRun={() => simulateOverdue(c.contractId, (c.liquidationDaysThreshold || 15) + 1)}
                              onDone={() => fetchContracts()}
                            />
                          )}
                          {/* Demo: đã gọi khách 3 lần không được → đủ điều kiện liên hệ để thanh lý */}
                          {c.canLiquidate && (c.contactCount || 0) < (c.minContactsRequired || 3) && (
                            <SimulationButton
                              label="3 lần liên hệ"
                              description={`Ghi ${c.minContactsRequired || 3} lần gọi khách HĐ #${c.contractCode} không nghe máy (cách nhau 1 tuần) để đủ điều kiện thanh lý theo điều khoản.`}
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
                  <th className="py-3.5 px-4 text-right">Phí Trễ Khấu Trừ</th>
                  <th className="py-3.5 px-4 text-right">Còn Giữ Cọc</th>
                  <th className="py-3.5 px-4 text-center">Trạng Thái Hoàn</th>
                  <th className="py-3.5 px-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#F0F0F0]">
                {filteredContracts.map((c) => {
                  const held = Number(c.depositHeldAmount || 0)
                  const isRefunding = refundSubmittingId === c.contractId
                  return (
                    <tr key={c.contractId} className="hover:bg-[#F9F9F9] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#4B4B4B]">
                        #{c.contractCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#4B4B4B]">{c.customerName || '—'}</div>
                        <div className="text-[11px] text-[#AFAFAF] font-mono">{c.customerPhone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#4B4B4B]">
                        {c.storageUnitId || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#FF4B4B]">
                        {formatVND(c.lateFeeAmount)}
                        {Number(c.overstayFeeAmount) > 0 && (
                          <div className="text-[10px] text-[#777777] font-bold">+ chiếm dụng {formatVND(c.overstayFeeAmount)}</div>
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
                  Xác nhận thanh lý HĐ #{liquidateContractTarget.contractCode}
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
                    sau thanh lý sẽ mở kho, kiểm kê, lưu giữ hàng 60 ngày, quá hạn được bán thanh lý để trừ nợ.
                    Hệ thống sẽ sinh task <b>Dọn kho sau thanh lý</b>.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#FFF8E1] border border-[#FFC800] text-xs font-bold text-[#4B4B4B] flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#B78900]">warning</span>
                  <span>
                    Đơn cũ — khách <b>chưa đồng ý</b> điều khoản xử lý tài sản: chỉ được lưu giữ hàng và trả lại khách
                    hoặc giao cơ quan chức năng, <b>không được bán</b>. Hệ thống vẫn sinh task Dọn kho sau thanh lý.
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
                <div className="flex justify-between items-center text-red-600 font-bold">
                  <span>Phí phạt quá hạn khấu trừ vào cọc:</span>
                  <span>-{formatVND(liquidateContractTarget.lateFeeAmount)}</span>
                </div>
                {Number(liquidateContractTarget.overstayFeeAmount) > 0 && (
                  <div className="flex justify-between items-center text-red-600 font-bold">
                    <span>Phí chiếm dụng ô ({liquidateContractTarget.overdueDays} ngày):</span>
                    <span>-{formatVND(liquidateContractTarget.overstayFeeAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-black">
                  <span className="text-[#4B4B4B] uppercase text-[11px]">Cọc còn lại sau thanh lý:</span>
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
                  Hành động thanh lý sẽ kích hoạt:
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
                  placeholder="Ghi rõ các mốc liên hệ không thành công hoặc thỏa thuận thanh lý với khách..."
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
                      <span>Xác nhận thanh lý</span>
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
                <p className="text-xs font-bold text-[#AFAFAF]">
                  {waiveTarget.customerName} · quá hạn {waiveTarget.overdueDays} ngày · phí trễ {formatVND(waiveTarget.lateFeeAmount)}
                </p>
              </div>
            </div>
            <p className="text-xs font-bold text-[#777777] leading-relaxed">
              Khách gia hạn sẽ chỉ trả tiền thuê, không thu phí trễ của đợt quá hạn này. Nếu khách không gia hạn và bị thanh lý,
              phí trễ vẫn được trừ vào cọc theo quy định (D-09). Chỉ dùng được khi chính sách thuê của cơ sở cho phép.
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
    </div>
  )
}

