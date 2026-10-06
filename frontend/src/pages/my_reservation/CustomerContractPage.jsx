import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getContractByReservation } from '../../services/contractService'
import { useSearchParams } from 'react-router-dom'
import { getVnpayStatus } from '../../services/vnpayService'
import ContractOptionsModal from '../../components/ContractOptionsModal'

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
  ACTIVE:              { label: 'Đang hoạt động',        cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]',  icon: 'check_circle' },
  TERMINATION_PENDING: { label: 'Chờ trả kho',           cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'schedule' },
  OVERDUE:             { label: 'Quá hạn thanh toán',    cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'warning' },
  TERMINATED:          { label: 'Đã kết thúc',           cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]', icon: 'cancel' },
  LIQUIDATED:          { label: 'Đã thanh lý hợp đồng',  cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FFDFDF]', icon: 'gavel' },
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{label}</span>
      <span className={`text-sm font-black text-[#4B4B4B] ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function CustomerContractPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [toastMessage, setToastMessage] = useState('')

  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)

  const fetchContract = () => {
    setLoading(true)
    getContractByReservation(reservationId)
      .then(data => {
        setContract(data)
        setError('')
      })
      .catch(() => {
        setError('Không thể tải thông tin hợp đồng.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchContract()
  }, [reservationId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true' && params.get('renewal') === 'true') {
      const transId = params.get('transaction_id')
      if (transId) {
        confirmSepayRenewalPayment(transId)
          .then(res => {
            setToastMessage('Gia hạn hợp đồng và thanh toán thành công!')
            fetchContract()
          })
          .catch(err => {
            console.error('Lỗi xác nhận thanh toán gia hạn:', err)
          })
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleModalSuccess = (message) => {
    setIsOptionsModalOpen(false)
    if (message) {
      setToastMessage(message)
    }
    fetchContract()
  }

  if (loading) return <div className="p-8 text-sm font-bold text-[#AFAFAF] text-center max-w-[1240px] mx-auto">Đang tải hợp đồng...</div>
  if (error) return (
    <div className="p-8 flex flex-col items-center justify-center gap-4 text-center max-w-[1240px] mx-auto">
      <span className="material-symbols-outlined text-[40px] text-[#FF4B4B]">error</span>
      <p className="text-sm font-bold text-[#FF4B4B]">{error}</p>
      <button onClick={() => navigate(-1)} className="duo-btn-gray px-5 py-3 text-xs">QUAY LẠI</button>
    </div>
  )
  if (!contract) return null

  const statusInfo = STATUS_MAP[contract.status] || { label: contract.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]', icon: 'info' }

  return (
    <div className="max-w-[1000px] w-full mx-auto px-8 py-8 flex flex-col gap-6 select-none">

      {toastMessage && (
        <div className="bg-[#D7FFB8] border-2 border-[#58CC02] rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 font-bold text-[#58A700]">
            <span className="material-symbols-outlined text-[24px]">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-[#58A700] hover:text-[#58CC02] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* Banner HD */}
      <div className="bg-[#1CB0F6] border-b-4 border-[#1899D6] rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-[11px] font-black uppercase tracking-wider text-white/80 mb-1">
            Hợp đồng thuê kho
          </p>
          <p className="text-3xl font-black font-mono tracking-wide">
            {contract.contractCode}
          </p>
          <p className="text-sm font-bold text-white/90 mt-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Từ đơn: <span className="font-mono bg-white/20 px-2 py-0.5 rounded-lg ml-1">{contract.reservationCode}</span>
          </p>
        </div>
        <span className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${statusInfo.cls}`}>
          <span className="material-symbols-outlined text-[18px]">{statusInfo.icon}</span>
          {statusInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* O kho da thue */}
        <div className="duo-card p-6 col-span-full">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
            <span className="material-symbols-outlined text-[#1CB0F6] text-[28px]">warehouse</span>
            <h2 className="text-lg font-black text-[#4B4B4B] uppercase">Ô kho đã thuê</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <InfoRow label="Mã Ô kho" value={contract.storageUnitId} mono />
            <InfoRow label="Loại kho" value={contract.unitTypeName} />
            <InfoRow label="Diện tích" value={`${contract.areaSqm} m²`} />
            <InfoRow label="Tầng" value={`Tầng ${contract.floor}`} />
            <InfoRow label="Khu vực" value={`Khu ${contract.zone}`} />
            <InfoRow label="Phòng số" value={contract.roomNumber} mono />
          </div>
        </div>

        {/* Thoi han & Tai chinh */}
        <div className="duo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
              <span className="material-symbols-outlined text-[#FF9600] text-[28px]">calendar_month</span>
              <h2 className="text-lg font-black text-[#4B4B4B] uppercase">Thời hạn thuê</h2>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Ngày bắt đầu" value={formatDate(contract.startDate)} />
                <InfoRow label="Ngày kết thúc" value={formatDate(contract.endDate)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Chu kỳ thanh toán" value={`${contract.billingCycleMonths} tháng / lần`} />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Tiền cọc đã nộp</span>
                  <span className="text-xl font-black text-[#58CC02]">{formatVND(contract.depositHeldAmount)}</span>
                </div>
              </div>

              {/* Nut tuy chon hop dong */}
              <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 flex flex-col items-center gap-3 mt-2 text-center">
                <span className="text-xs font-bold text-[#AFAFAF]">Cần thêm thời gian hoặc trả kho sớm?</span>
                <button
                  type="button"
                  onClick={() => setIsOptionsModalOpen(true)}
                  className="duo-btn-blue w-full px-5 py-3 text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  TÙY CHỌN HỢP ĐỒNG
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Thong tin truy cap */}
        <div className="duo-card p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[28px]">lock</span>
            <h2 className="text-lg font-black text-[#4B4B4B] uppercase">Truy cập kho</h2>
          </div>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-5 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">pin</span> Mã PIN SmartLock
              </span>
              {contract.accessPinCode ? (
                <span className="text-3xl font-mono font-black tracking-[0.3em] text-[#4B4B4B]">{contract.accessPinCode}</span>
              ) : (
                <span className="text-sm font-bold text-[#AFAFAF] italic">Chưa được cấp phát</span>
              )}
            </div>
            
            <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-5 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">contactless</span> Mã thẻ RFID
              </span>
              {contract.rfidCardCode ? (
                <span className="text-lg font-mono font-black tracking-widest text-[#4B4B4B]">{contract.rfidCardCode}</span>
              ) : (
                <span className="text-sm font-bold text-[#AFAFAF] italic">Chưa được cấp phát</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quay lai */}
      <div className="mt-4">
        <button
          onClick={() => navigate('/kho-cua-toi')}
          className="flex items-center gap-2 text-sm font-bold text-[#AFAFAF] hover:text-[#4B4B4B] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          QUAY LẠI ĐƠN ĐẶT CHỖ
        </button>
      </div>

      <ContractOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        contract={contract}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}
