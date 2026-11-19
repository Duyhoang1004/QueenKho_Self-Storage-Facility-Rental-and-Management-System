import { useEffect, useState, useRef } from 'react'
import { getUnitAccessLogs, simulateUnitAccess } from '../services/contractService'

function formatLogTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export default function UnitAccessModal({
  isOpen,
  onClose,
  contractId,
  contractCode,
  storageUnitId,
  roomNumber,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [simulating, setSimulating] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [tempUnlocked, setTempUnlocked] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !contractId) return
    setLoading(true)
    setError('')
    setFeedback(null)
    setTempUnlocked(false)
    getUnitAccessLogs(contractId)
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || 'Không thể tải lịch sử ra vào kho.')
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isOpen, contractId])

  if (!isOpen) return null

  const handleSimulate = async (method, isInvalid) => {
    if (simulating) return
    setSimulating(true)
    setFeedback(null)
    try {
      const newLog = await simulateUnitAccess(contractId, { accessMethod: method, isInvalid })

      // Cập nhật danh sách log ngay lập tức
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          logs: [newLog, ...(prev.logs || [])],
        }
      })

      if (newLog.status === 'SUCCESS') {
        setTempUnlocked(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setTempUnlocked(false)
        }, 5000)

        setFeedback({
          type: 'success',
          text: `Mô phỏng thành công: ${newLog.notes || 'Thiết bị đã mở chốt cửa trong 5 giây.'}`,
        })
      } else {
        setFeedback({
          type: 'denied',
          text: `Truy cập bị từ chối: ${newLog.failureReason || 'Không có quyền truy cập.'}`,
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Mô phỏng thất bại.',
      })
    } finally {
      setSimulating(false)
    }
  }

  const logs = data?.logs || []
  const isAccessBlocked = Boolean(data?.isAccessBlocked)
  const blockReason = data?.blockReason || 'Hợp đồng đang tạm khóa quyền truy cập'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-500 block mb-0.5">
              HỆ THỐNG KIỂM SOÁT VÀO RA KHO THÔNG MINH
            </span>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              Lịch sử sử dụng & ra vào ô kho
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Hợp đồng: <span className="font-mono font-bold text-slate-700">{contractCode || data?.contractCode || `HĐ #${contractId}`}</span>
              {' · '}
              Ô kho: <span className="font-mono font-bold text-slate-700">{roomNumber || data?.roomNumber || storageUnitId || data?.storageUnitId || '—'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs transition cursor-pointer"
          >
            ĐÓNG
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-12 text-center text-slate-400 font-bold text-sm">
              Đang đồng bộ dữ liệu thiết bị...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold">
              Lỗi: {error}
            </div>
          )}

          {!loading && (
            <>
              {/* Hardware Device Status Panel */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    THIẾT BỊ KHÓA
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-800 truncate">
                    {data?.deviceCode || 'SMARTLOCK'}
                  </p>
                  <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                    {data?.deviceModel || 'SMARTLOCK PRO-X5'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    TRẠNG THÁI CHỐT CỬA
                  </span>
                  {tempUnlocked ? (
                    <span className="inline-block text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300 animate-pulse">
                      ĐÃ MỞ CHỐT (5 GIÂY)
                    </span>
                  ) : (
                    <span className="inline-block text-xs font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded-lg border border-slate-300">
                      ĐANG KHÓA CHỐT
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                    Tự động đóng chốt an toàn
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    NGUỒN PIN KHÓA
                  </span>
                  <p className="text-xs font-bold text-slate-800">
                    {data?.batteryPercentage ?? 95}%
                  </p>
                  <span className="text-[10px] font-semibold text-emerald-600 block mt-0.5">
                    Điện áp ổn định
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    CHẾ ĐỘ AN NINH
                  </span>
                  {isAccessBlocked ? (
                    <span className="inline-block text-[11px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-300">
                      TẠM KHÓA TRUY CẬP
                    </span>
                  ) : (
                    <span className="inline-block text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                      HOẠT ĐỘNG BÌNH THƯỜNG
                    </span>
                  )}
                  <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                    Xác thực PIN & RFID
                  </span>
                </div>
              </div>

              {/* Warning if contract access is blocked */}
              {isAccessBlocked && (
                <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl">
                  <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider block mb-1">
                    THÔNG BÁO KHÓA QUYỀN TRUY CẬP TỪ HỆ THỐNG
                  </span>
                  <p className="text-xs font-semibold text-rose-700">
                    {blockReason}. Mọi yêu cầu nhập mã PIN hoặc quẹt thẻ từ tại cửa ô kho sẽ được thiết bị tự động ghi nhận trạng thái BỊ TỪ CHỐI để đảm bảo an ninh kho.
                  </p>
                </div>
              )}

              {/* Hardware Simulation Controls */}
              <div className="p-5 bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-black tracking-wider uppercase text-slate-700 block">
                      MÔ PHỎNG TÍN HIỆU THIẾT BỊ TẠI CỬA KHO
                    </span>
                    <p className="text-xs font-medium text-slate-500">
                      Nhấn nút để gửi tín hiệu mô phỏng tương tác từ bàn phím số PIN hoặc đầu đọc thẻ từ RFID:
                    </p>
                  </div>
                  {simulating && (
                    <span className="text-xs font-bold text-blue-600 animate-pulse">
                      Đang truyền tín hiệu...
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulate('PIN', false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    GIẢ LẬP NHẬP MÃ PIN
                  </button>

                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulate('RFID', false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    GIẢ LẬP QUẸT THẺ RFID
                  </button>

                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => handleSimulate('PIN', true)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    GIẢ LẬP TRUY CẬP SAI MÃ
                  </button>
                </div>

                {/* Simulation Feedback Alert */}
                {feedback && (
                  <div
                    className={`mt-2 p-3 rounded-xl border text-xs font-semibold ${
                      feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-rose-50 border-rose-300 text-rose-800'
                    }`}
                  >
                    {feedback.text}
                  </div>
                )}
              </div>

              {/* Access Logs History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    NHẬT KÝ RA VÀO VÀ SỬ DỤNG KHO ({logs.length} BẢN GHI)
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Sắp xếp: Mới nhất trước
                  </span>
                </div>

                {logs.length === 0 ? (
                  <div className="p-8 border border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-bold bg-slate-50/50">
                    Chưa có nhật ký truy cập nào được ghi nhận cho ô kho này.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">THỜI GIAN</th>
                            <th className="py-2.5 px-3">PHƯƠNG THỨC</th>
                            <th className="py-2.5 px-3">MÃ XÁC THỰC</th>
                            <th className="py-2.5 px-3">KẾT QUẢ</th>
                            <th className="py-2.5 px-3">CHI TIẾT VẬN HÀNH / LÝ DO</th>
                            <th className="py-2.5 px-3 text-right">PIN KHÓA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {logs.map((log) => {
                            const isSuccess = log.status === 'SUCCESS'
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                                  {formatLogTime(log.accessedAt)}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {log.accessMethod === 'RFID' ? (
                                    <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-sky-100 text-sky-800 border border-sky-200">
                                      THẺ TỪ RFID
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-slate-100 text-slate-800 border border-slate-200">
                                      MÃ PIN
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-600">
                                  {log.credentialCode || '—'}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  {isSuccess ? (
                                    <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      THÀNH CÔNG
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                      BỊ TỪ CHỐI
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-slate-700">
                                  {isSuccess ? (
                                    <span className="text-emerald-700 font-semibold">{log.notes || 'Mở chốt cửa 5 giây'}</span>
                                  ) : (
                                    <span className="text-rose-700 font-semibold">
                                      {log.failureReason || log.notes || 'Từ chối truy cập'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-mono font-bold text-slate-500 text-right whitespace-nowrap">
                                  {log.batteryPercentage ? `${log.batteryPercentage}%` : '95%'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400">
            Dữ liệu ghi nhận độc lập bởi mô-đun kiểm soát truy cập QueenKho IoT Smartlock
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            ĐÓNG CỬA SỔ
          </button>
        </div>

      </div>
    </div>
  )
}
