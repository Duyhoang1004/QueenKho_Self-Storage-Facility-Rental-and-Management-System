import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getContractByReservation } from '../../services/contractService'
import vnpayService from '../../services/vnpayService'
import { useSearchParams } from 'react-router-dom'
import ContractOptionsModal from '../../components/ContractOptionsModal'

function formatVND(v) {
  if (v == null) return 'â€”'
  return Number(v).toLocaleString('vi-VN') + 'â‚«'
}

function formatDate(val) {
  if (!val) return 'â€”'
  const [y, m, d] = String(val).split('-')
  return `${d}/${m}/${y}`
}

const STATUS_MAP = {
  ACTIVE:              { label: 'Äang hoáº¡t Ä‘á»™ng',        cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]',  icon: 'check_circle' },
  TERMINATION_PENDING: { label: 'Chá» tráº£ kho',           cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'schedule' },
  OVERDUE:             { label: 'QuÃ¡ háº¡n thanh toÃ¡n',    cls: 'bg-[#FFE8CC] text-[#E58800] border-2 border-[#FF9600]', icon: 'warning' },
  TERMINATED:          { label: 'ÄÃ£ káº¿t thÃºc',           cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]', icon: 'cancel' },
  LIQUIDATED:          { label: 'ÄÃ£ thanh lÃ½ há»£p Ä‘á»“ng',  cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FFDFDF]', icon: 'gavel' },
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">{label}</span>
      <span className={`text-sm font-black text-[#4B4B4B] ${mono ? 'font-mono' : ''}`}>
        {value || 'â€”'}
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
        setError('KhÃ´ng thá»ƒ táº£i thÃ´ng tin há»£p Ä‘á»“ng.')
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
            setToastMessage('Gia háº¡n há»£p Ä‘á»“ng vÃ  thanh toÃ¡n thÃ nh cÃ´ng!')
            fetchContract()
          })
          .catch(err => {
            console.error('Lá»—i xÃ¡c nháº­n thanh toÃ¡n gia háº¡n:', err)
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

  if (loading) return <div className="p-8 text-sm font-bold text-[#AFAFAF] text-center max-w-[1240px] mx-auto">Äang táº£i há»£p Ä‘á»“ng...</div>
  if (error) return (
    <div className="p-8 flex flex-col items-center justify-center gap-4 text-center max-w-[1240px] mx-auto">
      <span className="material-symbols-outlined text-[40px] text-[#FF4B4B]">error</span>
      <p className="text-sm font-bold text-[#FF4B4B]">{error}</p>
      <button onClick={() => navigate(-1)} className="duo-btn-gray px-5 py-3 text-xs">QUAY Láº I</button>
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
            Há»£p Ä‘á»“ng thuÃª kho
          </p>
          <p className="text-3xl font-black font-mono tracking-wide">
            {contract.contractCode}
          </p>
          <p className="text-sm font-bold text-white/90 mt-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Tá»« Ä‘Æ¡n: <span className="font-mono bg-white/20 px-2 py-0.5 rounded-lg ml-1">{contract.reservationCode}</span>
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
            <h2 className="text-lg font-black text-[#4B4B4B] uppercase">Ã” kho Ä‘Ã£ thuÃª</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <InfoRow label="MÃ£ Ã” kho" value={contract.storageUnitId} mono />
            <InfoRow label="Loáº¡i kho" value={contract.unitTypeName} />
            <InfoRow label="Diá»‡n tÃ­ch" value={`${contract.areaSqm} mÂ²`} />
            <InfoRow label="Táº§ng" value={`Táº§ng ${contract.floor}`} />
            <InfoRow label="Khu vá»±c" value={`Khu ${contract.zone}`} />
            <InfoRow label="PhÃ²ng sá»‘" value={contract.roomNumber} mono />
          </div>
        </div>

        {/* Thoi han & Tai chinh */}
        <div className="duo-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
              <span className="material-symbols-outlined text-[#FF9600] text-[28px]">calendar_month</span>
              <h2 className="text-lg font-black text-[#4B4B4B] uppercase">Thá»i háº¡n thuÃª</h2>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="NgÃ y báº¯t Ä‘áº§u" value={formatDate(contract.startDate)} />
                <InfoRow label="NgÃ y káº¿t thÃºc" value={formatDate(contract.endDate)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Chu ká»³ thanh toÃ¡n" value={`${contract.billingCycleMonths} thÃ¡ng / láº§n`} />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF]">Tiá»n cá»c Ä‘Ã£ ná»™p</span>
                  <span className="text-xl font-black text-[#58CC02]">{formatVND(contract.depositHeldAmount)}</span>
                </div>
              </div>

              {/* Nut tuy chon hop dong */}
              <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-4 flex flex-col items-center gap-3 mt-2 text-center">
                <span className="text-xs font-bold text-[#AFAFAF]">Cáº§n thÃªm thá»i gian hoáº·c tráº£ kho sá»›m?</span>
                <button
                  type="button"
                  onClick={() => setIsOptionsModalOpen(true)}
                  className="duo-btn-blue w-full px-5 py-3 text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  TÃ™Y CHá»ŒN Há»¢P Äá»’NG
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Thong tin truy cap */}
        <div className="duo-card p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-[#E5E5E5]">
            <span className="material-symbols-outlined text-[#FF4B4B] text-[28px]">lock</span>
            <h2 className="text-lg font-black text-[#4B4B4B] uppercase">Truy cáº­p kho</h2>
          </div>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-5 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">pin</span> MÃ£ PIN SmartLock
              </span>
              {contract.accessPinCode ? (
                <span className="text-3xl font-mono font-black tracking-[0.3em] text-[#4B4B4B]">{contract.accessPinCode}</span>
              ) : (
                <span className="text-sm font-bold text-[#AFAFAF] italic">ChÆ°a Ä‘Æ°á»£c cáº¥p phÃ¡t</span>
              )}
            </div>
            
            <div className="bg-[#FAFAFA] border-2 border-[#E5E5E5] rounded-2xl p-5 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#AFAFAF] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">contactless</span> MÃ£ tháº» RFID
              </span>
              {contract.rfidCardCode ? (
                <span className="text-lg font-mono font-black tracking-widest text-[#4B4B4B]">{contract.rfidCardCode}</span>
              ) : (
                <span className="text-sm font-bold text-[#AFAFAF] italic">ChÆ°a Ä‘Æ°á»£c cáº¥p phÃ¡t</span>
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
          QUAY Láº I ÄÆ N Äáº¶T CHá»–
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

