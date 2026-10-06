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
  ACTIVE:              { label: 'Đang hoạt động',        cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]', icon: 'check_circle' },
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <span className="material-symbols-outlined text-[36px] text-[#58CC02] animate-spin">
        progress_activity
      </span>
      <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải thông tin hợp đồng...</span>
    </div>
  )

  if (error || !contract) return (
    <div className="p-8 flex flex-col items-center gap-4 min-h-[60vh] justify-center text-center select-none">
      <span className="material-symbols-outlined text-[#FF4B4B] text-[56px]">error</span>
      <p className="text-sm font-black text-[#FF4B4B]">{error || 'Không tìm thấy hợp đồng.'}</p>
      <button
        onClick={() => navigate('/manager/customers')}
        className="duo-btn-green px-5 py-2.5 text-xs"
      >
        QUAY LẠI DANH SÁCH
      </button>
    </div>
  )

  const statusInfo = STATUS_MAP[contract.status] || {
    label: contract.status,
    cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]',
    icon: 'info',
  }

  return (
    <div className="p-8 max-w-5xl mx-auto select-none">
      {/* Breadcrumb + Back */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate('/manager/customers')}
          className="duo-btn-white px-4 py-2 text-xs"
        >
          <span className="material-symbols-outlined text-[18px] mr-1">arrow_back</span>
          <span>QUAY LẠI</span>
        </button>
        <span className="text-[#AFAFAF]">/</span>
        <span className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">Chi tiết Hợp đồng #{contract.contractCode}</span>
      </div>

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
            <InfoRow label="Mã ô kho" value={contract.storageUnitId} mono />
            <InfoRow label="Loại kho" value={contract.unitTypeName} />
            <InfoRow label="Diện tích" value={`${contract.areaSqm} m²`} />
            <InfoRow label="Tầng" value={`Tầng ${contract.floor}`} />
            <InfoRow label="Khu vực" value={`Khu ${contract.zone}`} />
            <InfoRow label="Số phòng" value={contract.roomNumber} mono />
          </div>
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
              {contract.accessPinCode ? (
                <p className="text-3xl font-mono font-black tracking-[0.4em] text-[#1CB0F6]">
                  {contract.accessPinCode}
                </p>
              ) : (
                <p className="text-xs font-bold text-[#AFAFAF] py-1">
                  Chưa cấp phát
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
    </div>
  )
}
