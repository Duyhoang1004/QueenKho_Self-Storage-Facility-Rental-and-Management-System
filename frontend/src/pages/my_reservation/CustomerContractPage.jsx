import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { getContractByReservation } from '../../services/contractService'
import ContractOptionsModal from '../../components/ContractOptionsModal'
import { getVnpayStatus } from '../../services/vnpayService'

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
  ACTIVE:              { label: 'Đang hoạt động',        cls: 'bg-green-100 text-green-800',  icon: 'check_circle' },
  TERMINATION_PENDING: { label: 'Chờ kiểm tra trả kho', cls: 'bg-orange-100 text-orange-800', icon: 'schedule' },
  OVERDUE:             { label: 'Quá hạn thanh toán',    cls: 'bg-yellow-100 text-yellow-800', icon: 'warning' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-gray-100 text-gray-600',    icon: 'cancel' },
  LIQUIDATED:          { label: 'Đã thanh lý hợp đồng',  cls: 'bg-red-100 text-red-800',      icon: 'gavel' },
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider text-xs">
        {label}
      </span>
      <span className={`text-body-md font-body-md text-on-surface font-semibold ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function CustomerContractPage() {
  // reservationId được truyền từ URL /kho-cua-toi/hop-dong/:reservationId
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const [searchParams] = useSearchParams()
  const loadContract = () => {
    getContractByReservation(reservationId)
      .then(data => {
        if (!data || !data.contractId) throw new Error('not found')
        setContract(data)
      })
      .catch(() => setError('Không tìm thấy hợp đồng cho đơn đặt chỗ này.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadContract()
  }, [reservationId])


  useEffect(() => {
    const orderId = searchParams.get('orderId')
    if (!orderId) return
    let active = true
    const poll = async () => {
      try {
        const result = await getVnpayStatus(orderId)
        if (!active) return
        if (result.status === 'SUCCESS') {
          setToastMessage('Thanh toán VNPAY thành công. Hợp đồng đã được gia hạn.')
          loadContract()
          navigate(`/kho-cua-toi/hop-dong/${reservationId}`, { replace: true })
        } else if (result.status === 'FAILED') {
          setError('Thanh toán VNPAY không thành công, vui lòng chọn lại.')
          navigate(`/kho-cua-toi/hop-dong/${reservationId}`, { replace: true })
        } else setTimeout(poll, 2500)
      } catch { if (active) setTimeout(poll, 3000) }
    }
    poll()
    return () => { active = false }
  }, [searchParams, reservationId])
  const handleModalSuccess = (msg) => {
    setToastMessage(msg)
    loadContract()
    setTimeout(() => setToastMessage(''), 6000)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <span className="material-symbols-outlined text-[32px] text-on-surface-variant animate-spin">
        progress_activity
      </span>
      <span className="text-body-md text-on-surface-variant">Đang tải hợp đồng...</span>
    </div>
  )

  if (error || !contract) return (
    <div className="flex flex-col items-center gap-4 min-h-[60vh] justify-center p-6">
      <span className="material-symbols-outlined text-error text-[56px]">error</span>
      <p className="text-body-md text-error font-semibold">{error || 'Không tìm thấy hợp đồng.'}</p>
      <button
        onClick={() => navigate('/kho-cua-toi')}
        className="bg-secondary text-on-secondary px-5 py-2.5 rounded-xl text-body-md font-semibold cursor-pointer"
      >
        Quay lại đơn đặt chỗ
      </button>
    </div>
  )

  const statusInfo = STATUS_MAP[contract.status] || {
    label: contract.status,
    cls: 'bg-gray-100 text-gray-600',
    icon: 'info',
  }

  return (
    <div className="max-w-[820px] w-full mx-auto px-margin py-space-lg flex flex-col gap-space-lg">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
        <Link to="/" className="hover:text-on-surface">Trang chủ</Link>
        <span>/</span>
        <Link to="/kho-cua-toi" className="hover:text-on-surface">Đơn đặt chỗ của tôi</Link>
        <span>/</span>
        <span className="text-on-surface font-semibold">Hợp đồng</span>
      </div>

      {/* Toast thông báo thành công */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 font-medium text-body-md">
            <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Banner HĐ */}
      <div className="bg-secondary rounded-2xl p-6 text-on-secondary">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-label-sm font-label-sm text-on-secondary/70 uppercase tracking-wider mb-1">
              Hợp đồng thuê kho
            </p>
            <p className="text-headline-md font-headline-md font-bold font-mono tracking-wide">
              {contract.contractCode}
            </p>
            <p className="text-body-sm text-on-secondary/70 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">receipt_long</span>
              Từ đơn: <span className="font-semibold text-on-secondary ml-1">{contract.reservationCode}</span>
            </p>
          </div>
          <span className={`text-label-sm font-label-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 ${statusInfo.cls}`}>
            <span className="material-symbols-outlined text-[14px]">{statusInfo.icon}</span>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Ô kho đã thuê */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm col-span-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary text-[22px]">warehouse</span>
            <h2 className="text-title-md font-title-md text-on-surface">Ô kho đã thuê</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoRow label="Mã ô kho" value={contract.storageUnitId} mono />
            <InfoRow label="Loại kho" value={contract.unitTypeName} />
            <InfoRow label="Diện tích" value={`${contract.areaSqm} m²`} />
            <InfoRow label="Tầng" value={`Tầng ${contract.floor}`} />
            <InfoRow label="Khu vực" value={`Khu ${contract.zone}`} />
            <InfoRow label="Phòng số" value={contract.roomNumber} mono />
          </div>
        </div>

        {/* Thời hạn & Tài chính */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">calendar_month</span>
                <h2 className="text-title-md font-title-md text-on-surface">Thời hạn thuê</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="flex flex-col gap-3">
                <InfoRow label="Ngày bắt đầu" value={formatDate(contract.startDate)} />
                <InfoRow label="Ngày kết thúc" value={formatDate(contract.endDate)} />
                <InfoRow label="Chu kỳ thanh toán" value={`${contract.billingCycleMonths} tháng / lần`} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider text-xs">
                    Tiền cọc đã nộp
                  </span>
                  <span className="text-title-md font-title-md text-secondary font-bold">
                    {formatVND(contract.depositHeldAmount)}
                  </span>
                </div>
              </div>

              {/* Vị trí khoanh đỏ: Nút thao tác tùy chọn hợp đồng */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 gap-2.5 text-center">
                <span className="text-xs text-slate-500 font-medium">Gia hạn thêm hoặc hẹn ngày trả kho</span>
                <button
                  type="button"
                  onClick={() => setIsOptionsModalOpen(true)}
                  className="w-full px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-title-md text-body-sm shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  Tùy chọn hợp đồng
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Thông tin truy cập */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary text-[22px]">lock</span>
            <h2 className="text-title-md font-title-md text-on-surface">Truy cập kho</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">pin</span>
                Mã PIN SmartLock
              </p>
              {contract.accessPinCode ? (
                <p className="text-2xl font-mono font-bold tracking-[0.4em] text-on-surface text-center py-1">
                  {contract.accessPinCode}
                </p>
              ) : (
                <p className="text-body-sm text-on-surface-variant text-center italic py-2">
                  Chưa được cấp phát — liên hệ quản lý cơ sở
                </p>
              )}
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">contactless</span>
                Mã thẻ RFID
              </p>
              {contract.rfidCardCode ? (
                <p className="text-body-md font-mono font-semibold tracking-widest text-on-surface">
                  {contract.rfidCardCode}
                </p>
              ) : (
                <p className="text-body-sm text-on-surface-variant italic">
                  Chưa được cấp phát — liên hệ quản lý cơ sở
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quay lại */}
      <div>
        <button
          onClick={() => navigate('/kho-cua-toi')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-body-md"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Quay lại đơn đặt chỗ của tôi
        </button>
      </div>

      {/* Modal Popup Tùy Chọn Hợp Đồng (UC-21 & UC-22) */}
      <ContractOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        contract={contract}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
