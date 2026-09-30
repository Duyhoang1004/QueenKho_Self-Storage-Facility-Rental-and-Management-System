import React, { useState, useEffect } from 'react';
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

  // Handle parse Array date từ Spring Boot trả về hoặc ISO String
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '—';
    let date = Array.isArray(dateVal) 
      ? new Date(dateVal[0], dateVal[1]-1, dateVal[2], dateVal[3] || 0, dateVal[4] || 0)
      : new Date(dateVal);
    return date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) + ' - ' + date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-title-md text-error font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            Xác nhận hủy đặt chỗ khoang lưu trữ
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-ink">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          
          {/* Tóm tắt đơn */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-body-md text-on-surface">
              <div><span className="text-on-surface-variant">Mã đơn:</span> <strong className="text-ink">{reservation.reservationCode}</strong></div>
              <div><span className="text-on-surface-variant">Chi nhánh:</span> <strong className="text-ink">{reservation.facilityName}</strong></div>
              <div><span className="text-on-surface-variant">Loại kho:</span> <strong className="text-ink">{reservation.unitTypeName}</strong></div>
              <div><span className="text-on-surface-variant">Giờ hẹn nhận kho dự kiến:</span> <strong className="text-ink">{preview ? formatDateTime(preview.appointmentTime) : 'Đang tính toán...'}</strong></div>
            </div>
          </div>

          {/* Khung tính toán hoàn cọc */}
          {loading ? (
             <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : preview ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <h3 className="text-title-md text-ink mb-3">Tính toán hoàn cọc</h3>
              <div className="flex flex-col gap-2 text-body-md">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Tiền cọc ban đầu:</span>
                  <span className="font-semibold text-ink">{formatVND(preview.depositAmount)}</span>
                </div>
                <div className="flex justify-between text-error">
                  <span>Khấu trừ phí phạt hủy sát giờ:</span>
                  <span>- {formatVND(preview.penaltyAmount)}</span>
                </div>
                <div className="border-t border-outline-variant my-1"></div>
                <div className="flex justify-between items-center text-title-md">
                  <span>Số tiền thực tế hoàn trả:</span>
                  <span className="text-success text-lg">{formatVND(preview.refundAmount)}</span>
                </div>
                <p className="text-body-sm text-on-surface-variant italic mt-1">
                  * {preview.penaltyAmount > 0 ? "Bị trừ 50% cọc do hủy trong vòng 24h hoặc quá giờ hẹn." : "Bạn được miễn phí phạt vì hủy hợp lệ trước 24h so với giờ hẹn."}
                </p>
              </div>
            </div>
          ) : null}

          {/* Lý do hủy */}
          <div>
            <h3 className="text-title-md text-ink mb-3">Lý do hủy đặt chỗ <span className="text-error">*</span></h3>
            <div className="flex flex-col gap-2">
              {CANCEL_REASONS.map((r, idx) => (
                <label key={idx} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="cancel_reason" value={r} onChange={(e) => setReason(e.target.value)} checked={reason === r} className="mt-1" />
                  <span className="text-body-md text-on-surface">{r}</span>
                </label>
              ))}
              {reason === 'Lý do khác' && (
                <textarea 
                  className="mt-2 w-full border border-outline-variant rounded-md p-2 text-body-md focus:border-primary focus:outline-none" 
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
             <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h3 className="text-title-md text-blue-900 mb-2">Kênh nhận tiền hoàn cọc (Tài khoản ngân hàng) <span className="text-error">*</span></h3>
                <p className="text-body-sm text-blue-700 mb-3">Nhận qua chuyển khoản sẽ xử lý sau 24h làm việc. Vui lòng nhập chính xác.</p>
                <div className="grid grid-cols-1 gap-3">
                  <input type="text" placeholder="Tên ngân hàng (VD: Vietcombank)" className="border border-outline-variant rounded-md p-2 w-full text-body-md"
                         value={bankInfo.bankName} onChange={e => setBankInfo({...bankInfo, bankName: e.target.value})} />
                  <input type="text" placeholder="Số tài khoản" className="border border-outline-variant rounded-md p-2 w-full text-body-md"
                         value={bankInfo.bankAccountNumber} onChange={e => setBankInfo({...bankInfo, bankAccountNumber: e.target.value})} />
                  <input type="text" placeholder="Tên chủ tài khoản" className="border border-outline-variant rounded-md p-2 w-full text-body-md"
                         value={bankInfo.bankAccountName} onChange={e => setBankInfo({...bankInfo, bankAccountName: e.target.value})} />
                </div>
             </div>
          )}

          {/* Warning */}
          <div className="text-[#B91C1C] flex gap-2 items-start text-body-md">
             <span className="material-symbols-outlined text-[20px]">info</span>
             <p><strong>Lưu ý:</strong> Thao tác này không thể hoàn tác. Suất giữ phòng sẽ được giải phóng ngay lập tức cho khách hàng khác.</p>
          </div>
        </div>

        {/* Footer Cặp nút thao tác */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
          <button 
            onClick={onClose} 
            disabled={submitting}
            className="px-5 py-2 border border-outline-variant text-on-surface-variant rounded-md font-medium hover:bg-surface-variant transition-colors"
          >
            Giữ lại đơn
          </button>
          <button 
            onClick={handleConfirm}
            disabled={submitting}
            className="px-5 py-2 bg-[#B91C1C] text-white rounded-md font-medium hover:bg-red-800 transition-colors flex items-center gap-2"
          >
            {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            Xác nhận hủy đặt chỗ
          </button>
        </div>
      </div>
    </div>
  );
}