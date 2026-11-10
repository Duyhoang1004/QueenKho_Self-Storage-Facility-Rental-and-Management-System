import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ContractDetailView from '../../components/ContractDetailView'

// Trang chi tiết hợp đồng (FM). Nội dung nằm ở ContractDetailView để popup dùng lại.
// ?transfer=1 → mở luôn hộp chuyển ô (D-18).
export default function ContractDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const transfer = searchParams.get('transfer') === '1'

  return (
    <ContractDetailView
      key={`${id}-${transfer}`}
      contractId={id}
      initialTransfer={transfer}
      onBack={() => navigate('/manager/customers')}
      onOpenContract={(cid, t) => navigate(`/manager/contracts/${cid}${t ? '?transfer=1' : ''}`)}
    />
  )
}
