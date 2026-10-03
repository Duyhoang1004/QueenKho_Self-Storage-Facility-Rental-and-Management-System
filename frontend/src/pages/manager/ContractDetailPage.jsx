import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getContractDetail } from '../../services/contractService'

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
  ACTIVE:              { label: 'Đang hoạt động',        cls: 'bg-[#ECFDF5] text-[#10B981]', icon: 'check_circle' },
  TERMINATION_PENDING: { label: 'Chờ kiểm tra trả kho', cls: 'bg-orange-100 text-orange-800',  icon: 'schedule' },
  OVERDUE:             { label: 'Quá hạn thanh toán',    cls: 'bg-[#FEF3C7] text-[#D97706]', icon: 'warning' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-[#F1F5F9] text-[#64748B]', icon: 'cancel' },
  LIQUIDATED:          { label: 'Đã thanh lý hợp đồng',  cls: 'bg-[#FEE2E2] text-[#EF4444]', icon: 'gavel' },
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      <span className={`text-body-md font-body-md text-on-surface font-semibold ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-white rounded-xl border border-surface-container-high p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary text-[22px]">{icon}</span>
        <h2 className="text-title-md font-title-md text-on-surface">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function ContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getContractDetail(id)
      .then(setContract)
      .catch(() => setError('Không tìm thấy hợp đồng hoặc đã xảy ra lỗi.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <span className="material-symbols-outlined text-[32px] text-on-surface-variant animate-spin">
        progress_activity
      </span>
      <span className="text-body-md text-on-surface-variant">Đang tải thông tin hợp đồng...</span>
    </div>
  )

  if (error || !contract) return (
    <div className="p-6 flex flex-col items-center gap-4 min-h-[60vh] justify-center">
      <span className="material-symbols-outlined text-error text-[56px]">error</span>
      <p className="text-body-md text-error font-semibold">{error || 'Không tìm thấy hợp đồng.'}</p>
      <button
        onClick={() => navigate('/manager/customers')}
        className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-body-md font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
      >
        Quay lại danh sách
      </button>
    </div>
  )

  const statusInfo = STATUS_MAP[contract.status] || {
    label: contract.status,
    cls: 'bg-surface-container text-on-surface-variant',
    icon: 'info',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb + Back */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate('/manager/customers')}
          className="flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span className="text-body-md font-body-md">Khách hàng & Hợp đồng</span>
        </button>
        <span className="text-on-surface-variant">/</span>
        <span className="text-body-md font-body-md text-on-surface font-semibold">Chi tiết Hợp đồng</span>
      </div>

      {/* Contract Banner */}
      <div className="bg-primary rounded-2xl p-6 mb-5 text-on-primary">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-label-md font-label-md text-on-primary/70 uppercase tracking-wider mb-1">
              Mã hợp đồng thuê kho
            </p>
            <p className="text-headline-md font-headline-md font-bold font-mono tracking-wide">
              {contract.contractCode}
            </p>
            <p className="text-body-sm font-body-sm text-on-primary/70 mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              Từ đơn đặt chỗ:
              <span className="font-semibold text-on-primary ml-1">{contract.reservationCode}</span>
            </p>
          </div>
          <span className={`text-label-sm font-label-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 ${statusInfo.cls}`}>
            <span className="material-symbols-outlined text-[14px]">{statusInfo.icon}</span>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Thông tin khách hàng */}
        <Section icon="person" title="Thông tin khách hàng">
          <div className="flex items-center gap-3 mb-4 p-3 bg-surface-container-low rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-lg flex-shrink-0">
              {contract.customerFullName?.charAt(contract.customerFullName.lastIndexOf(' ') + 1)?.toUpperCase() || 'K'}
            </div>
            <div>
              <p className="text-title-md font-title-md text-on-surface font-semibold">{contract.customerFullName}</p>
              <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">phone</span>
                {contract.customerPhone}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <InfoRow label="Mã khách hàng" value={`#KH-${contract.customerId}`} mono />
          </div>
        </Section>

        {/* Thông tin ô kho */}
        <Section icon="warehouse" title="Thông tin ô kho thuê">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Mã ô kho" value={contract.storageUnitId} mono />
            <InfoRow label="Loại kho" value={contract.unitTypeName} />
            <InfoRow label="Diện tích" value={`${contract.areaSqm} m²`} />
            <InfoRow label="Tầng" value={`Tầng ${contract.floor}`} />
            <InfoRow label="Khu vực" value={`Khu ${contract.zone}`} />
            <InfoRow label="Số phòng" value={contract.roomNumber} mono />
          </div>
        </Section>

        {/* Thông tin hợp đồng */}
        <Section icon="description" title="Chi tiết hợp đồng">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Ngày bắt đầu" value={formatDate(contract.startDate)} />
            <InfoRow label="Ngày kết thúc" value={formatDate(contract.endDate)} />
            <InfoRow label="Chu kỳ thanh toán" value={`${contract.billingCycleMonths} tháng / lần`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                Tiền cọc đang giữ
              </span>
              <span className="text-body-md font-body-md text-secondary font-bold">
                {formatVND(contract.depositHeldAmount)}
              </span>
            </div>
          </div>
        </Section>

        {/* Thông tin truy cập kho */}
        <Section icon="lock" title="Thông tin truy cập kho">
          <div className="flex flex-col gap-3">
            <div className="bg-surface-container-low rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">pin</span>
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                  Mã PIN SmartLock
                </p>
              </div>
              {contract.accessPinCode ? (
                <p className="text-title-md font-title-md text-on-surface font-mono tracking-[0.4em] text-center py-1">
                  {contract.accessPinCode}
                </p>
              ) : (
                <p className="text-body-sm font-body-sm text-on-surface-variant text-center py-1 italic">
                  Chưa được cấp phát
                </p>
              )}
            </div>
            <div className="bg-surface-container-low rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="material-symbols-outlined text-on-surface-variant text-[16px]">contactless</span>
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                  Mã thẻ RFID
                </p>
              </div>
              {contract.rfidCardCode ? (
                <p className="text-body-md font-body-md text-on-surface font-mono tracking-widest">
                  {contract.rfidCardCode}
                </p>
              ) : (
                <p className="text-body-sm font-body-sm text-on-surface-variant italic">
                  Chưa được cấp phát
                </p>
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
