import { useEffect, useState } from 'react'
import { getPendingReservations } from '../../services/authService'

export default function PendingReservationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    // TODO: thay báº±ng facilityId tháº­t cá»§a FM khi Login tráº£ vá» facilityId
    const facilityId = user.facilityId || 1
    getPendingReservations(facilityId)
      .then(setItems)
      .catch(() => setError('KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch Ä‘Æ¡n chá» gÃ¡n Ã´.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[1180px] w-full mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold mb-4">ÄÆ¡n chá» gÃ¡n Ã´ kho</h1>

      {loading && <p className="text-gray-500">Äang táº£i...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500">KhÃ´ng cÃ³ Ä‘Æ¡n nÃ o Ä‘ang chá» gÃ¡n Ã´.</p>
      )}

      {!loading && items.length > 0 && (
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden border">
          <thead className="bg-gray-50 text-left text-sm text-gray-500">
            <tr>
              <th className="px-4 py-3">MÃ£ Ä‘Æ¡n</th>
              <th className="px-4 py-3">KhÃ¡ch hÃ ng</th>
              <th className="px-4 py-3">Loáº¡i kho</th>
              <th className="px-4 py-3">NgÃ y táº¡o</th>
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
                    GÃ¡n Ã´ kho â†’
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
