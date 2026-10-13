import { useEffect, useState } from 'react'
import { getPendingReservations, getOverdueNoShowReservations } from '../../services/reservationService'
import AssignUnitModal from '../../components/AssignUnitModal'
import NoShowModal from '../../components/NoShowModal'
import RescheduleModal from '../../components/RescheduleModal'

function formatVND(amount) {
  if (amount === null || amount === undefined) return 'â€”'
  return Number(amount).toLocaleString('vi-VN') + 'â‚«'
}

function formatDate(value) {
  if (!value) return 'â€”'
  const [y, m, d] = String(value).split('-')
  return `${d}/${m}/${y}`
}

function formatDateOnly(value) {
  if (!value) return 'â€”'
  return new Date(value).toLocaleDateString('vi-VN')
}

function daysUntil(value) {
  if (!value) return null
  const [y, m, d] = String(value).split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function startHint(diff) {
  if (diff === null) return null
  if (diff < 0) return { text: `QuÃ¡ háº¡n ${-diff} ngÃ y`, className: 'text-[#FF4B4B] font-black' }
  if (diff === 0) return { text: 'HÃ´m nay', className: 'text-[#FF4B4B] font-black' }
  if (diff === 1) return { text: 'NgÃ y mai', className: 'text-[#FF9600] font-black' }
  return { text: `CÃ²n ${diff} ngÃ y`, className: 'text-[#AFAFAF] font-bold' }
}

function initials(name) {
  if (!name) return 'KH'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function readUserId() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  return user.userId ?? null
}

export default function PendingReservationsPage() {
  const userId = readUserId()
  const [activeTab, setActiveTab] = useState('pending')

  // Tab 1: Ä‘Æ¡n chá» gÃ¡n Ã´
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState(userId ? '' : 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ xem danh sÃ¡ch Ä‘Æ¡n chá» gÃ¡n Ã´.')
  const [reloadKey, setReloadKey] = useState(0)

  // Tab 2: Ä‘Æ¡n quÃ¡ háº¡n no-show
  const [overdueItems, setOverdueItems] = useState([])
  const [overdueLoading, setOverdueLoading] = useState(Boolean(userId))
  const [overdueError, setOverdueError] = useState('')
  const [overdueReloadKey, setOverdueReloadKey] = useState(0)

  const [selectedReservation, setSelectedReservation] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const [noShowTarget, setNoShowTarget] = useState(null)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    getPendingReservations({ managerId: userId })
      .then((data) => {
        if (cancelled) return
        setItems(data)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch Ä‘Æ¡n chá» gÃ¡n Ã´. Vui lÃ²ng thá»­ láº¡i.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  const reload = () => {
    setError('')
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setOverdueLoading(true)
    getOverdueNoShowReservations({ managerId: userId })
      .then((data) => { if (!cancelled) { setOverdueItems(data); setOverdueError('') } })
      .catch((err) => { if (!cancelled) setOverdueError(err.response?.data?.message || 'KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch quÃ¡ háº¡n.') })
      .finally(() => { if (!cancelled) setOverdueLoading(false) })
    return () => { cancelled = true }
  }, [userId, overdueReloadKey])

  const reloadOverdue = () => {
    setOverdueError('')
    setOverdueLoading(true)
    setOverdueReloadKey((k) => k + 1)
  }

  const openAssign = (item) => {
    setSelectedReservation(item)
    setIsModalOpen(true)
  }

  const handleAssignSuccess = (unitId, code) => {
    setToast({
      title: 'GÃ¡n Ã´ kho thÃ nh cÃ´ng!',
      desc: `ÄÃ£ phÃ¢n bá»• Ã´ ${unitId} cho Ä‘Æ¡n ${code} & kÃ­ch hoáº¡t mÃ£ má»Ÿ khÃ³a.`,
    })
    reload()
    setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8 select-none">
      <div className="flex flex-col gap-6">

        {/* Toast notification */}
        {toast && (
          <div className="duo-card p-4 bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-between text-[#58A700]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px]">check_circle</span>
              <div>
                <p className="font-black text-sm uppercase">{toast.title}</p>
                <p className="font-bold text-xs">{toast.desc}</p>
              </div>
            </div>
            <button onClick={() => setToast(null)} className="text-[#58A700] hover:text-[#4B4B4B]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-2 border-b-2 border-[#E5E5E5] pb-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl border-2 border-b-0 transition-colors ${
              activeTab === 'pending'
                ? 'bg-white border-[#E5E5E5] text-[#FF9600]'
                : 'bg-[#F7F7F7] border-transparent text-[#AFAFAF] hover:text-[#4B4B4B]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] mr-1 align-middle">pending_actions</span>
            Chá» gÃ¡n Ã´ {!loading && <span className="ml-1 bg-[#FFE8CC] text-[#E58800] px-1.5 py-0.5 rounded-full text-[10px]">{items.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl border-2 border-b-0 transition-colors ${
              activeTab === 'overdue'
                ? 'bg-white border-[#E5E5E5] text-[#FF4B4B]'
                : 'bg-[#F7F7F7] border-transparent text-[#AFAFAF] hover:text-[#4B4B4B]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] mr-1 align-middle">warning</span>
            QuÃ¡ háº¡n No-Show {!overdueLoading && overdueItems.length > 0 && <span className="ml-1 bg-[#FFDFDF] text-[#FF4B4B] px-1.5 py-0.5 rounded-full text-[10px]">{overdueItems.length}</span>}
          </button>
        </div>

        {/* Banner tiÃªu Ä‘á» Duolingo Card */}
        <div className="duo-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FF9600] border-b-4 border-[#E58800] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[30px]">pending_actions</span>
            </div>
            <div className="flex flex-col">
              <span className="self-start text-[11px] font-black text-[#E58800] uppercase tracking-wider bg-[#FFE8CC] border border-[#FF9600] px-2.5 py-0.5 rounded-full">
                HÃ ng Ä‘á»£i phÃª duyá»‡t
              </span>
              <h1 className="text-2xl font-black text-[#4B4B4B] tracking-tight mt-1">
                ÄÆ¡n chá» gÃ¡n Ã´ kho thá»±c táº¿
              </h1>
              <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                KhÃ¡ch hÃ ng Ä‘Ã£ thanh toÃ¡n cá»c thÃ nh cÃ´ng. Cáº§n chá»‰ Ä‘á»‹nh mÃ£ Ã´ kho váº­t lÃ½ trÆ°á»›c ngÃ y háº¹n nháº­n kho.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <div className="bg-[#DDF4FF] border-2 border-[#84D8FF] px-4 py-2 rounded-2xl flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#1CB0F6]">Chá» phÃ¢n bá»•</span>
              <span className="text-xl font-black text-[#1CB0F6]">
                {loading ? 'â€”' : `${items.length} Ä‘Æ¡n`}
              </span>
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="duo-btn-white px-4 py-2.5 text-xs tracking-wider"
            >
              <span className={`material-symbols-outlined text-[18px] mr-1 ${loading ? 'animate-spin' : ''}`}>sync</span>
              <span>LÃ€M Má»šI</span>
            </button>
          </div>
        </div>

        {/* Báº£ng danh sÃ¡ch Duolingo Card */}
        {activeTab === 'pending' && (
        <div className="duo-card overflow-hidden">
          {loading && <p className="p-8 text-center text-xs font-black uppercase text-[#AFAFAF]">Äang táº£i danh sÃ¡ch hÃ ng Ä‘á»£i...</p>}

          {!loading && error && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-black text-[#FF4B4B]">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="duo-btn-green px-5 py-2.5 text-xs"
              >
                THá»¬ Láº I
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="p-12 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#58CC02]">task_alt</span>
              <p className="text-sm font-black text-[#4B4B4B]">Tuyá»‡t vá»i! KhÃ´ng cÃ²n Ä‘Æ¡n nÃ o chá» gÃ¡n kho.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">MÃ£ Ä‘Æ¡n</th>
                    <th className="py-3.5 px-5">NgÃ y cá»c</th>
                    <th className="py-3.5 px-5">KhÃ¡ch hÃ ng</th>
                    <th className="py-3.5 px-5">Äiá»‡n thoáº¡i</th>
                    <th className="py-3.5 px-5">Loáº¡i kho</th>
                    <th className="py-3.5 px-5">Thá»i háº¡n</th>
                    <th className="py-3.5 px-5">Háº¹n nháº­n</th>
                    <th className="py-3.5 px-5">Tiá»n cá»c</th>
                    <th className="py-3.5 px-5 text-right">Thao tÃ¡c</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#E5E5E5] text-xs font-bold text-[#4B4B4B]">
                  {items.map((r) => {
                    const hint = startHint(daysUntil(r.startDate))
                    return (
                      <tr key={r.id} className="hover:bg-[#FDFDFD] transition-colors">
                        <td className="py-4 px-5 font-black text-[#1CB0F6]">
                          {r.reservationCode}
                        </td>
                        <td className="py-4 px-5 text-[#AFAFAF]">
                          {formatDateOnly(r.createdAt)}
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#58CC02] border-b border-[#58A700] text-white flex items-center justify-center font-black text-xs">
                              {initials(r.customerName)}
                            </div>
                            <span className="font-black text-[#4B4B4B]">
                              {r.customerName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-5">{r.customerPhone || 'â€”'}</td>
                        <td className="py-4 px-5">
                          <span className="duo-badge bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]">
                            {r.unitTypeName}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-black">{r.durationMonths} thÃ¡ng</td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col">
                            <span>{formatDate(r.startDate)}</span>
                            {hint && <span className={`text-[10px] ${hint.className}`}>{hint.text}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-5 font-black text-[#58CC02]">
                          {formatVND(r.depositAmount)}
                        </td>
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openAssign(r)}
                            className="duo-btn-green px-4 py-2 text-xs"
                          >
                            <span className="material-symbols-outlined text-[16px] mr-1">key</span>
                            <span>GÃN Ã” KHO</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Tab QuÃ¡ háº¡n No-Show */}
        {activeTab === 'overdue' && (
        <div className="duo-card overflow-hidden">
          {overdueLoading && <p className="p-8 text-center text-xs font-black uppercase text-[#AFAFAF]">Äang táº£i danh sÃ¡ch quÃ¡ háº¡n...</p>}

          {!overdueLoading && overdueError && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-xs font-black text-[#FF4B4B]">{overdueError}</p>
              <button type="button" onClick={reloadOverdue} className="duo-btn-green px-5 py-2.5 text-xs">THá»¬ Láº I</button>
            </div>
          )}

          {!overdueLoading && !overdueError && overdueItems.length === 0 && (
            <div className="p-12 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#58CC02]">task_alt</span>
              <p className="text-sm font-black text-[#4B4B4B]">KhÃ´ng cÃ³ Ä‘Æ¡n nÃ o quÃ¡ háº¡n nháº­n kho.</p>
            </div>
          )}

          {!overdueLoading && !overdueError && overdueItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FFF5F5] border-b-2 border-[#FFDFDF] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">MÃ£ Ä‘Æ¡n</th>
                    <th className="py-3.5 px-5">KhÃ¡ch hÃ ng</th>
                    <th className="py-3.5 px-5">Äiá»‡n thoáº¡i</th>
                    <th className="py-3.5 px-5">Loáº¡i kho</th>
                    <th className="py-3.5 px-5">Thá»i háº¡n</th>
                    <th className="py-3.5 px-5">Háº¹n nháº­n</th>
                    <th className="py-3.5 px-5">Tiá»n cá»c</th>
                    <th className="py-3.5 px-5 text-right">Xá»­ lÃ½</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#FFDFDF] text-xs font-bold text-[#4B4B4B]">
                  {overdueItems.map((r) => {
                    const hint = startHint(daysUntil(r.startDate))
                    return (
                      <tr key={r.id} className="hover:bg-[#FFF8F8] transition-colors">
                        <td className="py-4 px-5 font-black text-[#FF4B4B]">{r.reservationCode}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#FF4B4B] border-b border-[#CC0000] text-white flex items-center justify-center font-black text-xs">
                              {initials(r.customerName)}
                            </div>
                            <span className="font-black">{r.customerName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5">{r.customerPhone || 'â€”'}</td>
                        <td className="py-4 px-5">
                          <span className="duo-badge bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]">
                            {r.unitTypeName}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-black">{r.durationMonths} thÃ¡ng</td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col">
                            <span>{formatDate(r.startDate)}</span>
                            {hint && <span className={`text-[10px] ${hint.className}`}>{hint.text}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-5 font-black text-[#FF4B4B]">{formatVND(r.depositAmount)}</td>
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setRescheduleTarget(r)}
                              className="px-3 py-2 text-xs font-black uppercase tracking-wider rounded-2xl border-2 border-b-4 border-[#1899D6] bg-[#1CB0F6] text-white hover:bg-[#1899D6] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px] mr-1 align-middle">edit_calendar</span>
                              Dá»i lá»‹ch
                            </button>
                            <button
                              type="button"
                              onClick={() => setNoShowTarget(r)}
                              className="px-3 py-2 text-xs font-black uppercase tracking-wider rounded-2xl border-2 border-b-4 border-[#CC0000] bg-[#FF4B4B] text-white hover:bg-[#e03e3e] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px] mr-1 align-middle">person_off</span>
                              No-Show
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>

            <AssignUnitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedReservation}
        onSuccess={handleAssignSuccess}
      />

      <NoShowModal
        isOpen={!!noShowTarget}
        reservation={noShowTarget}
        onClose={() => setNoShowTarget(null)}
        onSuccess={(code) => {
          setToast({ title: 'Da xu ly No-Show!', desc: `Don ${code} da bi huy, o kho da duoc giai phong.` })
          setTimeout(() => setToast(null), 4500)
          reloadOverdue()
        }}
      />

      <RescheduleModal
        isOpen={!!rescheduleTarget}
        reservation={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSuccess={(code, newDate) => {
          setToast({ title: 'Da doi lich thanh cong!', desc: `Don ${code} da duoc doi sang ngay ${newDate}.` })
          setTimeout(() => setToast(null), 4500)
          reloadOverdue()
        }}
      />
    </div>
  )
}
