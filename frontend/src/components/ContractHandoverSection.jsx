import { useEffect, useState } from 'react'
import { getHandoverRecords, getUnitTransfers } from '../services/contractService'
import { HandoverRecordList } from './HandoverPhotos'

const REASON_LABELS = {
  FACILITY_ISSUE: 'Ô có sự cố do cơ sở',
  CUSTOMER_REQUEST: 'Khách yêu cầu',
  REARRANGE: 'Cơ sở sắp xếp lại',
}

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// BR-121 + BR-122: biên bản nhận / trả kho kèm ảnh và lịch sử chuyển ô của 1 hợp đồng.
// reloadKey đổi → tải lại (vd sau khi check-in online / chuyển ô)
export default function ContractHandoverSection({ contractId, reloadKey }) {
  const [records, setRecords] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!contractId) return
    let cancelled = false
    Promise.all([getHandoverRecords(contractId), getUnitTransfers(contractId)])
      .then(([r, t]) => {
        if (cancelled) return
        setRecords(r || [])
        setTransfers(t || [])
        setError('')
      })
      .catch(err => !cancelled && setError(err.response?.data?.message || 'Không tải được biên bản bàn giao.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [contractId, reloadKey])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-[#58CC02]">fact_check</span>
          Biên bản bàn giao & ảnh hiện trạng
        </h3>
        <p className="text-[11px] font-bold text-[#AFAFAF]">
          Ảnh chụp lúc nhận và lúc trả kho là căn cứ xác định hư hỏng phát sinh trong thời gian thuê do ai gây ra.
        </p>
        {loading ? (
          <p className="text-xs font-bold text-[#AFAFAF]">Đang tải...</p>
        ) : error ? (
          <p className="text-xs font-bold text-[#FF4B4B]">{error}</p>
        ) : (
          <HandoverRecordList records={records} />
        )}
      </div>

      {transfers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#FF9600]">swap_horiz</span>
            Lịch sử chuyển ô
          </h3>
          <ul className="flex flex-col gap-2">
            {transfers.map(t => (
              <li key={t.id} className="rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs font-bold text-[#4B4B4B] flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{t.fromUnitId}</span>
                  <span className="material-symbols-outlined text-[16px] text-[#AFAFAF]">arrow_forward</span>
                  <span className="font-mono text-[#1CB0F6]">{t.toUnitId}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FFF0D6] text-[#D97706]">
                    {REASON_LABELS[t.reasonType] || t.reasonType}
                  </span>
                  <span className="text-[11px] text-[#AFAFAF] ml-auto">{formatDateTime(t.createdAt)}</span>
                </span>
                <span className="text-[#777777]">{t.reason}</span>
                {t.movedByName && <span className="text-[11px] text-[#AFAFAF]">Thực hiện: {t.movedByName}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
