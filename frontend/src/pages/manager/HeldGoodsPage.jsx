import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHeldGoods, resolveHeldGoods } from '../../services/heldGoodsService'
import SimulationButton from '../../components/SimulationButton'
import AssetTermsModal from '../../components/AssetTermsModal'
import { simulateExpireHeldGoods } from '../../services/simulationService'
import PaginationBar, { ListBoxHeader } from '../../components/PaginationBar'

const PAGE_SIZE = 5

// PR-Q10: Hàng của khách lưu giữ sau thanh lý — Điều khoản xử lý tài sản khi không trả kho (v1)
// Lưu giữ 60 ngày → khách nhận lại (hết nợ) / bán thanh lý (hết hạn + đã đồng ý điều khoản) / tiêu huỷ (hết hạn)
// / giao cơ quan chức năng (bất cứ lúc nào: hàng cấm, giấy tờ tuỳ thân).

const OUTCOMES = {
  RETURNED: { label: 'Khách nhận lại', icon: 'assignment_return', btn: 'duo-btn-green', badge: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  SOLD: { label: 'Bán thanh lý', icon: 'sell', btn: 'duo-btn-blue', badge: 'bg-[#DDF4FF] text-[#1899D6] border-[#84D8FF]' },
  DESTROYED: { label: 'Tiêu huỷ', icon: 'delete_forever', btn: 'duo-btn-red', badge: 'bg-[#FFDFDF] text-[#EA2B2B] border-[#FF4B4B]' },
  HANDED_TO_AUTHORITY: { label: 'Giao cơ quan chức năng', icon: 'local_police', btn: 'duo-btn-white', badge: 'bg-[#F3E8FF] text-[#9333EA] border-[#C084FC]' },
}

const NOTE_PLACEHOLDER = {
  RETURNED: 'VD: Khách Nguyễn Văn A (CCCD ...) đã kiểm tra và nhận đủ 12 thùng hàng, ký biên bản bàn giao.',
  SOLD: 'VD: Bán thanh lý cho cơ sở thu mua X, biên bản bán số 03/2026, có ảnh chứng từ.',
  DESTROYED: 'VD: Hàng hư hỏng không còn giá trị, tiêu huỷ có biên bản, 2 nhân sự chứng kiến.',
  HANDED_TO_AUTHORITY: 'VD: Giao CA phường 4 (cán bộ ...) 1 túi giấy tờ tuỳ thân, biên bản giao nhận số ...',
}

function formatVND(v) {
  return Number(v || 0).toLocaleString('vi-VN') + '₫'
}

function formatDate(val) {
  if (!val) return '—'
  const [y, m, d] = String(val).split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Vì sao nút xử lý bị khoá (null = bấm được)
function blockReason(item, outcome) {
  if (outcome === 'RETURNED' && Number(item.customerDebt) > 0) return `Khách còn nợ ${formatVND(item.customerDebt)} — phải trả hết trước khi nhận lại`
  if (outcome === 'SOLD' && !item.holdExpired) return `Chưa hết hạn lưu giữ (đến ${formatDate(item.holdUntil)})`
  if (outcome === 'SOLD' && !item.termsVersion) return 'Khách chưa đồng ý điều khoản (đơn cũ) — không được bán'
  if (outcome === 'DESTROYED' && !item.holdExpired) return `Chưa hết hạn lưu giữ (đến ${formatDate(item.holdUntil)})`
  return null
}

function HoldBadge({ item }) {
  if (item.holdExpired) {
    return <span className="duo-badge bg-[#FFDFDF] text-[#EA2B2B] border-2 border-[#FF4B4B] whitespace-nowrap">Hết hạn lưu giữ</span>
  }
  const urgent = item.daysLeft <= 7
  return (
    <span className={`duo-badge border-2 whitespace-nowrap ${urgent ? 'bg-[#FFF8E1] text-[#B78900] border-[#FFC800]' : 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]'}`}>
      Còn {item.daysLeft} ngày
    </span>
  )
}

export default function HeldGoodsPage() {
  const [tab, setTab] = useState('HOLDING')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [toast, setToast] = useState('')
  const [preview, setPreview] = useState(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'

  // Modal xử lý
  const [modal, setModal] = useState(null) // { item, outcome }
  const [note, setNote] = useState('')
  const [proceeds, setProceeds] = useState('')
  const [feeCollected, setFeeCollected] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    let cancelled = false
    getHeldGoods(tab)
      .then((data) => { if (!cancelled) { setItems(data); setError('') } })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Không tải được danh sách hàng lưu giữ.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab, reloadKey])

  const reload = () => { setLoading(true); setReloadKey((k) => k + 1) }
  const switchTab = (next) => { if (next !== tab) { setLoading(true); setTab(next); setCurrentPage(1) } }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openModal = (item, outcome) => {
    setModal({ item, outcome })
    setNote('')
    setProceeds('')
    setFeeCollected(false)
    setModalError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (note.trim().length < 10) {
      setModalError('Ghi chú / biên bản bắt buộc, tối thiểu 10 ký tự.')
      return
    }
    if (modal.outcome === 'SOLD' && (proceeds === '' || Number(proceeds) < 0)) {
      setModalError('Nhập số tiền bán thanh lý (≥ 0).')
      return
    }
    setSubmitting(true)
    setModalError('')
    try {
      await resolveHeldGoods(modal.item.id, {
        outcome: modal.outcome,
        note: note.trim(),
        proceedsAmount: modal.outcome === 'SOLD' ? Number(proceeds) : null,
        storageFeeCollected: modal.outcome === 'RETURNED' ? feeCollected : null,
      })
      setToast(`Đã ghi nhận "${OUTCOMES[modal.outcome].label}" cho hàng HĐ ${modal.item.contractCode}`)
      setTimeout(() => setToast(''), 4000)
      setModal(null)
      reload()
    } catch (err) {
      setModalError(err.response?.data?.message || 'Không xử lý được, vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  // Dự tính khi bán: tiền bán trừ nợ trước, rồi trừ phí lưu giữ (PR-Q15), phần dư + cọc còn giữ hoàn khách
  const saleProceeds = Number(proceeds) || 0
  const saleDebtOffset = modal ? Math.min(saleProceeds, Number(modal.item.customerDebt) || 0) : 0
  const storageFee = modal && modal.outcome !== 'HANDED_TO_AUTHORITY' ? Number(modal.item.estimatedStorageFee) || 0 : 0
  const saleFeeOffset = Math.min(storageFee, saleProceeds - saleDebtOffset)
  const saleSurplus = saleProceeds - saleDebtOffset - saleFeeOffset
  // Khách nhận lại: phí lưu giữ trừ vào cọc còn giữ, thiếu thì thu tại quầy
  const feeAtCounter = modal ? Math.max(0, storageFee - (Number(modal.item.depositHeld) || 0)) : 0

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl border-2 border-b-4 border-[#C084FC] bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px]">inventory_2</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#4B4B4B] tracking-tight">Hàng đang lưu giữ</h1>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Hàng của khách sau thanh lý hợp đồng — lưu giữ 60 ngày theo{' '}
              <button type="button" onClick={() => setTermsOpen(true)} className="text-[#1CB0F6] hover:underline cursor-pointer font-black">
                Điều khoản xử lý tài sản
              </button>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {[['HOLDING', 'Đang lưu giữ'], ['RESOLVED', 'Đã xử lý']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`px-4 py-2 rounded-xl border-2 text-xs font-black uppercase cursor-pointer ${
                tab === key ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#1CB0F6]' : 'bg-white border-[#E5E5E5] text-[#AFAFAF] hover:border-[#1CB0F6]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] px-4 py-3 text-xs font-black text-[#58A700] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>{toast}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-[#FFF5F5] border-2 border-[#FFDFDF] px-4 py-3 text-xs font-black text-[#FF4B4B]">{error}</div>
      )}

      <div className="duo-card overflow-hidden">
        <ListBoxHeader
          icon="inventory_2"
          title={tab === 'HOLDING' ? 'Danh sách hàng đang lưu giữ' : 'Hồ sơ hàng đã xử lý'}
          subtitle="Lưu giữ 60 ngày theo Điều khoản xử lý tài sản"
          count={items.length}
          countLabel="hồ sơ"
          accentColor="bg-[#F3E8FF] text-[#9333EA] border-[#C084FC]"
          rightSlot={
            <div className="flex items-center p-1 rounded-xl bg-white border-2 border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                  viewMode === 'list' ? 'bg-[#1CB0F6] text-white' : 'text-[#777777] hover:text-[#4B4B4B]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">view_agenda</span>
                <span>Thuôn dài</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${
                  viewMode === 'grid' ? 'bg-[#1CB0F6] text-white' : 'text-[#777777] hover:text-[#4B4B4B]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">grid_view</span>
                <span>Lưới 2 cột</span>
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="p-12 text-center text-xs font-black uppercase text-[#AFAFAF]">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#E5E5E5]">inventory_2</span>
            <p className="text-sm font-black text-[#4B4B4B]">
              {tab === 'HOLDING' ? 'Không có hàng nào đang lưu giữ.' : 'Chưa có hồ sơ nào được xử lý.'}
            </p>
            <p className="text-xs font-bold text-[#AFAFAF] max-w-[420px]">
              Hồ sơ được lập khi nhân viên bấm "Dọn xong" task dọn kho sau thanh lý, kèm biên bản kiểm kê.
            </p>
          </div>
        ) : (
          <div className={`p-4 ${viewMode === 'list' ? 'flex flex-col gap-3' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'}`}>
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border-2 border-b-4 bg-white p-4 transition-all ${
                  tab === 'HOLDING' && item.holdExpired
                    ? 'border-[#FF4B4B]'
                    : 'border-[#E5E5E5] hover:border-[#1CB0F6]'
                } ${viewMode === 'list' ? 'flex flex-col lg:flex-row lg:items-center justify-between gap-4' : 'flex flex-col gap-3.5'}`}
              >
                {/* Cột trái: Thông tin hợp đồng, khách hàng, khu lưu giữ & biên bản */}
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-[#F3E8FF] border border-[#C084FC] text-[#9333EA] font-mono text-xs font-black">
                        HĐ {item.contractCode}
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-[#DDF4FF] border border-[#84D8FF] text-[#1CB0F6] font-mono text-xs font-black">
                        Ô {item.storageUnitId}
                      </span>
                      <span className="text-sm font-black text-[#4B4B4B]">
                        {item.customerName}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#777777]">
                        · {item.customerPhone}
                      </span>
                    </div>
                    {tab === 'HOLDING' ? (
                      <HoldBadge item={item} />
                    ) : (
                      <span className={`duo-badge border-2 whitespace-nowrap ${OUTCOMES[item.status]?.badge || ''}`}>
                        {OUTCOMES[item.status]?.label || item.status}
                      </span>
                    )}
                  </div>

                  {/* Dải thông số ngang thuôn dài */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#FAFAFA] border border-[#EFEFEF] rounded-xl px-3.5 py-2.5">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#AFAFAF]">Khu lưu giữ</p>
                      <p className="font-black text-[#4B4B4B] truncate">{item.storageLocation}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#AFAFAF]">Lưu đến hết ngày</p>
                      <p className="font-black text-[#4B4B4B]">{formatDate(item.holdUntil)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#AFAFAF]">Nợ còn lại của khách</p>
                      <p className={`font-black ${Number(item.customerDebt) > 0 ? 'text-[#FF4B4B]' : 'text-[#58A700]'}`}>
                        {formatVND(item.customerDebt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#AFAFAF]">Điều khoản</p>
                      <p className={`font-black ${item.termsVersion ? 'text-[#58A700]' : 'text-[#B78900]'}`}>
                        {item.termsVersion ? `Đã đồng ý (${item.termsVersion})` : 'Đơn cũ — không bán'}
                      </p>
                    </div>
                    {/* PR-Q15: phí lưu giữ hàng (chỉ đơn đồng ý điều khoản v2) */}
                    {Number(item.storageFeePerDay) > 0 && (
                      <div className="col-span-2 sm:col-span-4 pt-1 border-t border-[#EAEAEA]">
                        <p className="text-[10px] font-black uppercase text-[#AFAFAF]">Phí lưu giữ</p>
                        <p className="font-black text-[#4B4B4B]">
                          {formatVND(item.storageFeePerDay)}/ngày · đã lưu {item.heldDays} ngày ·{' '}
                          <span className="text-[#FF4B4B]">
                            {tab === 'HOLDING' ? `tạm tính ${formatVND(item.estimatedStorageFee)}` : `đã thu ${formatVND(item.storageFeeAmount)}`}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Biên bản kiểm kê thu gọn */}
                  <div className="rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase text-[#AFAFAF]">Biên bản kiểm kê</p>
                      <p className="text-xs font-bold text-[#4B4B4B] whitespace-pre-line">{item.inventoryNote}</p>
                      <p className="text-[11px] font-bold text-[#777777] mt-0.5">
                        Chứng kiến: {item.witnessNote} · Lập bởi {item.createdByName} lúc {formatDateTime(item.createdAt)}
                        {item.taskId && <> · <Link to={`/manager/tasks/${item.taskId}`} className="text-[#1CB0F6] hover:underline">task #{item.taskId}</Link></>}
                      </p>
                    </div>
                    {item.evidenceImages?.length > 0 && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {item.evidenceImages.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPreview(url)}
                            className="w-12 h-12 rounded-xl border-2 border-[#E5E5E5] overflow-hidden bg-white cursor-pointer hover:border-[#1CB0F6]"
                          >
                            <img src={url} alt={`Kiểm kê ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cột phải: Các nút hành động hoặc kết quả xử lý */}
                {tab === 'HOLDING' ? (
                  <div className={`flex flex-wrap items-center gap-2 ${viewMode === 'list' ? 'lg:w-[250px] lg:flex-col lg:items-stretch shrink-0 lg:border-l-2 lg:border-[#F0F0F0] lg:pl-4' : ''}`}>
                    {Object.entries(OUTCOMES).map(([key, meta]) => {
                      const reason = blockReason(item, key)
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={Boolean(reason)}
                          title={reason || meta.label}
                          onClick={() => openModal(item, key)}
                          className={`${meta.btn} px-3 py-2 text-[11px] gap-1.5 justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                          {meta.label}
                        </button>
                      )
                    })}
                    {!item.holdExpired && (
                      <SimulationButton
                        label="Hết hạn lưu giữ"
                        description={`Lùi hạn lưu giữ hàng HĐ ${item.contractCode} về hôm qua (đã qua 60 ngày) để bán thanh lý / tiêu huỷ được ngay.`}
                        onRun={() => simulateExpireHeldGoods(item.id)}
                        onDone={reload}
                      />
                    )}
                  </div>
                ) : (
                  <div className={`rounded-2xl border-2 border-[#E5E5E5] p-3.5 flex flex-col gap-1.5 text-xs ${viewMode === 'list' ? 'lg:w-[320px] shrink-0' : ''}`}>
                    <p className="font-bold text-[#4B4B4B] whitespace-pre-line">{item.resolvedNote}</p>
                    {item.status === 'SOLD' && (
                      <p className="font-bold text-[#777777]">
                        Bán {formatVND(item.proceedsAmount)} · trừ nợ {formatVND(item.debtOffsetAmount)} ·{' '}
                        <span className="text-[#1899D6] font-black">hoàn khách {formatVND(item.refundAmount)}</span>
                        {Number(item.refundAmount) > 0 && <> (<Link to="/manager/refunds" className="text-[#1CB0F6] hover:underline">xem task hoàn tiền</Link>)</>}
                      </p>
                    )}
                    <p className="text-[11px] font-bold text-[#AFAFAF]">{item.resolvedByName} · {formatDateTime(item.resolvedAt)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && items.length > 0 && (
          <PaginationBar
            currentPage={safePage}
            totalItems={items.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="hồ sơ"
          />
        )}
      </div>

      {/* Modal chốt cách xử lý */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={() => !submitting && setModal(null)}>
          <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="duo-card bg-white w-full max-w-[520px] shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className={`duo-badge border-2 ${OUTCOMES[modal.outcome].badge}`}>
                <span className="material-symbols-outlined text-[16px] mr-1 align-middle">{OUTCOMES[modal.outcome].icon}</span>
                {OUTCOMES[modal.outcome].label}
              </span>
              <h2 className="text-base font-black text-[#4B4B4B]">HĐ {modal.item.contractCode}</h2>
            </div>

            {modal.outcome === 'SOLD' && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-black uppercase text-[#777777]">Tiền bán thanh lý (VNĐ) *</span>
                  <input type="number" min={0} step={10000} value={proceeds} onChange={(e) => setProceeds(e.target.value)}
                    className="duo-input text-sm font-mono font-black" placeholder="0" />
                </label>
                <div className="rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] p-3 text-xs font-bold text-[#4B4B4B] flex flex-col gap-1">
                  <div className="flex justify-between"><span>Trừ nợ còn lại của khách</span><span className="text-[#FF4B4B]">- {formatVND(saleDebtOffset)}</span></div>
                  {storageFee > 0 && (
                    <div className="flex justify-between"><span>Trừ phí lưu giữ ({modal.item.heldDays} ngày)</span><span className="text-[#FF4B4B]">- {formatVND(saleFeeOffset)}</span></div>
                  )}
                  <div className="flex justify-between"><span>Phần dư hoàn khách</span><span className="text-[#1899D6]">{formatVND(saleSurplus)}</span></div>
                  {Number(modal.item.depositHeld) > 0 && (
                    <p className="text-[11px] text-[#777777]">
                      + Cọc còn giữ {formatVND(modal.item.depositHeld)} được gộp vào lần hoàn này nếu chưa tạo yêu cầu hoàn cọc riêng.
                    </p>
                  )}
                  <p className="text-[11px] text-[#777777]">Có tiền hoàn → hệ thống tạo task Hoàn tiền cho Quản lý.</p>
                </div>
              </div>
            )}

            {/* PR-Q15: khách nhận lại — phí lưu giữ trừ vào cọc, thiếu thì thu tại quầy */}
            {modal.outcome === 'RETURNED' && storageFee > 0 && (
              <div className="rounded-xl bg-[#FFF8E1] border border-[#FFC800] p-3 text-xs font-bold text-[#4B4B4B] flex flex-col gap-2">
                <div className="flex justify-between">
                  <span>Phí lưu giữ {modal.item.heldDays} ngày</span><span>{formatVND(storageFee)}</span>
                </div>
                <div className="flex justify-between text-[#777777]">
                  <span>Trừ vào cọc còn giữ</span><span>- {formatVND(storageFee - feeAtCounter)}</span>
                </div>
                {feeAtCounter > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer text-[#B78900]">
                    <input type="checkbox" checked={feeCollected} onChange={(e) => setFeeCollected(e.target.checked)} />
                    Đã thu tại quầy phần còn thiếu {formatVND(feeAtCounter)}
                  </label>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase text-[#777777]">Ghi chú / số biên bản *</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
                placeholder={NOTE_PLACEHOLDER[modal.outcome]} className="duo-input resize-none text-xs" />
            </label>

            {modalError && <p className="text-xs font-black text-[#FF4B4B]">{modalError}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setModal(null)} disabled={submitting} className="duo-btn-white px-5 py-2.5 text-sm">Huỷ</button>
              <button type="submit" disabled={submitting} className="duo-btn-green px-5 py-2.5 text-sm disabled:opacity-50">
                {submitting ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreview(null)}>
          <img src={preview} alt="Ảnh kiểm kê" className="max-w-full max-h-[85vh] rounded-2xl bg-white" />
        </div>
      )}

      <AssetTermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  )
}
