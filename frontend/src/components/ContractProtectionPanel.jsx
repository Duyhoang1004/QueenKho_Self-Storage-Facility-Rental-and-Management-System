import { useEffect, useState } from 'react'
import { getSensorReadings } from '../services/contractService'
import { simulateSensorAlert } from '../services/simulationService'
import SimulationButton from './SimulationButton'
import { sensorRange } from '../utils/sensor'

const LIVE_STATUSES = ['ACTIVE', 'OVERDUE', 'TERMINATION_PENDING']

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + 'đ'
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

// Biểu đồ nhỏ nhiệt độ (đường cam) và độ ẩm (đường xanh) — điểm đỏ là lúc vượt ngưỡng.
// Trục nhiệt độ tự co giãn theo số đo + ngưỡng của ô (kho lạnh / kho đông có nhiệt độ âm hoặc gần 0°C).
export function SensorSparkline({ readings, tempMax = 30 }) {
  if (!readings || readings.length < 2) return null
  const W = 320
  const H = 70
  const temps = readings.map((r) => Number(r.temperature))
  const hums = readings.map((r) => Number(r.humidity))
  const lo = Math.min(...temps, Number(tempMax)) - 2
  const hi = Math.max(...temps, Number(tempMax)) + 2
  const x = (i) => (i / (readings.length - 1)) * (W - 8) + 4
  const yT = (t) => H - 4 - ((t - lo) / (hi - lo)) * (H - 8)
  const yH = (h) => H - 4 - (Math.min(Math.max(h, 30), 100) - 30) / 70 * (H - 8)
  const path = (vals, y) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[70px]" role="img" aria-label="Biểu đồ nhiệt độ và độ ẩm">
      <line x1="0" x2={W} y1={yT(Number(tempMax))} y2={yT(Number(tempMax))} stroke="#FFB020" strokeDasharray="4 4" strokeWidth="1" />
      <path d={path(hums, yH)} fill="none" stroke="#1CB0F6" strokeWidth="2" />
      <path d={path(temps, yT)} fill="none" stroke="#FF9600" strokeWidth="2" />
      {readings.map((r, i) => r.alert && <circle key={i} cx={x(i)} cy={yT(temps[i])} r="3" fill="#FF4B4B" />)}
    </svg>
  )
}

// BR-125 / BR-127 / BR-129: gói bảo hiểm hàng hoá của hợp đồng + nhiệt độ / độ ẩm ô
export default function ContractProtectionPanel({ contract, viewer = 'customer', onChanged }) {
  const contractId = contract?.contractId || contract?.id
  const [sensor, setSensor] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!contractId) return
    let cancelled = false
    getSensorReadings(contractId, { days: 3 })
      .then((data) => { if (!cancelled) setSensor(data) })
      .catch(() => { if (!cancelled) setSensor(null) })
    return () => { cancelled = true }
  }, [contractId, reloadKey])

  if (!contract) return null
  const latest = sensor?.latest
  const live = LIVE_STATUSES.includes(contract.status)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF]/40 p-4 flex flex-col gap-1.5">
        <span className="text-[11px] font-black uppercase text-[#1899D6] flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
          Bảo hiểm hàng hoá
        </span>
        <span className="text-base font-black text-[#4B4B4B]">
          Gói {contract.insurancePlanLabel || 'Cơ bản'}
          {Number(contract.insurancePremiumMonthly) > 0 && (
            <span className="text-xs font-bold text-[#777777]"> · {formatVND(contract.insurancePremiumMonthly)}/tháng</span>
          )}
        </span>
        <span className="text-xs font-bold text-[#4B4B4B]">
          Trần bồi thường hàng: <strong className="text-[#1CB0F6]">{formatVND(contract.coverageCap)}</strong>
          {contract.declaredGoodsValue ? ` (khai báo ${formatVND(contract.declaredGoodsValue)})` : ' (không khai báo giá trị)'}
        </span>
        <span className="text-[11px] font-bold text-[#777777]">
          {contract.insured
            ? 'Có bảo hiểm: hàng hư / mất do lỗi kho hoặc thiên tai, hoả hoạn từ bên ngoài đều được bồi thường tới mức trần.'
            : 'Cơ sở tự chịu: chỉ bồi thường khi lỗi do kho (không gồm thiên tai, bất khả kháng).'}
        </span>
        {viewer === 'customer' && live && (
          <span className="text-[11px] font-bold text-[#1899D6]">
            Hàng bị hư / mất? Gửi yêu cầu hỗ trợ loại “Hàng bị hư hỏng” hoặc “Mất hàng” để mở hồ sơ bồi thường.
          </span>
        )}
        {contract.faultTermination && (
          <span className="text-[11px] font-black text-[#58A700]">
            Hồ sơ bồi thường cho phép chấm dứt hợp đồng không mất phí phá hợp đồng — tiền thuê còn lại hoàn theo ngày.
          </span>
        )}
      </div>

      <div className="rounded-2xl border-2 border-[#E5E5E5] p-4 flex flex-col gap-1.5">
        <span className="text-[11px] font-black uppercase text-[#777777] flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-[#FF9600]">device_thermostat</span>
          Giám sát nhiệt độ / độ ẩm (3 ngày)
        </span>
        {latest ? (
          <>
            <span className={`text-base font-black ${latest.alert ? 'text-[#FF4B4B]' : 'text-[#4B4B4B]'}`}>
              {Number(latest.temperature).toFixed(1)}°C · {Number(latest.humidity).toFixed(0)}%
              <span className="text-[11px] font-bold text-[#AFAFAF]"> lúc {formatTime(latest.recordedAt)}</span>
            </span>
            <SensorSparkline readings={sensor.readings} tempMax={sensor.tempMax} />
            <span className={`text-[11px] font-bold ${sensor.alertCount > 0 ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
              {sensor.alertCount > 0
                ? `${sensor.alertCount} lần vượt ngưỡng (an toàn ${sensorRange(sensor)})`
                : `Trong ngưỡng an toàn ${sensorRange(sensor)}`}
            </span>
          </>
        ) : (
          <span className="text-xs font-bold text-[#AFAFAF]">Chưa có số liệu cảm biến cho ô này.</span>
        )}
        {live && (
          <SimulationButton
            label="Cảm biến vượt ngưỡng"
            description="Ghi 12 giờ số đo: 6 giờ bình thường rồi vượt ngưỡng (kho thường nóng / ẩm dần tới 36°C; kho lạnh hỏng máy nén, ấm lên 14°C; kho đông rã đông lên -8°C). Hệ thống báo khách, FM và sinh việc kiểm tra cho nhân viên."
            onRun={() => simulateSensorAlert(contractId)}
            onDone={() => { setReloadKey((k) => k + 1); onChanged?.() }}
          />
        )}
      </div>
    </div>
  )
}
