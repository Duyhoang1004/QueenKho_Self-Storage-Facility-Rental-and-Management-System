import { useEffect, useState } from 'react'
import { getMyReservations } from '../../services/authService'

const statusLabel = {
  PENDING: 'Chờ xử lý',
  DEPOSIT_PAID: 'Đã đặt cọc',
  UNIT_ASSIGNED: 'Đã gán ô kho',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  COMPLETED: 'Hoàn tất',
}

const statusClass = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  DEPOSIT_PAID: 'bg-blue-100 text-blue-800',
  UNIT_ASSIGNED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
}

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user.userId) {
      setError('Bạn cần đăng nhập để xem đơn đặt chỗ.')
      setLoading(false)
      return
    }
    getMyReservations(user.userId)
      .then(setReservations)
      .catch(() => setError('Không tải được danh sách đơn đặt chỗ.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[1180px] w-full mx-auto px-margin py-space-lg">
      <h1 className="font-headline-md text-headline-md text-on-surface mb-space-md">
        Đơn đặt chỗ của tôi
      </h1>

      {loading && <p className="text-on-surface-variant">Đang tải...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && reservations.length === 0 && (
        <p className="text-on-surface-variant">Bạn chưa có đơn đặt chỗ nào.</p>
      )}

      {!loading && reservations.length > 0 && (
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/60 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#F4F6F8] text-on-surface-variant text-sm">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Cơ sở</th>
                <th className="px-4 py-3">Loại kho</th>
                <th className="px-4 py-3">Bắt đầu</th>
                <th className="px-4 py-3">Số tháng</th>
                <th className="px-4 py-3">Tiền cọc</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/40 text-sm">
                  <td className="px-4 py-3 font-medium">{r.reservationCode}</td>
                  <td className="px-4 py-3">{r.facilityName}</td>
                  <td className="px-4 py-3">{r.unitTypeName}</td>
                  <td className="px-4 py-3">{r.startDate ?? '—'}</td>
                  <td className="px-4 py-3">{r.durationMonths}</td>
                  <td className="px-4 py-3">{r.depositAmount.toLocaleString('vi-VN')}₫</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[r.status] || r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}