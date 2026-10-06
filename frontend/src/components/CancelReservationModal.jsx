import { useState, useEffect } from 'react';
import { getCancelPreview, cancelReservation } from '../services/reservationService';

const CANCEL_REASONS = [
  'Thay đổi kế hoạch cá nhân / Không còn nhu cầu lưu trữ.',
  'Tìm được địa điểm khác phù hợp hơn.',
  'Thời gian hẹn nhận kho không còn thuận tiện.',
  'Đặt nhầm kích thước / loại kho bãi.',
  'Lý do khác'
];

export default function CancelReservationModal({ isOpen, onClose, reservation, onSuccess }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [bankInfo, setBankInfo] = useState({ bankName: '', bankAccountNumber: '', bankAccountName: '' });
  
  useEffect(() => {
    if (isOpen && reservation) {
      setLoading(true);
      getCancelPreview(reservation.id)
        .then(data => setPreview(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
        setPreview(null);
        setReason('');
        setOtherReason('');
        setBankInfo({ bankName: '', bankAccountNumber: '', bankAccountName: '' });
    }
  }, [isOpen, reservation]);

  if (!isOpen || !reservation) return null;

  const handleConfirm = async () => {
    if (!reason) return alert('Vui lòng chọn lý do hủy.');
    if (reason === 'Lý do khác' && !otherReason.trim()) return alert('Vui lòng nhập lý do khác.');
    if (['DEPOSIT_PAID'].includes(reservation.status)) {
        if (!bankInfo.bankName || !bankInfo.bankAccountNumber || !bankInfo.bankAccountName) {
            return alert('Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng để hoàn tiền.');
        }
    }

    setSubmitting(true);
    try {
      await cancelReservation(reservation.id, {
          reason,
          otherReason: reason === 'Lý do khác' ? otherReason : '',
          ...bankInfo
      });
      onSuccess();
    } catch (err) {
      alert(err.message || 'Có lỗi xảy ra khi hủy đơn.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatVND = (amount) => {
    if (amount == null) return '0₫';
    return amount.toLocaleString('vi-VN') + '₫';
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '—';
    let date = Array.isArray(dateVal) 
      ? new Date(dateVal[0], dateVal[1]-1, dateVal[2], dateVal[3] || 0, dateVal[4] || 0)
      : new Date(dateVal);
    return date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' - ' + date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="duo-card bg-white w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#E5E5E5] bg-[#FAFAFA]">
          <h2 className="text-base font-black text-[#FF4B4B] uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">warning</span>
            Xác nhận hủy đặt chỗ khoang lưu trữ
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          
          {/* Tóm tắt đơn */}
          <div className="bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-bold text-[#4B4B4B]">
              <div><span className="text-[#AFAFAF] uppercase text-[10px] block">Mã đơn:</span> <strong className="text-[#1CB0F6] font-black">{reservation.reservationCode}</strong></div>
              <div><span className="text-[#AFAFAF] uppercase text-[10px] block">Chi nhánh:</span> <strong>{reservation.facilityName}</strong></div>
              <div><span className="text-[#AFAFAF] uppercase text-[10px] block">Loại kho:</span> <strong>{reservation.unitTypeName}</strong></div>
              <div><span className="text-[#AFAFAF] uppercase text-[10px] block">Giờ hẹn nhận:</span> <strong>{preview ? formatDateTime(preview.appointmentTime) : 'Đang tính...'}</strong></div>
            </div>
          </div>

          {/* Khung tính toán hoàn cọc */}
          {loading ? (
             <div className="flex justify-center p-4"><span className="material-symbols-outlined animate-spin text-[32px] text-[#58CC02]">sync</span></div>
          ) : preview ? (
            <div className="bg-[#FFF5F5] border-2 border-b-4 border-[#FFDFDF] rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase text-[#FF4B4B] mb-2">Chính sách hoàn cọc</h3>
              <div className="flex flex-col gap-2 text-xs font-bold">
                <div className="flex justify-between">
                  <span className="text-[#AFAFAF]">Tiền cọc ban đầu:</span>
                  <span className="text-[#4B4B4B] font-black">{formatVND(preview.depositAmount)}</span>
                </div>
                <div className="flex justify-between text-[#FF4B4B]">
                  <span>Khấu trừ phí phạt (nếu sát giờ):</span>
                  <span>- {formatVND(preview.penaltyAmount)}</span>
                </div>
                <div className="border-t-2 border-[#FFDFDF] my-1"></div>
                <div className="flex justify-between items-center text-sm font-black">
                  <span>Số tiền thực tế hoàn trả:</span>
                  <span className="text-[#58CC02] text-base">{formatVND(preview.refundAmount)}</span>
                </div>
                <p className="text-[11px] font-bold text-[#AFAFAF] mt-1">
                  * {preview.penaltyAmount > 0 ? "Khấu trừ 50% do hủy sát giờ hẹn (< 24h)." : "Miễn phí phạt do hủy hợp lệ trước 24h."}
                </p>
              </div>
            </div>
          ) : null}

          {/* Lý do hủy */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#4B4B4B] mb-2.5">
              Lý do hủy đặt chỗ <span className="text-[#FF4B4B]">*</span>
            </h3>
            <div className="flex flex-col gap-2">
              {CANCEL_REASONS.map((r, idx) => (
                <label key={idx} className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-[#F7F7F7] transition-colors">
                  <input type="radio" name="cancel_reason" value={r} onChange={(e) => setReason(e.target.value)} checked={reason === r} className="accent-[#FF4B4B] w-4 h-4 cursor-pointer" />
                  <span className="text-xs font-bold text-[#4B4B4B]">{r}</span>
                </label>
              ))}
              {reason === 'Lý do khác' && (
                <textarea 
                  className="duo-input w-full text-xs mt-2" 
                  rows="2" 
                  placeholder="Vui lòng cho chúng tôi biết lý do..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Kênh nhận tiền */}
          {reservation.status === 'DEPOSIT_PAID' && (
             <div className="bg-[#DDF4FF] border-2 border-b-4 border-[#84D8FF] rounded-2xl p-4">
                <h3 className="text-xs font-black uppercase text-[#1CB0F6] mb-1">
                  Thông tin tài khoản nhận tiền hoàn <span className="text-[#FF4B4B]">*</span>
                </h3>
                <p className="text-[11px] font-bold text-[#1899D6] mb-3">Xử lý trong vòng 24h làm việc.</p>
                <div className="grid grid-cols-1 gap-2.5">
                  <input type="text" placeholder="Tên ngân hàng (VD: Vietcombank, MB Bank)" className="duo-input w-full text-xs"
                         value={bankInfo.bankName} onChange={e => setBankInfo({...bankInfo, bankName: e.target.value})} />
                  <input type="text" placeholder="Số tài khoản ngân hàng" className="duo-input w-full text-xs"
                         value={bankInfo.bankAccountNumber} onChange={e => setBankInfo({...bankInfo, bankAccountNumber: e.target.value})} />
                  <input type="text" placeholder="Tên chủ tài khoản" className="duo-input w-full text-xs"
                         value={bankInfo.bankAccountName} onChange={e => setBankInfo({...bankInfo, bankAccountName: e.target.value})} />
                </div>
             </div>
          )}

          {/* Warning */}
          <div className="text-[#FF4B4B] flex gap-2 items-start text-xs font-bold bg-[#FFF5F5] p-3 rounded-xl border border-[#FFDFDF]">
             <span className="material-symbols-outlined text-[18px]">info</span>
             <p>Lưu ý: Thao tác hủy đơn không thể hoàn tác. Suất giữ phòng sẽ được mở lại ngay cho khách hàng khác.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-[#E5E5E5] bg-[#FAFAFA]">
          <button 
            onClick={onClose} 
            disabled={submitting}
            className="duo-btn-gray px-4 py-2 text-xs"
          >
            GIỮ LẠI ĐƠN
          </button>
          <button 
            onClick={handleConfirm}
            disabled={submitting}
            className="duo-btn-red px-5 py-2 text-xs tracking-wider"
          >
            {submitting ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN HỦY'}
          </button>
        </div>
      </div>
    </div>
  );
}