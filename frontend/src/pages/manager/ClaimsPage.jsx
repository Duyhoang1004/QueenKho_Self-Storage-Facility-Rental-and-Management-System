import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { decideClaim, getClaimDetail, getClaims, payClaim, quoteClaim } from '../../services/claimService'
import { getSensorReadings } from '../../services/contractService'
import { simulateInsurancePayout } from '../../services/simulationService'
import { HandoverPhotoPicker, PhotoGrid } from '../../components/HandoverPhotos'
import ContractHandoverSection from '../../components/ContractHandoverSection'
import { SensorSparkline } from '../../components/ContractProtectionPanel'
import { sensorRange } from '../../utils/sensor'
import SimulationButton from '../../components/SimulationButton'
import TimeFilterBar from '../../components/TimeFilterBar'
import { applyTimeFilter, makeTimeFilter } from '../../utils/timeFilter'
import { formatDateTimeVN } from '../../utils/date'

// (10/11/2026) Lọc / sắp hồ sơ theo thời gian — mặc định hồ sơ mới nhất trước
const CLAIM_TIME_FIELDS = [
  { key: 'createdAt', label: 'Ngày lập hồ sơ', get: (c) => c.createdAt },
  { key: 'incidentDate', label: 'Ngày xảy ra sự cố', get: (c) => c.incidentDate },
]

// BR-126 → BR-128: hồ sơ bồi thường hàng hư / mất. FM thẩm định, chốt, chi trả; BOM chỉ xem (chi phí bồi thường toàn chuỗi).

const STATUS_META = {
  SUBMITTED: { label: 'Chờ kiểm tra', cls: 'bg-[#DDF4FF] text-[#1CB0F6]' },
  INSPECTED: { label: 'Chờ thẩm định', cls: 'bg-[#F3E8FF] text-[#A560E8]' },
  APPROVED: { label: 'Chờ chi trả', cls: 'bg-[#FFE8CC] text-[#E58800]' },
  PAID: { label: 'Đã chi trả', cls: 'bg-[#D7FFB8] text-[#58A700]' },
  REJECTED: { label: 'Từ chối', cls: 'bg-[#FFDFDF] text-[#FF4B4B]' },
  WITHDRAWN: { label: 'Khách rút', cls: 'bg-[#F7F7F7] text-[#777777]' },
}
const LIABLE_LABELS = { CUSTOMER: 'Lỗi do khách', FACILITY: 'Lỗi do cơ sở', FORCE_MAJEURE: 'Bất khả kháng', UNKNOWN: 'Chưa xác định' }
const INSURANCE_LABELS = { NOT_APPLICABLE: 'Không áp dụng', SUBMITTED: 'Đã gửi, chờ bảo hiểm', APPROVED: 'Bảo hiểm đã duyệt', PAID: 'Bảo hiểm đã chi trả', REJECTED: 'Bảo hiểm từ chối' }

function formatVND(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('vi-VN') + 'đ'
}

function formatDateTime(value) {
  if (!value) return '—'
  return formatDateTimeVN(value)
}

function isBom() {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}').role === 'BOM'
  } catch {
    return false
  }
}

function Card({ icon, title, children }) {
  return (
    <div className="duo-card p-5 flex flex-col gap-3">
      <h2 className="text-sm font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[20px] text-[#1CB0F6]">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-xs font-bold">
      <span className="text-[#AFAFAF]">{label}</span>
      <span className="text-[#4B4B4B] text-right">{value}</span>
    </div>
  )
}

export default function ClaimsPage() {
  const { id } = useParams()
  return id ? <ClaimDetail claimId={id} /> : <ClaimList />
}

function ClaimList() {
  const navigate = useNavigate()
  const bom = isBom()
  const base = bom ? '/bom/claims' : '/manager/claims'
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('OPEN')
  const [timeFilter, setTimeFilter] = useState(() => makeTimeFilter(CLAIM_TIME_FIELDS, 'desc'))

  useEffect(() => {
    let cancelled = false
    getClaims()
      .then((data) => { if (!cancelled) setClaims(data || []) })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Không tải được hồ sơ bồi thường.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const visible = applyTimeFilter(claims.filter((c) => filter === 'ALL'
    || (filter === 'OPEN' ? ['SUBMITTED', 'INSPECTED', 'APPROVED'].includes(c.status) : c.status === filter)),
  timeFilter, CLAIM_TIME_FIELDS)
  const paidTotal = claims.filter((c) => c.status === 'PAID').reduce((s, c) => s + Number(c.totalCompensation || 0), 0)
  const recovered = claims.filter((c) => c.insuranceStatus === 'PAID').reduce((s, c) => s + Number(c.insuranceAmount || 0), 0)

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-[#4B4B4B]">Bồi thường hàng hư / mất</h1>
        <p className="text-xs font-bold text-[#AFAFAF]">
          Hồ sơ sinh từ yêu cầu hỗ trợ “Hàng bị hư hỏng” / “Mất hàng”. Nhân viên kiểm tra hiện trường → {bom ? 'quản lý cơ sở' : 'bạn'} thẩm định, chốt mức bồi thường → chi trả → gói có bảo hiểm thì đòi lại bên bảo hiểm.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="duo-card p-4"><p className="text-[11px] font-black uppercase text-[#AFAFAF]">Đang xử lý</p><p className="text-xl font-black text-[#4B4B4B]">{claims.filter((c) => ['SUBMITTED', 'INSPECTED', 'APPROVED'].includes(c.status)).length}</p></div>
        <div className="duo-card p-4"><p className="text-[11px] font-black uppercase text-[#AFAFAF]">Đã chi bồi thường</p><p className="text-xl font-black text-[#FF4B4B]">{formatVND(paidTotal)}</p></div>
        <div className="duo-card p-4"><p className="text-[11px] font-black uppercase text-[#AFAFAF]">Bảo hiểm đã trả lại</p><p className="text-xl font-black text-[#58A700]">{formatVND(recovered)}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[['OPEN', 'Đang xử lý'], ['PAID', 'Đã chi trả'], ['REJECTED', 'Từ chối'], ['ALL', 'Tất cả']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-2xl text-xs font-black border-2 ${filter === key ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#1CB0F6]' : 'bg-white border-[#E5E5E5] text-[#777777]'}`}>
            {label}
          </button>
        ))}
      </div>
      <TimeFilterBar value={timeFilter} onChange={setTimeFilter} fields={CLAIM_TIME_FIELDS} />
      <div className="duo-card overflow-x-auto custom-scrollbar" role="region" aria-label="Danh sách hồ sơ bồi thường" tabIndex={0}>
        {loading ? (
          <p className="p-6 text-xs font-bold text-[#AFAFAF]">Đang tải...</p>
        ) : error ? (
          <p className="p-6 text-xs font-bold text-[#FF4B4B]">{error}</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-xs font-bold text-[#AFAFAF]">Không có hồ sơ nào.</p>
        ) : (
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="bg-[#F7F7F7] text-[11px] font-black uppercase text-[#AFAFAF] whitespace-nowrap">
              <tr>
                <th className="py-3 px-4">Mã</th><th className="py-3 px-4">Loại</th><th className="py-3 px-4">Khách</th>
                {bom && <th className="py-3 px-4">Cơ sở</th>}
                <th className="py-3 px-4">HĐ / Ô</th><th className="py-3 px-4">Đề nghị</th><th className="py-3 px-4">Bồi thường</th><th className="py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#F0F0F0] font-bold text-[#4B4B4B]">
              {visible.map((c) => (
                <tr key={c.id} onClick={() => navigate(`${base}/${c.id}`)} className="cursor-pointer hover:bg-[#FAFAFA]">
                  <td className="py-3 px-4 font-black text-[#1CB0F6]">{c.claimCode}</td>
                  <td className="py-3 px-4">{c.claimType === 'GOODS_LOSS' ? 'Mất hàng' : 'Hư hỏng'}</td>
                  <td className="py-3 px-4">{c.customerName}</td>
                  {bom && <td className="py-3 px-4">{c.facilityName}</td>}
                  <td className="py-3 px-4">{c.contractCode} · {c.storageUnitId}</td>
                  <td className="py-3 px-4">{formatVND(c.claimedAmount)}</td>
                  <td className="py-3 px-4">{c.totalCompensation != null ? formatVND(c.totalCompensation) : '—'}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${STATUS_META[c.status]?.cls}`}>{STATUS_META[c.status]?.label || c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ClaimDetail({ claimId }) {
  const bom = isBom()
  const base = bom ? '/bom/claims' : '/manager/claims'
  const [claim, setClaim] = useState(null)
  const [error, setError] = useState('')
  const [sensor, setSensor] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState(null)

  const load = useCallback(() => {
    getClaimDetail(claimId)
      .then((data) => {
        setClaim(data)
        setError('')
        if (data.contractId) {
          getSensorReadings(data.contractId, { days: 3, around: data.incidentDate || undefined })
            .then(setSensor).catch(() => setSensor(null))
        }
      })
      .catch((err) => setError(err.response?.data?.message || 'Không tải được hồ sơ.'))
  }, [claimId])

  useEffect(() => { load() }, [load, reloadKey])

  if (error) return <div className="p-8 text-sm font-black text-[#FF4B4B]">{error}</div>
  if (!claim) return <div className="p-8 text-xs font-bold text-[#AFAFAF]">Đang tải hồ sơ...</div>
  const agreedGoodsValue = claim.agreedGoodsValue ?? claim.declaredGoodsValue

  const refresh = (message) => {
    if (message) setToast(message)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={base} className="duo-btn-white px-4 py-2 text-xs">
          <span className="material-symbols-outlined text-[18px] mr-1">arrow_back</span>QUAY LẠI
        </Link>
        <h1 className="text-xl font-black text-[#4B4B4B]">Hồ sơ {claim.claimCode}</h1>
        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${STATUS_META[claim.status]?.cls}`}>{STATUS_META[claim.status]?.label}</span>
      </div>
      {toast && (
        <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] px-4 py-3 text-xs font-black text-[#58A700] flex justify-between">
          {toast}<button type="button" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card icon="person" title="Khách đề nghị">
          <Row label="Loại" value={claim.claimType === 'GOODS_LOSS' ? 'Mất hàng' : 'Hàng bị hư hỏng'} />
          <Row label="Khách" value={`${claim.customerName} · ${claim.customerPhone || ''}`} />
          <Row label="Hợp đồng / ô" value={bom ? `${claim.contractCode} · ${claim.storageUnitId}` : <Link className="text-[#1CB0F6]" to={`/manager/contracts/${claim.contractId}`}>{claim.contractCode} · {claim.storageUnitId}</Link>} />
          <Row label="Phiếu hỗ trợ" value={claim.ticketCode} />
          <Row label="Ngày phát hiện" value={claim.incidentDate || '—'} />
          <Row label="Số tiền đề nghị" value={formatVND(claim.claimedAmount)} />
          <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line bg-[#F7F7F7] rounded-xl p-3">{claim.itemsDescription}</p>
          {claim.customerImages?.length > 0 ? <PhotoGrid images={claim.customerImages} /> : <p className="text-[11px] font-bold text-[#AFAFAF]">Khách không gửi ảnh.</p>}
        </Card>

        <Card icon="verified_user" title="Bảo hiểm & trần bồi thường">
          <Row label="Gói bảo hiểm" value={`${claim.insurancePlanLabel}${claim.insured ? ' (có bảo hiểm đối tác)' : ' (cơ sở tự bảo trợ)'}`} />
          <Row label="Hạn mức trần gói" value={formatVND(claim.planCoverageLimit)} />
          <Row
             label="Giá trị hàng đã chốt khi check-in"
            value={
               agreedGoodsValue
                 ? <>{formatVND(agreedGoodsValue)}{claim.agreedGoodsValue ? <span className="block text-[10px] text-[#58A700]">FM đã thẩm định và chốt</span> : null}</>
                 : <span className="text-[#E58800]">Không có giá trị đã chốt (áp trần mặc định 5.000.000đ)</span>
            }
          />
          <Row
            label="Trần bồi thường áp dụng"
            value={
              <strong className="text-[#1CB0F6] text-sm">
                {formatVND(claim.coverageCap)}
              </strong>
            }
          />

          <div className="rounded-xl bg-[#F0F8FF] border border-[#BAE3FF] p-3 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-black text-[#006699]">
              <span className="material-symbols-outlined text-[18px]">calculate</span>
              Công thức xác định trần bồi thường hàng:
            </div>
            <div className="text-[#4B4B4B] font-mono text-[11px] bg-white rounded-lg p-2 border border-[#E0F0FF] leading-relaxed">
               Trần = min(Giá trị đã chốt khi check-in, Hạn mức gói bảo hiểm)
              <br />
               = min({agreedGoodsValue ? formatVND(agreedGoodsValue) : '5.000.000đ (mức sàn không có giá trị)'}, {formatVND(claim.planCoverageLimit)})
              <br />
              = <strong className="text-[#1CB0F6]">{formatVND(claim.coverageCap)}</strong>
            </div>

            {!agreedGoodsValue && (
              <div className="flex items-start gap-1.5 text-[11px] font-semibold text-[#D96B00] bg-[#FFF8E6] p-2 rounded-lg border border-[#FFE0A3]">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 text-[#E58800]">warning</span>
                <span>
                  <strong>Không khai báo giá trị tài sản khi ký HĐ:</strong> Áp dụng mức trần bảo vệ sàn mặc định <strong>5.000.000đ</strong> (theo Điều khoản HĐ D-14 / Quy tắc BR-125) để phòng ngừa rủi ro gian lận & trục lợi.
                </span>
              </div>
            )}

            {agreedGoodsValue && Number(agreedGoodsValue) > Number(claim.planCoverageLimit || 0) && (
              <div className="flex items-start gap-1.5 text-[11px] font-semibold text-[#D96B00] bg-[#FFF8E6] p-2 rounded-lg border border-[#FFE0A3]">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 text-[#E58800]">warning</span>
                <span>
                   <strong>Giá trị hàng đã chốt ({formatVND(agreedGoodsValue)}) vượt trần gói {claim.insurancePlanLabel} ({formatVND(claim.planCoverageLimit)}):</strong> Mức bồi thường hàng bị khống chế tối đa ở trần gói <strong>{formatVND(claim.coverageCap)}</strong>.
                </span>
              </div>
            )}

            {claim.insured && (
              <div className="flex items-start gap-1.5 text-[11px] font-semibold text-[#008040] bg-[#F0FFF4] p-2 rounded-lg border border-[#B7F4C8]">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 text-[#58A700]">verified_user</span>
                <span>
                  <strong>Gói có đối tác bảo hiểm liên kết:</strong> Cơ sở chi trả trước cho khách hàng, sau đó hệ thống tự động lập hồ sơ đòi lại tiền hàng từ đơn vị bảo hiểm.
                </span>
              </div>
            )}
          </div>

          <Row label="Giá thuê tháng" value={formatVND(claim.monthlyPrice)} />
          <div className="border-t-2 border-[#F0F0F0] pt-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-black uppercase text-[#777777] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#FF9600]">device_thermostat</span>
              Cảm biến quanh ngày sự cố (±3 ngày)
            </span>
            {sensor?.readings?.length ? (
              <>
                <SensorSparkline readings={sensor.readings} tempMax={sensor.tempMax} />
                <span className={`text-[11px] font-bold ${sensor.alertCount > 0 ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
                  {sensor.alertCount > 0
                    ? `${sensor.alertCount} lần vượt ngưỡng ${sensorRange(sensor)} — căn cứ xác định lỗi cơ sở`
                    : 'Không có lần vượt ngưỡng nào'}
                </span>
              </>
            ) : (
              <span className="text-[11px] font-bold text-[#AFAFAF]">Không có số liệu cảm biến trong khoảng này.</span>
            )}
          </div>
        </Card>
      </div>

      <Card icon="fact_check" title="Kiểm tra hiện trường (nhân viên)">
        {claim.inspectedAt ? (
          <>
            <Row label="Người kiểm tra" value={`${claim.inspectedByName} · ${formatDateTime(claim.inspectedAt)}`} />
            <Row label="Nguyên nhân sơ bộ" value={LIABLE_LABELS[claim.preliminaryCause] || '—'} />
            <p className="text-xs font-bold text-[#4B4B4B] bg-[#F7F7F7] rounded-xl p-3 whitespace-pre-line">{claim.inspectionNote}</p>
            <PhotoGrid images={claim.inspectionImages} />
          </>
        ) : (
          <p className="text-xs font-bold text-[#AFAFAF]">Chưa kiểm tra — nhân viên nhận task hỗ trợ của phiếu {claim.ticketCode} và lập biên bản.</p>
        )}
      </Card>

      {!bom && (
        <Card icon="photo_library" title="Biên bản nhận kho / trả kho (đối chiếu hiện trạng ô)">
          <ContractHandoverSection contractId={claim.contractId} reloadKey={reloadKey} />
        </Card>
      )}

      {claim.status === 'INSPECTED' && !bom && <DecisionForm claim={claim} onDone={refresh} />}
      {['APPROVED', 'PAID', 'REJECTED'].includes(claim.status) && <DecisionSummary claim={claim} />}
      {claim.status === 'APPROVED' && !bom && claim.settlementId ? (
        /* Bảng quyết toán cũ (D-21 → 23/11) đã gộp bồi thường → chi trong task hoàn tiền.
           PR-O19c (24/11/2026): hồ sơ mới luôn chi riêng ở PaymentForm, kể cả khi khách đã hẹn trả kho */
        <Card icon="receipt_long" title="Chi trả qua quyết toán trả kho">
          <p className="text-xs font-bold text-[#4B4B4B] leading-relaxed">
            Hồ sơ này đã nằm trong bảng quyết toán trả kho của hợp đồng {claim.contractCode} (lập trước 24/11).
            {formatVND(claim.totalCompensation)} bồi thường được chi trong task hoàn tiền trả kho (dòng "Bồi thường hàng hư / mất"), hoặc cấn trừ vào phần khách phải trả.
          </p>
          {/* D-23 / PR-O30: đi thẳng tới task hoàn tiền chứa khoản bồi thường */}
          {claim.refundTaskId ? (
            <a href={`/manager/refunds/${claim.refundTaskId}`} className="duo-btn-green px-4 py-2 text-xs self-start flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">currency_exchange</span>Chi bồi thường trong task hoàn tiền #{claim.refundTaskId}
            </a>
          ) : (
            <p className="text-xs font-bold text-[#B07A00]">
              {claim.settlementStatus === 'AWAITING_PAYMENT'
                ? 'Quyết toán âm: bồi thường đã cấn trừ vào khoản khách phải trả.'
                : claim.contractStatus === 'TERMINATION_PENDING'
                  ? 'Chưa nghiệm thu trả kho — sau nghiệm thu, bảng quyết toán có dòng "Bồi thường hàng hư / mất".'
                  : 'Chưa có task hoàn tiền — chờ khách xác nhận bảng quyết toán.'}
            </p>
          )}
          <a href="/manager/settlements?tab=ALL" className="duo-btn-blue px-4 py-2 text-xs self-start">Mở quyết toán trả kho</a>
        </Card>
      ) : claim.status === 'APPROVED' && !bom && <PaymentForm claim={claim} onDone={refresh} />}
      {claim.status === 'PAID' && (
        <Card icon="health_and_safety" title="Chi trả & đòi bảo hiểm">
          <Row label="Đã chi" value={`${formatVND(claim.totalCompensation)} · ${claim.paymentMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản'} · ${formatDateTime(claim.paidAt)}`} />
          {claim.bankTransactionCode && <Row label="Mã FT" value={claim.bankTransactionCode} />}
          {claim.paymentEvidence && <PhotoGrid images={[claim.paymentEvidence]} />}
          <Row label="Hồ sơ bảo hiểm" value={INSURANCE_LABELS[claim.insuranceStatus] || '—'} />
          {claim.insuranceRef && <Row label="Mã hồ sơ bảo hiểm" value={claim.insuranceRef} />}
          {claim.insuranceStatus === 'PAID' && <Row label="Bảo hiểm đã trả cơ sở" value={formatVND(claim.insuranceAmount)} />}
          {claim.insuranceStatus === 'SUBMITTED' && !bom && (
            <SimulationButton
              label="Bảo hiểm duyệt & chi trả"
              description="Giả lập phản hồi của đối tác bảo hiểm: duyệt hồ sơ và chuyển phần tiền hàng cho cơ sở."
              onRun={() => simulateInsurancePayout(claim.id)}
              onDone={() => refresh('Bảo hiểm đã chi trả cho cơ sở.')}
            />
          )}
        </Card>
      )}
    </div>
  )
}

function DecisionSummary({ claim }) {
  const agreedGoodsValue = claim.agreedGoodsValue ?? claim.declaredGoodsValue
  const goodsLoss = Number(claim.assessedValue || 0) * (Number(claim.damagePercent ?? 100) / 100)
  const isCapped = goodsLoss > Number(claim.coverageCap || 0)

  return (
    <Card icon="gavel" title="Kết luận thẩm định">
      <Row label="Bên chịu lỗi" value={LIABLE_LABELS[claim.liableParty]} />
      <Row label="Giá trị thẩm định" value={`${formatVND(claim.assessedValue)} × ${claim.damagePercent ?? 100}% = ${formatVND(goodsLoss)}`} />
      <Row
        label="Trần bồi thường áp dụng"
        value={
          <span className="text-right">
            <strong className="text-[#1CB0F6]">{formatVND(claim.coverageCap)}</strong>
            <span className="text-[10px] text-[#777777] block font-normal">
               min({agreedGoodsValue ? formatVND(agreedGoodsValue) : '5.000.000đ mặc định'}, trần gói {formatVND(claim.planCoverageLimit)})
            </span>
          </span>
        }
      />
      <Row label="Tiền hàng được bồi thường" value={
        <span className="text-right">
          <strong className="text-[#4B4B4B]">{formatVND(claim.goodsCompensation)}</strong>
          <span className="text-[10px] text-[#777777] block font-normal">= giá trị thiệt hại hàng hư hỏng ({formatVND(goodsLoss)}), tối đa trần {formatVND(claim.coverageCap)}</span>
        </span>
      } />
      {isCapped && claim.liableParty === 'FACILITY' && (
        <div className="p-2.5 rounded-xl bg-[#FFF8E6] border border-[#FFE0A3] text-[#D96B00] text-[11px] font-semibold leading-relaxed flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 text-[#E58800]">info</span>
          <div>
            <strong>Khống chế trần bồi thường:</strong> Thiệt hại hàng thực tế ({formatVND(goodsLoss)}) vượt quá trần bồi thường hợp đồng ({formatVND(claim.coverageCap)}) nên được chốt ở mức trần <strong>{formatVND(claim.goodsCompensation)}</strong>.
          </div>
        </div>
      )}
      <Row label={claim.resolution === 'TERMINATE' ? "Đền bù thêm theo hợp đồng (cơ sở chịu)" : "Đền bù thêm theo hợp đồng (tiếp tục thuê: 0đ)"} value={
        <span className="text-right">
          {formatVND(claim.penaltyAmount)}
          {claim.resolution === 'TERMINATE' && <span className="text-[10px] text-[#777777] block font-normal">1 tháng tiền thuê vì chấm dứt hợp đồng</span>}
        </span>
      } />
      <Row label={`Hoàn tiền thuê (${claim.unusableDays ?? 0} ngày)`} value={formatVND(claim.rentRefundAmount)} />
      <Row label="Tổng bồi thường" value={<strong className="text-[#58A700] text-sm">{formatVND(claim.totalCompensation)}</strong>} />
      <Row label="Hướng xử lý" value={claim.resolution === 'TERMINATE' ? 'Chấm dứt hợp đồng không phí phá HĐ' : 'Tiếp tục thuê (có thể chuyển ô cùng loại)'} />
      <Row label="Người chốt" value={`${claim.decidedByName || '—'} · ${formatDateTime(claim.decidedAt)}`} />
      {claim.decisionNote && (
        <div className="bg-[#F7F7F7] rounded-xl p-3 border border-[#EAEAEA] flex flex-col gap-1 text-xs">
          <span className="text-[10px] font-black uppercase text-[#777777]">Ghi chú kết luận gửi khách:</span>
          <p className="font-bold text-[#4B4B4B] whitespace-pre-line">{claim.decisionNote}</p>
        </div>
      )}
    </Card>
  )
}

function DecisionForm({ claim, onDone }) {
  const agreedGoodsValue = claim.agreedGoodsValue ?? claim.declaredGoodsValue
  const isLoss = claim.claimType === 'GOODS_LOSS'
  const [form, setForm] = useState({
    liableParty: ['CUSTOMER', 'FACILITY', 'FORCE_MAJEURE'].includes(claim.preliminaryCause) ? claim.preliminaryCause : 'FACILITY',
    assessedValue: String(Number(claim.claimedAmount)),
    damagePercent: isLoss ? '100' : '50',
    unusableDays: '0',
    resolution: 'CONTINUE',
    note: '',
  })
  const [quote, setQuote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const payload = () => ({
    liableParty: form.liableParty,
    assessedValue: Number(form.assessedValue || 0),
    damagePercent: isLoss ? 100 : Number(form.damagePercent || 0),
    unusableDays: Number(form.unusableDays || 0),
    resolution: form.resolution,
    note: form.note.trim(),
  })
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setQuote(null) }

  const runQuote = () => {
    setBusy(true)
    setError('')
    quoteClaim(claim.id, payload()).then(setQuote)
      .catch((err) => setError(err.response?.data?.message || 'Không tính được.'))
      .finally(() => setBusy(false))
  }
  const submit = () => {
    setBusy(true)
    setError('')
    decideClaim(claim.id, payload())
      .then((res) => onDone(res.status === 'REJECTED' ? 'Đã kết luận không bồi thường, khách đã nhận thông báo.' : `Đã chốt bồi thường ${formatVND(res.totalCompensation)} — chờ chi trả.`))
      .catch((err) => setError(err.response?.data?.message || 'Không chốt được hồ sơ.'))
      .finally(() => setBusy(false))
  }

  return (
    <Card icon="gavel" title="Thẩm định & chốt bồi thường">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
          Bên chịu lỗi
          <select value={form.liableParty} onChange={set('liableParty')} className="duo-input text-xs normal-case">
            <option value="FACILITY">Lỗi do cơ sở — bồi thường hàng (+ phạt 1 tháng nếu hủy HĐ)</option>
            <option value="FORCE_MAJEURE">Bất khả kháng — chỉ gói có bảo hiểm được tiền hàng</option>
            <option value="CUSTOMER">Lỗi do khách — không bồi thường</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
          Giá trị hàng thẩm định (≤ {formatVND(claim.claimedAmount)})
          <input type="number" min="0" value={form.assessedValue} onChange={set('assessedValue')} className="duo-input text-xs" />
        </label>
        {!isLoss && (
          <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
            Mức hư hại (%)
            <input type="number" min="1" max="100" value={form.damagePercent} onChange={set('damagePercent')} className="duo-input text-xs" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
          Số ngày ô không dùng được (hoàn tiền thuê theo ngày)
          <input type="number" min="0" max="90" value={form.unusableDays} onChange={set('unusableDays')} className="duo-input text-xs" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
          Hướng xử lý hợp đồng (đã thống nhất với khách)
          <select value={form.resolution} onChange={set('resolution')} className="duo-input text-xs normal-case">
            <option value="CONTINUE">Tiếp tục thuê — chuyển ô cùng loại miễn phí nếu cần</option>
            <option value="TERMINATE">Chấm dứt hợp đồng — không phí phá HĐ, hoàn tiền thuê theo ngày còn lại</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
        Kết luận gửi khách (10–1000 ký tự)
        <textarea rows={3} value={form.note} onChange={set('note')} className="duo-input text-xs normal-case resize-none"
          placeholder="VD: Ảnh nhận kho cho thấy trần ô khô ráo; cảm biến ghi nhận độ ẩm 88% ngày 03/11 do hỏng máy hút ẩm → lỗi cơ sở." />
      </label>
      {quote && (
        <div className="rounded-2xl bg-[#F7F7F7] p-4 flex flex-col gap-2.5 border border-[#E5E5E5]">
          <div className="flex items-center justify-between pb-2 border-b border-[#EAEAEA]">
            <span className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#58A700]">receipt_long</span>
              Bảng tính chi tiết bồi thường
            </span>
            <span className="text-[11px] font-bold text-[#777777]">
              Bên chịu lỗi: <strong className="text-[#4B4B4B]">{LIABLE_LABELS[form.liableParty]}</strong>
            </span>
          </div>

          <Row label="Thiệt hại hàng (thẩm định × % hư hại)" value={formatVND(quote.goodsLoss)} />
          <Row
            label="Trần bồi thường áp dụng"
            value={
              <span className="text-right">
                <strong className="text-[#1CB0F6]">{formatVND(quote.coverageCap)}</strong>
                <span className="text-[10px] text-[#888888] block font-normal">
                   min({agreedGoodsValue ? formatVND(agreedGoodsValue) : '5.000.000đ mặc định'}, trần gói {formatVND(claim.planCoverageLimit)})
                </span>
              </span>
            }
          />

          {Number(quote.goodsLoss) > Number(quote.coverageCap) && form.liableParty === 'FACILITY' && (
            <div className="p-2.5 rounded-xl bg-[#FFF8E6] border border-[#FFE0A3] text-[#D96B00] text-[11px] font-semibold leading-relaxed flex items-start gap-1.5">
              <span className="material-symbols-outlined text-[18px] shrink-0 text-[#E58800]">info</span>
              <div>
                <strong>Khống chế trần bồi thường:</strong> Thiệt hại hàng ({formatVND(quote.goodsLoss)}) vượt trần bồi thường ({formatVND(quote.coverageCap)}). Mức bồi thường tiền hàng thực tế được chốt ở mức trần hợp đồng: <strong>{formatVND(quote.goodsCompensation)}</strong>.
              </div>
            </div>
          )}

          <Row label="Tiền hàng được bồi thường" value={
            <span className="text-right">
              <strong className="text-[#4B4B4B]">{formatVND(quote.goodsCompensation)}</strong>
              <span className="text-[10px] text-[#777777] block font-normal">= giá trị thiệt hại hàng hư hỏng ({formatVND(quote.goodsLoss)}), tối đa trần {formatVND(quote.coverageCap)}</span>
            </span>
          } />
          <Row
            label={form.resolution === 'TERMINATE' ? "Đền bù thêm theo hợp đồng (cơ sở chịu)" : "Đền bù thêm theo hợp đồng (tiếp tục thuê: 0đ)"}
            value={
              <span className="text-right">
                {formatVND(quote.penaltyAmount)}
                {form.resolution === 'TERMINATE' && <span className="text-[10px] text-[#777777] block font-normal">1 tháng tiền thuê vì chấm dứt hợp đồng</span>}
              </span>
            }
          />
          <Row label={`Hoàn tiền thuê (${form.unusableDays || 0} ngày ô gián đoạn)`} value={formatVND(quote.rentRefundAmount)} />

          <div className="pt-2 border-t-2 border-[#E5E5E5] flex justify-between items-center">
            <span className="text-sm font-black uppercase text-[#4B4B4B]">Tổng cơ sở bồi thường</span>
            <span className="text-base font-black text-[#58A700]">{formatVND(quote.totalCompensation)}</span>
          </div>

          <div className="mt-1 p-3 rounded-xl bg-[#F0F8FF] border border-[#BAE3FF] text-[11px] text-[#006699] flex flex-col gap-1">
            <div className="flex items-center gap-1 font-black text-[#004B73]">
              <span className="material-symbols-outlined text-[16px]">balance</span>
              Giải trình căn cứ chốt bồi thường:
            </div>
            <p className="font-bold text-[#4B4B4B] leading-relaxed">{quote.explanation}</p>
            {quote.insuranceClaimable && (
              <p className="text-[10px] text-[#008040] font-bold mt-0.5">
                🛡️ Sau khi cơ sở chi trả {formatVND(quote.totalCompensation)}, hệ thống tự động lập hồ sơ đòi lại {formatVND(quote.goodsCompensation)} từ công ty bảo hiểm đối tác.
              </p>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs font-bold text-[#FF4B4B]">{error}</p>}
      <div className="flex flex-wrap gap-3 justify-end">
        <button type="button" onClick={runQuote} disabled={busy} className="duo-btn-white px-4 py-2 text-xs">Tính thử</button>
        <button type="button" onClick={submit} disabled={busy || !quote || form.note.trim().length < 10}
          className="duo-btn-green px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
          Chốt kết luận
        </button>
      </div>
      {!quote && <p className="text-[11px] font-bold text-[#AFAFAF] text-right">Bấm “Tính thử” để xem bảng tính trước khi chốt.</p>}
    </Card>
  )
}

function PaymentForm({ claim, onDone }) {
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [images, setImages] = useState([])
  const [ft, setFt] = useState('')
  const [cashConfirmed, setCashConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // BR-128a (24/11/2026): chuyển khoản cần tài khoản khách đã nhập trên hồ sơ
  const hasAccount = Boolean(claim.payoutAccountNumber)
  const ready = method === 'BANK_TRANSFER' ? hasAccount && images.length > 0 : (cashConfirmed || images.length > 0)

  const submit = () => {
    setBusy(true)
    setError('')
    payClaim(claim.id, {
      paymentMethod: method,
      evidenceImageUrl: images[0] || undefined,
      bankTransactionCode: ft.trim() || undefined,
      cashReceiptConfirmed: cashConfirmed,
    })
      .then((res) => onDone(`Đã chi trả ${formatVND(res.totalCompensation)}${res.insuranceRef ? ` — đã gửi hồ sơ bảo hiểm ${res.insuranceRef}` : ''}.`))
      .catch((err) => setError(err.response?.data?.message || 'Không lưu được chi trả.'))
      .finally(() => setBusy(false))
  }

  return (
    <Card icon="payments" title={`Chi trả ${formatVND(claim.totalCompensation)} cho khách`}>
      <div className="flex gap-2">
        {[['BANK_TRANSFER', 'Chuyển khoản'], ['CASH', 'Tiền mặt tại quầy']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMethod(key)}
            className={`px-4 py-2 rounded-2xl text-xs font-black border-2 ${method === key ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#1CB0F6]' : 'bg-white border-[#E5E5E5] text-[#777777]'}`}>
            {label}
          </button>
        ))}
      </div>
      {method === 'BANK_TRANSFER' && (hasAccount ? (
        <div className="rounded-xl border-2 border-[#84D8FF] bg-[#F5FBFF] px-3 py-2 text-xs font-bold text-[#4B4B4B] flex flex-col gap-0.5">
          <span className="text-[10px] font-black uppercase text-[#1899D6]">Tài khoản khách nhận tiền</span>
          <span>{claim.payoutBankName} · <span className="font-mono">{claim.payoutAccountNumber}</span> · {claim.payoutAccountName}</span>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-[#FFE0A3] bg-[#FFF8E6] px-3 py-2 text-xs font-bold text-[#D96B00]">
          Khách chưa nhập tài khoản nhận tiền bồi thường (mục Hỗ trợ của khách). Nhắc khách nhập, hoặc chọn chi tiền mặt tại quầy.
        </div>
      ))}
      <HandoverPhotoPicker
        images={images}
        onChange={(list) => setImages(list.slice(-1))}
        label={method === 'BANK_TRANSFER' ? 'Ảnh ủy nhiệm chi' : 'Ảnh biên nhận (tuỳ chọn)'}
        mockLabel={`Ủy nhiệm chi hồ sơ ${claim.claimCode}`}
        required={method === 'BANK_TRANSFER'}
      />
      {method === 'BANK_TRANSFER' ? (
        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#777777]">
          Mã FT (nếu có)
          <input value={ft} onChange={(e) => setFt(e.target.value)} className="duo-input text-xs" />
        </label>
      ) : (
        <label className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B]">
          <input type="checkbox" checked={cashConfirmed} onChange={(e) => setCashConfirmed(e.target.checked)} className="w-4 h-4" />
          Khách đã ký nhận tiền mặt
        </label>
      )}
      {error && <p className="text-xs font-bold text-[#FF4B4B]">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={busy || !ready} className="duo-btn-green px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
          Xác nhận đã chi trả
        </button>
      </div>
    </Card>
  )
}
