// (10/11/2026) Nội dung chi tiết hợp đồng dùng chung cho trang /manager/contracts/:id
// và popup ContractDetailModal (xem hợp đồng không phải mở tab mới → không mất phiên đăng nhập).
import { useEffect, useState } from 'react'
import { getContractDetail, rejectRenewalReassign } from '../services/contractService'
import SimulationButton from './SimulationButton'
import TransferUnitModal from './TransferUnitModal'
import ContractHandoverSection from './ContractHandoverSection'
import ContractProtectionPanel from './ContractProtectionPanel'
import UnitAccessModal from './UnitAccessModal'
import { simulateExpireSoon, simulateOverdue } from '../services/simulationService'
import { getOverdueFeeBreakdown } from '../utils/overdueFee'

// BR-122: hợp đồng còn giữ ô và chưa quá hạn mới chuyển ô được
const TRANSFERABLE_STATUSES = ['PENDING_CHECK_IN', 'ACTIVE', 'TERMINATION_PENDING']

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
  PENDING_CHECK_IN:    { label: 'Chờ check-in',          cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]', icon: 'schedule' },
  ACTIVE:             { label: 'Đang hoạt động',        cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]', icon: 'check_circle' },
  TERMINATION_PENDING: { label: 'Chờ kiểm tra trả kho', cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'schedule' },
  SETTLEMENT_PENDING:  { label: 'Đang tất toán trả kho', cls: 'bg-[#DDF4FF] text-[#1899D6] border-2 border-[#84D8FF]', icon: 'how_to_reg' }, // D-21
  OVERDUE:             { label: 'Quá hạn thanh toán',    cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'warning' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]', icon: 'cancel' },
  LIQUIDATED:          { label: 'Đã cưỡng chế dọn kho',  cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]', icon: 'gavel' },
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{label}</span>
      <span className={`text-sm font-black text-[#4B4B4B] ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div className="duo-card p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-[#E5E5E5]">
        <span className="material-symbols-outlined text-[#1CB0F6] text-[24px]">{icon}</span>
        <h2 className="text-sm font-black uppercase text-[#4B4B4B]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/**
 * @param contractId      id hợp đồng cần xem
 * @param initialTransfer true → mở luôn hộp chuyển ô (D-18)
 * @param embedded        true khi nằm trong popup: bỏ nút quay lại, padding gọn
 * @param onBack          trang: quay về danh sách · popup: đóng popup
 * @param onOpenContract  (contractId, transfer) mở hợp đồng khác (khách bị ảnh hưởng khi đổi ô)
 */
export default function ContractDetailView({ contractId, initialTransfer = false, embedded = false, onBack, onOpenContract }) {
  const id = contractId
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [reloadTick, setReloadTick] = useState(0)
  // D-18: mở từ popup Lịch ô kho với transfer → bật luôn hộp chuyển ô
  const [transferOpen, setTransferOpen] = useState(initialTransfer)
  const [accessModalOpen, setAccessModalOpen] = useState(false)
  const [notice, setNotice] = useState('')
  // D-18: ô cũ vào bảo trì nhưng còn khách khác đã gán trước → nhắc FM đổi ô tiếp cho họ
  const [affected, setAffected] = useState([])
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingReassign, setRejectingReassign] = useState(false)

  useEffect(() => {
    getContractDetail(id)
      .then((data) => {
        setContract(data)
        if (data?.unitTypeName) {
          setRejectReason(
            `Hiện cơ sở đã hết ô kho trống thuộc loại ${data.unitTypeName} trong khoảng thời gian gia hạn +${data.reassignRequestedMonths || 1} tháng. Quý khách vui lòng đặt thuê loại kho khác và hẹn ngày trả ô kho hiện tại.`
          )
        }
      })
      .catch(() => setError('Không tìm thấy hợp đồng hoặc đã xảy ra lỗi.'))
      .finally(() => setLoading(false))
  }, [id, reloadTick])

  const handleConfirmRejectReassign = async () => {
    if (!contract) return
    setRejectingReassign(true)
    try {
      const res = await rejectRenewalReassign(contract.contractId, { reason: rejectReason })
      setShowRejectBox(false)
      setNotice(res?.message || 'Đã thông báo hết loại kho này cho khách hàng.')
      setReloadTick((t) => t + 1)
    } catch (err) {
      setNotice(err.response?.data?.message || 'Không thể gửi thông báo, vui lòng thử lại.')
    } finally {
      setRejectingReassign(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <span className="material-symbols-outlined text-[36px] text-[#58CC02] animate-spin">
        progress_activity
      </span>
      <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải thông tin hợp đồng...</span>
    </div>
  )

  if (error || !contract) return (
    <div className="p-8 flex flex-col items-center gap-4 min-h-[60vh] justify-center text-center">
      <span className="material-symbols-outlined text-[#FF4B4B] text-[56px]">error</span>
      <p className="text-sm font-black text-[#FF4B4B]">{error || 'Không tìm thấy hợp đồng.'}</p>
      {onBack && (
        <button
          onClick={onBack}
          className="duo-btn-green px-5 py-2.5 text-xs"
        >
          {embedded ? 'ĐÓNG' : 'QUAY LẠI DANH SÁCH'}
        </button>
      )}
    </div>
  )

  const statusInfo = STATUS_MAP[contract.status] || {
    label: contract.status,
    cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]',
    icon: 'info',
  }

  return (
    <div className={embedded ? 'p-4 sm:p-6' : 'p-8 max-w-5xl mx-auto'}>
      {/* Breadcrumb + Back (popup đã có nút đóng ở thanh tiêu đề) */}
      {!embedded && (
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={onBack}
            className="duo-btn-white px-4 py-2 text-xs"
          >
            <span className="material-symbols-outlined text-[18px] mr-1">arrow_back</span>
            <span>QUAY LẠI</span>
          </button>
          <span className="text-[#AFAFAF]">/</span>
          <span className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">Chi tiết Hợp đồng #{contract.contractCode}</span>
        </div>
      )}

      {/* Contract Banner Duolingo Green */}
      <div className="bg-[#58CC02] border-b-4 border-[#58A700] rounded-2xl p-6 mb-6 text-white shadow-xs">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-100 mb-1">
              MÃ HỢP ĐỒNG THUÊ KHO
            </p>
            <p className="text-3xl font-black font-mono tracking-wide">
              {contract.contractCode}
            </p>
            <p className="text-xs font-bold text-emerald-100 mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              Từ đơn đặt chỗ:
              <span className="font-black text-white ml-1">#{contract.reservationCode}</span>
            </p>
          </div>
          <span className={`duo-badge ${statusInfo.cls}`}>
            <span className="material-symbols-outlined text-[16px]">{statusInfo.icon}</span>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Demo: tua thời gian — mốc nhắc gia hạn 15/10/7/3/1 ngày (PR-R9) và mốc quá hạn 1 / 3 / 5 ngày (điều khoản v5) */}
      {['ACTIVE', 'OVERDUE'].includes(contract.status) && (
        <div className="flex flex-wrap items-start gap-3 mb-6">
          {contract.status === 'ACTIVE' && [15, 10, 7, 3, 1].map((days) => (
            <SimulationButton
              key={days}
              label={`Còn ${days} ngày hết hạn`}
              description={`Dời ngày hết hạn về ${days} ngày nữa và chạy ngay job nhắc gia hạn (mốc ${days} ngày): khách nhận thông báo trong chuông và email, FM nhận nhắc nếu khách chưa gia hạn.`}
              onRun={() => simulateExpireSoon(contract.contractId, days)}
              onDone={() => setReloadTick((t) => t + 1)}
            />
          ))}
          <SimulationButton
            label="Quá hạn 1 ngày"
            description="Cho hợp đồng hết hạn 1 ngày trước: chuyển sang QUÁ HẠN (điều khoản v5), khoá mã PIN, tính phí trễ hạn và phí chiếm dụng (muốn cưỡng chế sớm cần đủ 2 lần liên hệ thất bại)."
            onRun={() => simulateOverdue(contract.contractId, 1)}
            onDone={() => setReloadTick((t) => t + 1)}
          />
          <SimulationButton
            label="Quá hạn 3 ngày"
            description="Cho hợp đồng hết hạn 3 ngày trước: chuyển sang QUÁ HẠN (điều khoản v5), khoá mã PIN, tính phí trễ và phí chiếm dụng để demo nút Miễn phí trễ hoặc cưỡng chế sớm sau 2 lần liên hệ thất bại."
            onRun={() => simulateOverdue(contract.contractId, 3)}
            onDone={() => setReloadTick((t) => t + 1)}
          />
          <SimulationButton
            label="Quá hạn 5 ngày (cưỡng chế)"
            description="Cho hợp đồng hết hạn 5 ngày trước: đạt mốc 5 ngày của điều khoản v5 — hệ thống tự động cưỡng chế dọn kho và sinh ngay task dọn kho đưa hàng về Kho tổng."
            onRun={() => simulateOverdue(contract.contractId, 5)}
            onDone={() => setReloadTick((t) => t + 1)}
          />
        </div>
      )}

      {/* Khung xử lý yêu cầu gán lại ô kho mới khi khách muốn gia hạn mà ô hiện tại đã có người đặt trùng */}
      {contract.reassignRequestStatus === 'PENDING' && (
        <div className="bg-[#FFF8EE] border-2 border-[#FF9600] rounded-2xl p-5 mb-6 shadow-xs flex flex-col gap-3.5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FF9600] border-b-2 border-[#E58800] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">swap_horiz</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-[#4B4B4B] uppercase tracking-wide">
                  Yêu cầu gán lại ô kho mới để gia hạn (+{contract.reassignRequestedMonths || 1} tháng)
                </h3>
                <span className="duo-badge bg-[#FFF0D6] text-[#E58800] border border-[#FF9600] text-[10px]">
                  Chờ Quản lý xử lý
                </span>
              </div>
              <p className="text-xs font-bold text-[#777777] mt-1">
                Khách hàng <strong>{contract.customerFullName}</strong> muốn gia hạn hợp đồng thêm{' '}
                <strong>+{contract.reassignRequestedMonths || 1} tháng</strong>, nhưng ô hiện tại{' '}
                <strong className="font-mono">{contract.storageUnitId}</strong> gần hết hạn và đã có khách khác đặt trùng.
              </p>
              <p className="text-xs font-bold text-[#777777] mt-1">
                • Nếu cơ sở vẫn còn ô trống thuộc loại <strong>{contract.unitTypeName}</strong> suốt thời gian gia hạn (+{contract.reassignRequestedMonths || 1} tháng), hãy bấm <strong>Gán ô kho mới cùng loại</strong>.
                <br />• Nếu đã hết loại kho này, hãy bấm <strong>Thông báo hết loại kho này</strong> để báo khách đặt loại kho khác.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pl-0 sm:pl-14">
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="duo-btn-orange px-4 py-2 text-xs gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              Gán ô kho mới cùng loại (+{contract.reassignRequestedMonths || 1} tháng)
            </button>
            <button
              type="button"
              onClick={() => setShowRejectBox((v) => !v)}
              className="duo-btn-white px-4 py-2 text-xs gap-1.5 text-[#FF4B4B] border-[#FFDFDF]"
            >
              <span className="material-symbols-outlined text-[18px] text-[#FF4B4B]">block</span>
              Thông báo hết loại kho này (Khách đặt loại kho khác)
            </button>
          </div>

          {showRejectBox && (
            <div className="sm:ml-14 bg-white border-2 border-[#FFDFDF] rounded-2xl p-4 flex flex-col gap-2.5">
              <span className="text-[11px] font-black uppercase text-[#FF4B4B]">
                Nội dung thông báo gửi cho khách hàng:
              </span>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="duo-input text-xs resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectBox(false)}
                  className="duo-btn-white px-3.5 py-1.5 text-xs"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={rejectingReassign}
                  onClick={handleConfirmRejectReassign}
                  className="px-4 py-1.5 rounded-xl bg-[#FF4B4B] border-b-2 border-[#EA2B2B] text-white font-black text-xs hover:brightness-95 cursor-pointer disabled:opacity-50"
                >
                  {rejectingReassign ? 'Đang gửi...' : 'Xác nhận thông báo hết loại kho'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {contract.reassignRequestStatus === 'ASSIGNED' && (
        <div className="bg-[#D7FFB8]/40 border-2 border-[#58CC02] rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#58A700] text-[24px]">check_circle</span>
          <div className="text-xs font-bold text-[#4B4B4B]">
            <span className="font-black text-[#58A700]">Đã gán lại ô kho mới ({contract.reassignAssignedUnitId || contract.storageUnitId}):</span>{' '}
            Đã xử lý yêu cầu gán ô cho kỳ gia hạn +{contract.reassignRequestedMonths || 1} tháng. Đang chờ khách thanh toán gia hạn.
          </div>
        </div>
      )}

      {contract.reassignRequestStatus === 'OUT_OF_STOCK' && (
        <div className="bg-[#FFF2F2] border-2 border-[#FFDFDF] rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#FF4B4B] text-[24px]">info</span>
          <div className="text-xs font-bold text-[#4B4B4B]">
            <span className="font-black text-[#FF4B4B]">Đã thông báo hết loại kho ({contract.unitTypeName}):</span>{' '}
            {contract.reassignNote || 'Đã báo khách đặt loại kho khác và hẹn trả ô kho hiện tại.'}
          </div>
        </div>
      )}

      {/* Cảnh báo quá hạn cho Quản lý theo Business Rule */}
      {(contract.status === 'OVERDUE' || (contract.status === 'TERMINATION_PENDING' && Number(contract.overdueDays) > 0)) && (() => {
        const { lateFee, overstayFee, totalPenalty, lateFeeWaived, overstayFeeWaived } = getOverdueFeeBreakdown(contract)
        return (
          <div className="bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-2xl p-5 mb-6 shadow-xs flex items-start gap-4">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[36px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-black text-[#FF4B4B] uppercase tracking-wide">
                Hợp đồng này đang quá hạn {contract.overdueDays || 1} ngày
                {contract.status === 'TERMINATION_PENDING' ? ' (đã hẹn trả kho)' : ''}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div className="bg-white p-3 rounded-xl border border-[#FFDFDF]">
                  <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Tổng tiền phạt lũy kế</span>
                  <span className="text-sm font-black text-[#FF4B4B]">{formatVND(totalPenalty)}</span>
                  <div className="mt-1 space-y-0.5 text-[10px] font-bold text-[#777777]">
                    <div>
                      Phí phạt trễ:{' '}
                      <span className={lateFeeWaived ? 'text-[#58A700]' : 'text-[#4B4B4B]'}>
                        {lateFeeWaived ? '0₫ (Đã miễn)' : formatVND(lateFee)}
                      </span>
                      {contract.isMaxLateFeeReached && !lateFeeWaived ? ' (trần cọc)' : ''}
                    </div>
                    <div>
                      Phí chiếm dụng:{' '}
                      <span className={overstayFeeWaived ? 'text-[#58A700]' : 'text-[#4B4B4B]'}>
                        {overstayFeeWaived ? '0₫ (Đã miễn)' : formatVND(overstayFee)}
                      </span>
                    </div>
                    {Number(contract.amountBeyondDeposit) > 0 && (
                      <div className="text-[#FF4B4B]">
                        Vượt cọc (nợ): {formatVND(contract.amountBeyondDeposit)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#FFDFDF]">
                  <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Tiền hoàn cọc ước tính</span>
                  <span className="text-sm font-black text-[#58CC02]">{formatVND(contract.estimatedOverdueDepositRefund != null ? contract.estimatedOverdueDepositRefund : (contract.estimatedDepositRefund != null ? contract.estimatedDepositRefund : 0))}</span>
                  <span className="text-[10px] text-[#AFAFAF] block">(Cọc - Tổng tiền phạt)</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#FFDFDF]">
                  <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Chế tài SmartLock</span>
                  <span className={`text-xs font-black block mt-0.5 ${contract.isPinLocked ? 'text-[#FF4B4B]' : 'text-[#FF9600]'}`}>
                    {contract.isPinLocked ? 'Đã khóa PIN SmartLock' : 'Đang mở mã PIN'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Thông tin khách hàng */}
        <Section icon="person" title="Thông tin khách hàng">
          <div className="flex items-center gap-3 mb-4 p-3.5 bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#58CC02] border-b border-[#58A700] flex items-center justify-center text-white font-black text-base flex-shrink-0">
              {contract.customerFullName?.charAt(contract.customerFullName.lastIndexOf(' ') + 1)?.toUpperCase() || 'K'}
            </div>
            <div>
              <p className="text-sm font-black text-[#4B4B4B]">{contract.customerFullName}</p>
              <p className="text-xs font-bold text-[#AFAFAF] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[15px]">phone</span>
                {contract.customerPhone}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <InfoRow label="Mã định danh khách hàng" value={`#KH-${contract.customerId}`} mono />
          </div>
        </Section>

        {/* Thông tin ô kho */}
        <Section icon="warehouse" title="Thông tin ô kho thuê">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Mã ô kho" value={contract.emergencyUnit ? `${contract.storageUnitId} (ô khẩn cấp — tạm thời)` : contract.storageUnitId} mono />
            <InfoRow label="Loại kho" value={contract.unitTypeName} />
            <InfoRow label="Diện tích" value={`${contract.areaSqm} m²`} />
            <InfoRow label="Tầng" value={`Tầng ${contract.floor}`} />
            <InfoRow label="Khu vực" value={`Khu ${contract.zone}`} />
            <InfoRow label="Số phòng" value={contract.roomNumber} mono />
          </div>
          {TRANSFERABLE_STATUSES.includes(contract.status) && (
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="duo-btn-white px-4 py-2 text-xs gap-1.5 mt-4"
            >
              <span className="material-symbols-outlined text-[18px] text-[#FF9600]">swap_horiz</span>
              Chuyển sang ô khác
            </button>
          )}
        </Section>

        {/* Thông tin hợp đồng */}
        <Section icon="description" title="Chi tiết thời hạn & Cọc">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Ngày bắt đầu" value={formatDate(contract.startDate)} />
            <InfoRow label="Ngày kết thúc" value={formatDate(contract.endDate)} />
            <InfoRow label="Chu kỳ thanh toán" value={`${contract.billingCycleMonths} tháng / lần`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">
                Tiền cọc an toàn
              </span>
              <span className="text-base font-black text-[#58CC02]">
                {formatVND(contract.depositHeldAmount)}
              </span>
            </div>
          </div>
        </Section>

        {/* Thông tin truy cập kho */}
        <Section icon="lock" title="Mã mở khóa điện tử">
          <div className="flex flex-col gap-3">
            <div className="bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] rounded-2xl p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#1CB0F6] mb-1">
                MÃ PIN SMARTLOCK
              </p>
              {contract.isPinLocked ? (
                <p className="text-xl font-mono font-black text-[#FF4B4B] py-1">
                  ĐÃ KHÓA
                </p>
              ) : contract.accessPinCode ? (
                <p className="text-3xl font-mono font-black tracking-[0.4em] text-[#1CB0F6]">
                  {contract.accessPinCode}
                </p>
              ) : (
                <p className="text-xs font-bold text-[#AFAFAF] py-1">
                  {contract.status === 'LIQUIDATED' ? 'Đã vô hiệu hóa (Đã cưỡng chế dọn kho)' : 'Chưa cấp phát'}
                </p>
              )}
            </div>
            <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-3.5">
              <p className="text-[11px] font-black uppercase text-[#AFAFAF] mb-0.5">
                MÃ THẺ TỪ RFID
              </p>
              <p className="text-xs font-mono font-bold text-[#4B4B4B]">
                {contract.rfidCardCode || 'Chưa cấp phát'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAccessModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-300 transition active:scale-98 cursor-pointer text-center"
            >
              LỊCH SỬ SỬ DỤNG
            </button>
          </div>
        </Section>
      </div>

      {/* BR-125 / BR-129: bảo hiểm hàng hoá + giám sát nhiệt độ ô */}
      <div className="mt-6">
        <Section icon="verified_user" title="Bảo hiểm & giám sát ô kho">
          <ContractProtectionPanel contract={contract} viewer="manager" />
        </Section>
      </div>

      {/* BR-121 / BR-122: biên bản bàn giao kèm ảnh + lịch sử chuyển ô */}
      <div className="mt-6">
        <Section icon="fact_check" title="Biên bản bàn giao & chuyển ô">
          <ContractHandoverSection contractId={contract.contractId} reloadKey={reloadTick} />
        </Section>
      </div>

      {notice && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] px-4 py-3 text-xs font-black text-[#58A700] shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {notice}
          <button type="button" onClick={() => setNotice('')} className="ml-2 text-[#58A700]">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {affected.length > 0 && (
        <div className="fixed bottom-20 right-6 z-50 max-w-[420px] rounded-2xl border-2 border-[#FFC800] bg-[#FFF8DB] px-4 py-3 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#E58800]">warning</span>
            <div className="flex-1">
              <p className="text-xs font-black text-[#4B4B4B]">Ô cũ đang bảo trì nhưng còn {affected.length} khách đã gán trước — đổi ô cho họ:</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {affected.map(a => (
                  <li key={a.contractId} className="text-[11px] font-bold text-[#777777]">
                    <button type="button" onClick={() => onOpenContract?.(a.contractId, true)} className="text-[#1CB0F6] font-black hover:underline">
                      {a.contractCode}
                    </button>{' '}· {a.customerName} · nhận kho {a.startDate?.split('-').reverse().join('/')}
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={() => setAffected([])} className="text-[#AFAFAF] hover:text-[#4B4B4B]">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      <TransferUnitModal
        open={transferOpen}
        contract={contract}
        onClose={() => setTransferOpen(false)}
        onDone={(result) => {
          setTransferOpen(false)
          setNotice(`Đã chuyển hợp đồng sang ô ${result.toUnitId}, khách đã nhận thông báo + email.`)
          setAffected(result.affectedContracts || [])
          setReloadTick((t) => t + 1)
        }}
        onRejected={(result) => {
          setTransferOpen(false)
          setNotice(result?.message || 'Đã thông báo hết loại kho này cho khách hàng.')
          setReloadTick((t) => t + 1)
        }}
      />

      {accessModalOpen && (
        <UnitAccessModal
          isOpen={accessModalOpen}
          onClose={() => setAccessModalOpen(false)}
          contractId={contract.contractId || id}
          contractCode={contract.contractCode}
          storageUnitId={contract.storageUnitId}
          roomNumber={contract.roomNumber}
        />
      )}
    </div>
  )
}
