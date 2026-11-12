// (10/11/2026) Nội dung chi tiết hợp đồng dùng chung cho trang /manager/contracts/:id
// và popup ContractDetailModal (xem hợp đồng không phải mở tab mới → không mất phiên đăng nhập).
import { useEffect, useState } from 'react'
import { getContractDetail } from '../services/contractService'
import SimulationButton from './SimulationButton'
import TransferUnitModal from './TransferUnitModal'
import ContractHandoverSection from './ContractHandoverSection'
import ContractProtectionPanel from './ContractProtectionPanel'
import { simulateExpireSoon, simulateOverdue } from '../services/simulationService'

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
  OVERDUE:             { label: 'Quá hạn thanh toán',    cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'warning' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]', icon: 'cancel' },
  LIQUIDATED:          { label: 'Đã thanh lý hợp đồng',  cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]', icon: 'gavel' },
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
  const [notice, setNotice] = useState('')
  // D-18: ô cũ vào bảo trì nhưng còn khách khác đã gán trước → nhắc FM đổi ô tiếp cho họ
  const [affected, setAffected] = useState([])

  useEffect(() => {
    getContractDetail(id)
      .then(setContract)
      .catch(() => setError('Không tìm thấy hợp đồng hoặc đã xảy ra lỗi.'))
      .finally(() => setLoading(false))
  }, [id, reloadTick])

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

      {/* Demo: tua thời gian — mốc nhắc gia hạn 15/10/7/3/1 ngày (PR-R9), quá hạn 1 ngày (điều khoản v4: chuyển kho tổng ngay),
          quá hạn 31 ngày (điều khoản cũ: nút thanh lý) — ẩn khi backend tắt giả lập */}
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
            description="Cho hợp đồng hết hạn hôm qua. Khách đồng ý điều khoản v4: thanh lý ngay và sinh việc chuyển hàng vào kho tổng (như job 00:05). Điều khoản cũ: chuyển QUÁ HẠN, khoá PIN, tính phí trễ."
            onRun={() => simulateOverdue(contract.contractId, 1)}
            onDone={() => setReloadTick((t) => t + 1)}
          />
          <SimulationButton
            label="Quá hạn 3 ngày"
            description="Cho hợp đồng hết hạn 3 ngày trước: chuyển QUÁ HẠN, khoá PIN, tính phí trễ theo chính sách (điều khoản v4 sẽ thanh lý + chuyển kho tổng luôn). Dùng để demo nút Miễn phí trễ với hợp đồng cũ."
            onRun={() => simulateOverdue(contract.contractId, 3)}
            onDone={() => setReloadTick((t) => t + 1)}
          />
          <SimulationButton
            label="Quá hạn 31 ngày (thanh lý)"
            description="Cho hợp đồng hết hạn 31 ngày trước: vượt mốc 30 ngày, nút Thanh lý ở màn Hợp đồng quá hạn được bật."
            onRun={() => simulateOverdue(contract.contractId, 31)}
            onDone={() => setReloadTick((t) => t + 1)}
          />
        </div>
      )}

      {/* Cảnh báo quá hạn cho Quản lý theo Business Rule */}
      {contract.status === 'OVERDUE' && (
        <div className="bg-[#FFF2F2] border-2 border-[#FFB8B8] rounded-2xl p-5 mb-6 shadow-xs flex items-start gap-4">
          <span className="material-symbols-outlined text-[#FF4B4B] text-[36px] shrink-0 mt-0.5">
            warning
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-black text-[#FF4B4B] uppercase tracking-wide">
              Hợp đồng này đang quá hạn {contract.overdueDays || 1} ngày
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="bg-white p-3 rounded-xl border border-[#FFDFDF]">
                <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Phí phạt lũy kế</span>
                <span className="text-sm font-black text-[#FF4B4B]">{formatVND(contract.lateFeeAmount || 0)}</span>
                {contract.isMaxLateFeeReached && (
                  <span className="text-[10px] text-[#FF4B4B] font-bold block">(Đã chạm trần cọc)</span>
                )}
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#FFDFDF]">
                <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Tiền hoàn cọc ước tính</span>
                <span className="text-sm font-black text-[#58CC02]">{formatVND(contract.estimatedOverdueDepositRefund != null ? contract.estimatedOverdueDepositRefund : (contract.estimatedDepositRefund != null ? contract.estimatedDepositRefund : 0))}</span>
                <span className="text-[10px] text-[#AFAFAF] block">(Cọc - Phí phạt)</span>
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
      )}

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
                  {contract.status === 'LIQUIDATED' ? 'Đã vô hiệu hóa (Đã thanh lý)' : 'Chưa cấp phát'}
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
      />
    </div>
  )
}
