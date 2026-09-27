import { useEffect, useState } from 'react'
import { getMyReservations } from '../../services/authService'

const statusLabel = {
  PENDING: 'Chá» xá»­ lÃ½',
  DEPOSIT_PAID: 'ÄÃ£ Ä‘áº·t cá»c',
  UNIT_ASSIGNED: 'ÄÃ£ gÃ¡n Ã´ kho',
  CANCELLED: 'ÄÃ£ há»§y',
  EXPIRED: 'Háº¿t háº¡n',
  COMPLETED: 'HoÃ n táº¥t',
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
    const user = JSON.parse(sessionStorage.getItem('user') || '{}')
    if (!user.userId) {
      setError('Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ xem Ä‘Æ¡n Ä‘áº·t chá»—.')
      setLoading(false)
      return
    }
    getMyReservations(user.userId)
      .then(setReservations)
      .catch(() => setError('KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch Ä‘Æ¡n Ä‘áº·t chá»—.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-[1180px] w-full mx-auto px-margin py-space-lg">
      <h1 className="font-headline-md text-headline-md text-on-surface mb-space-md">
        ÄÆ¡n Ä‘áº·t chá»— cá»§a tÃ´i
      </h1>

      {loading && <p className="text-on-surface-variant">Äang táº£i...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && reservations.length === 0 && (
        <p className="text-on-surface-variant">Báº¡n chÆ°a cÃ³ Ä‘Æ¡n Ä‘áº·t chá»— nÃ o.</p>
      )}

      {!loading && reservations.length > 0 && (
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/60 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#F4F6F8] text-on-surface-variant text-sm">
              <tr>
                <th className="px-4 py-3">MÃ£ Ä‘Æ¡n</th>
                <th className="px-4 py-3">CÆ¡ sá»Ÿ</th>
                <th className="px-4 py-3">Loáº¡i kho</th>
                <th className="px-4 py-3">Báº¯t Ä‘áº§u</th>
                <th className="px-4 py-3">Sá»‘ thÃ¡ng</th>
                <th className="px-4 py-3">Tiá»n cá»c</th>
                <th className="px-4 py-3">Tráº¡ng thÃ¡i</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/40 text-sm">
                  <td className="px-4 py-3 font-medium">{r.reservationCode}</td>
                  <td className="px-4 py-3">{r.facilityName}</td>
                  <td className="px-4 py-3">{r.unitTypeName}</td>
                  <td className="px-4 py-3">{r.startDate ?? 'â€”'}</td>
                  <td className="px-4 py-3">{r.durationMonths}</td>
                  <td className="px-4 py-3">{r.depositAmount.toLocaleString('vi-VN')}â‚«</td>
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
