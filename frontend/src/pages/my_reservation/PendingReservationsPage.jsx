import { useEffect, useState } from 'react'
import { getPendingReservations } from '../../services/authService'

export default function PendingReservationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    // TODO: thay bằng facilityId thật của FM khi Login trả về facilityId
    const facilityId = user.facilityId || 1
    getPendingReservations(facilityId)
      .then(setItems)
      .catch(() => setError('Không tải được danh sách đơn chờ gán ô.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[1180px] w-full mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold mb-4">Đơn chờ gán ô kho</h1>

      {loading && <p className="text-gray-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500">Không có đơn nào đang chờ gán ô.</p>
      )}

      {!loading && items.length > 0 && (
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden border">
          <thead className="bg-gray-50 text-left text-sm text-gray-500">
            <tr>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Loại kho</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t text-sm">
                <td className="px-4 py-3 font-medium">{r.reservationCode}</td>
                <td className="px-4 py-3">{r.customerName}</td>
                <td className="px-4 py-3">{r.unitTypeName}</td>
                <td className="px-4 py-3">{new Date(r.createdAt).toLocaleString('vi-VN')}</td>
                <td className="px-4 py-3">
                  <button className="text-blue-600 text-sm font-medium hover:underline">
                    Gán ô kho →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}