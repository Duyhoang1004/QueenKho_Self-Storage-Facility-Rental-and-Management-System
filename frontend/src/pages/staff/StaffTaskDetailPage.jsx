import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback';
import {
  checkInStaffTask,
  checkOutStaffTask,
  completeRefundTask,
  getStaffTaskDetail,
  suggestAccessPin,
  uploadImageFile
} from '../../services/staffTaskService';

// UC-18: Chi tiết task + Check-in & lập biên bản bàn giao (Handover Record)
// UC-23, UC-24: Nghiệm thu trả kho (Check-out Inspection & Record Damage)
// UC-25: Quản lý thực hiện hoàn trả tiền cọc (Process Security Deposit Refund)

const TYPE_META = {
  CHECK_IN:  { label: 'Check-in',       icon: 'login',    cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  CHECK_OUT: { label: 'Check-out',      icon: 'logout',   cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
  REFUND:    { label: 'Hoàn tiền',      icon: 'payments', cls: 'bg-[#F3E8FF] text-[#A560E8] border-[#CE82FF]' },
};

const STATUS_META = {
  OPEN:        { label: 'Chờ nhận',   cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' },
  IN_PROGRESS: { label: 'Đang xử lý', cls: 'bg-[#F3E8FF] text-[#A560E8] border-2 border-[#CE82FF]' },
  OVERDUE:     { label: 'Quá hạn',    cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-2 border-[#FF4B4B]' },
  COMPLETED:   { label: 'Hoàn thành', cls: 'bg-[#D7FFB8] text-[#58A700] border-2 border-[#58CC02]' },
  CANCELLED:   { label: 'Đã huỷ',     cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' },
};

const CONTRACT_STATUS_LABEL = {
  PENDING_CHECK_IN: 'Chờ check-in',
  ACTIVE: 'Đang hoạt động',
  OVERDUE: 'Quá hạn thanh toán',
  TERMINATION_PENDING: 'Chờ trả kho',
  TERMINATED: 'Đã chấm dứt',
  LIQUIDATED: 'Đã thanh lý',
};

// 5 mục kiểm tra khi bàn giao nhận kho (CHECK_IN)
const CHECKLIST_IN = [
  { key: 'identityVerified',           label: 'Đã xác minh CCCD của khách',     hint: 'Đối chiếu CCCD với thông tin đặt chỗ' },
  { key: 'unitEmpty',                  label: 'Ô kho trống',                    hint: 'Không còn đồ của người thuê trước' },
  { key: 'unitClean',                  label: 'Ô kho sạch sẽ',                  hint: 'Sàn, tường, cửa đã vệ sinh' },
  { key: 'lockIntact',                 label: 'Khoá SmartLock nguyên vẹn',      hint: 'Khoá hoạt động, không trầy xước' },
  { key: 'customerSignatureConfirmed', label: 'Khách đã ký biên bản bàn giao',  hint: 'Khách ký xác nhận trên biên bản giấy' },
];

// 5 mục kiểm tra khi nghiệm thu trả kho (CHECK_OUT)
const CHECKLIST_OUT = [
  { key: 'identityVerified',           label: 'Đã xác minh khách hàng',         hint: 'Đúng chủ hợp đồng hoặc người đại diện' },
  { key: 'unitEmpty',                  label: 'Khách đã dọn sạch đồ đạc',       hint: 'Khoang hoàn toàn trống rỗng' },
  { key: 'unitClean',                  label: 'Khoang đã dọn vệ sinh',          hint: 'Không để lại rác thải, bụi bẩn' },
  { key: 'lockIntact',                 label: 'Ổ khóa & cửa nguyên vẹn',        hint: 'Không bị móp méo, hư hỏng' },
  { key: 'customerSignatureConfirmed', label: 'Biên bản nghiệm thu thống nhất', hint: 'Khách đồng ý với hiện trạng bàn giao' },
];

const EMPTY_CHECKS_IN = CHECKLIST_IN.reduce((acc, item) => ({ ...acc, [item.key]: false }), {});
const EMPTY_CHECKS_OUT = CHECKLIST_OUT.reduce((acc, item) => ({ ...acc, [item.key]: false }), {});
const NOTES_MAX = 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

import { parseRefundNote } from '../../utils/refundParser';

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).split('-');
  return `${d}/${m}/${y}`;
}

function blockedReason(task, userId) {
  if (task.status === 'COMPLETED') return null;
  if (task.status === 'CANCELLED') return 'Task đã bị huỷ.';
  
  // Với task REFUND, cho phép Quản lý hoặc Nhân viên vào xử lý
  if (task.taskType === 'REFUND') {
    return null;
  }

  // Với task CHECK_IN / CHECK_OUT
  if (task.status === 'OPEN') {
    return 'Task chưa có người nhận. Hãy quay lại bảng công việc và bấm "Nhận việc" trước.';
  }
  if (task.status === 'OVERDUE') {
    return 'Task đã quá hạn 21:00 ngày hẹn. Vui lòng báo quản lý cơ sở.';
  }
  if (task.staffId && task.staffId !== userId) {
    return `Task đang do ${task.staffName || 'nhân viên khác'} phụ trách.`;
  }
  return null;
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-[#F0F0F0] last:border-0 text-xs">
      <span className="font-bold text-[#AFAFAF]">{label}</span>
      <span className={`font-black text-[#4B4B4B] text-right ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function InfoCard({ icon, title, children }) {
  return (
    <div className="duo-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[20px] text-[#1CB0F6]">{icon}</span>
        <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CodeBox({ icon, label, value, big }) {
  return (
    <div className="rounded-2xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] p-4 flex flex-col items-center gap-1">
      <span className="text-[11px] font-black uppercase text-[#1899D6] flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
      </span>
      <span className={`font-mono font-black text-[#4B4B4B] break-all text-center ${big ? 'text-4xl tracking-[0.25em] whitespace-nowrap' : 'text-xl tracking-widest'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

export default function StaffTaskDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userId = user.userId;
  const isManager = ['FACILITY_MANAGER', 'MANAGER', 'ADMIN'].includes(user.role);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Form Check-in
  const [checks, setChecks] = useState(EMPTY_CHECKS_IN);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [rfid, setRfid] = useState('');
  const [notes, setNotes] = useState('');

  // Form Check-out
  const [checksOut, setChecksOut] = useState(EMPTY_CHECKS_OUT);
  const [damageFee, setDamageFee] = useState(0);

  // Form Refund (UC-25)
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [refundNotes, setRefundNotes] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', message: 'Vui lòng chọn file hình ảnh (PNG, JPG, WEBP).' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setToast({ type: 'error', message: 'Dung lượng file tối đa là 10MB.' });
      return;
    }

    setUploadingImage(true);
    try {
      const res = await uploadImageFile(file);
      setEvidenceImageUrl(res.url);
      setToast({ type: 'success', message: 'Tải ảnh biên lai lên thành công!' });
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Lỗi khi tải ảnh lên máy chủ.' });
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Modals & Status
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCheckoutOpen, setConfirmCheckoutOpen] = useState(false);
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const fetchPin = useCallback(() => {
    setPinLoading(true);
    return suggestAccessPin()
      .then(data => setPin(data.accessPinCode))
      .catch(err => setToast({ type: 'error', message: err.response?.data?.message || 'Không lấy được mã PIN.' }))
      .finally(() => setPinLoading(false));
  }, []);

  const loadTask = useCallback(() => {
    return getStaffTaskDetail(id, userId)
      .then(data => {
        setTask(data);
        setLoadError('');
        if (data.taskType === 'CHECK_IN' && !blockedReason(data, userId) && data.status !== 'COMPLETED') {
          fetchPin();
        }
      })
      .catch(err => setLoadError(err.response?.data?.message || 'Không tải được công việc.'))
      .finally(() => setLoading(false));
  }, [id, userId, fetchPin]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // Đồng bộ route prefix cho Quản lý: Task REFUND luôn nằm ở /manager/refunds/:id, Task khác ở /manager/tasks/:id
  useEffect(() => {
    if (!task || !isManager) return;
    if (task.taskType === 'REFUND' && location.pathname.startsWith('/manager/tasks/')) {
      navigate(`/manager/refunds/${task.id}`, { replace: true });
    } else if (task.taskType !== 'REFUND' && location.pathname.startsWith('/manager/refunds/')) {
      navigate(`/manager/tasks/${task.id}`, { replace: true });
    }
  }, [task, isManager, location.pathname, navigate]);

  // Submit Check-in (UC-18)
  const allCheckedIn = CHECKLIST_IN.every(item => checks[item.key]);
  const canSubmitIn = allCheckedIn && /^\d{6}$/.test(pin) && rfid.trim() !== '' && notes.length <= NOTES_MAX && !submitting;

  const handleSubmitCheckIn = () => {
    setSubmitting(true);
    checkInStaffTask(task.id, userId, { ...checks, accessPinCode: pin, rfidCardCode: rfid.trim(), notes })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({ type: 'success', message: `Check-in thành công. Hợp đồng ${data.contractCode} đã kích hoạt.` });
      })
      .catch(err => {
        setToast({ type: 'error', message: err.response?.data?.message || 'Không lưu được biên bản, vui lòng thử lại.' });
        loadTask();
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmOpen(false);
      });
  };

  // Submit Check-out (UC-23, UC-24)
  const allCheckedOut = CHECKLIST_OUT.every(item => checksOut[item.key]);
  const canSubmitOut = allCheckedOut && !submitting;

  const handleSubmitCheckOut = () => {
    setSubmitting(true);
    checkOutStaffTask(task.id, userId, {
      ...checksOut,
      damageFee: Number(damageFee) || 0,
      notes,
      evidenceImageUrl
    })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({ type: 'success', message: 'Nghiệm thu trả kho thành công! Task hoàn cọc đã được tạo cho Quản lý cơ sở.' });
      })
      .catch(err => {
        setToast({ type: 'error', message: err.response?.data?.message || 'Không thể nghiệm thu, vui lòng thử lại.' });
        loadTask();
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmCheckoutOpen(false);
      });
  };

  const isRefund = task?.taskType === 'REFUND';
  const parsedRefund = isRefund ? parseRefundNote(task?.note) : null;

  // Submit Refund (UC-25)
  const handleSubmitRefund = () => {
    setSubmitting(true);
    const amount = parsedRefund?.refundAmountNum > 0 ? parsedRefund.refundAmountNum : undefined;
    completeRefundTask(task.id, userId, {
      refundAmount: amount,
      evidenceImageUrl: evidenceImageUrl.trim(),
      notes: refundNotes.trim()
    })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({
          type: 'success',
          message: task.contractId
            ? 'Xác nhận hoàn tiền cọc thành công! Hợp đồng đã kết thúc và khoang được giải phóng.'
            : 'Xác nhận hoàn tiền thành công! Trạng thái đơn đặt chỗ đã chuyển sang ĐÃ HOÀN TIỀN.'
        });
      })
      .catch(err => {
        setToast({ type: 'error', message: err.response?.data?.message || 'Không thể xác nhận hoàn tiền, vui lòng thử lại.' });
        loadTask();
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmRefundOpen(false);
      });
  };

  // Sao chép nội dung (STK hoặc thông tin)
  const handleCopyText = (text, fieldName = 'all') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="max-w-[1240px] mx-auto px-8 py-8">
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3">
          <span className="material-symbols-outlined text-[#58CC02] text-[36px] animate-spin">progress_activity</span>
          <span className="text-xs font-black uppercase text-[#AFAFAF]">Đang tải công việc...</span>
        </div>
      </div>
    );
  }

  if (loadError || !task) {
    const isRefundPath = location.pathname.startsWith('/manager/refunds');
    return (
      <div className="max-w-[1240px] mx-auto px-8 py-8">
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="material-symbols-outlined text-[#FF4B4B] text-[40px]">error</span>
          <p className="text-sm font-black text-[#FF4B4B]">{loadError || 'Không tìm thấy công việc.'}</p>
          <Link
            to={isManager ? (isRefundPath ? "/manager/refunds" : "/manager/tasks") : "/staff"}
            className="duo-btn-gray px-5 py-2.5 text-xs"
          >
            {isRefundPath ? 'Về danh sách hoàn tiền' : 'Về bảng công việc'}
          </Link>
        </div>
      </div>
    );
  }

  const type = TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' };
  const status = isRefund && task.status === 'OPEN'
    ? { label: 'Chờ xử lý', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-2 border-[#84D8FF]' }
    : (STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' });
  const reason = blockedReason(task, userId);
  const record = task.handoverRecord;

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8 select-none">
      {/* Header breadcrumb */}
      <Link
        to={isManager ? (task.taskType === 'REFUND' || location.pathname.startsWith('/manager/refunds') ? "/manager/refunds" : "/manager/tasks") : "/staff"}
        className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#AFAFAF] hover:text-[#1CB0F6] mb-4"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {isManager ? (task.taskType === 'REFUND' || location.pathname.startsWith('/manager/refunds') ? "Quản lý hoàn tiền" : "Bảng công việc cơ sở") : "Bảng công việc nhân viên"}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-6 border-b-2 border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 ${type.cls}`}>
            <span className="material-symbols-outlined text-[24px]">{type.icon}</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#4B4B4B] tracking-tight">{type.label} · Task #{task.id}</h1>
            <p className="text-xs font-bold text-[#AFAFAF]">
              Hạn chót {formatDateTime(task.dueAt)}
              {task.staffName && <> · Phụ trách: <span className="text-[#4B4B4B] font-black">{task.staffName}</span></>}
            </p>
          </div>
        </div>
        <span className={`duo-badge whitespace-nowrap ${status.cls}`}>{status.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-6 items-start">
        {/* Cột trái: Thông tin hợp đồng, ô kho, khách hàng */}
        <div className="flex flex-col gap-4">
          <InfoCard icon="person" title="Khách hàng">
            <InfoRow label="Họ tên" value={task.customerName || parsedRefund?.customerName} />
            <InfoRow label="Số điện thoại" value={task.customerPhone || parsedRefund?.customerPhone} />
            <InfoRow label="Email" value={task.customerEmail} />
          </InfoCard>

          {task.storageUnitId && (
            <InfoCard icon="warehouse" title="Ô kho">
              <InfoRow label="Mã ô" value={task.storageUnitId} mono />
              <InfoRow label="Loại ô" value={task.unitTypeName} />
              <InfoRow label="Cơ sở" value={task.facilityName} />
            </InfoCard>
          )}

          {task.contractCode ? (
            <InfoCard icon="description" title="Hợp đồng">
              <InfoRow label="Mã hợp đồng" value={task.contractCode} mono />
              <InfoRow label="Trạng thái" value={CONTRACT_STATUS_LABEL[task.contractStatus] || task.contractStatus} />
              <InfoRow label="Ngày bắt đầu" value={formatDate(task.contractStartDate)} />
              <InfoRow label="Ngày kết thúc" value={formatDate(task.contractEndDate)} />
            </InfoCard>
          ) : (
            <InfoCard icon="inventory_2" title="Đối tượng">
              <InfoRow label="Loại việc" value="Hoàn tiền đơn đặt chỗ (Hủy đơn)" />
              <InfoRow label="Mã đơn đặt" value={task.reservationCode || parsedRefund?.orderCode} mono />
              {task.unitTypeName && <InfoRow label="Loại khoang" value={task.unitTypeName} />}
              <InfoRow label="Cơ sở" value={task.facilityName || 'Cơ sở hiện tại'} />
            </InfoCard>
          )}

          {task.taskType === 'REFUND' ? (
            <InfoCard icon="notes" title="Lý do hoàn tiền & Ghi chú">
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-[#F7F7F7] p-3.5 border border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] leading-relaxed">
                  <span className="text-[11px] font-black uppercase text-[#AFAFAF] block mb-1">Lý do từ khách hàng</span>
                  <p className="text-sm font-black text-[#4B4B4B]">
                    {parsedRefund?.reason || 'Khách yêu cầu hủy đơn / hoàn tiền.'}
                  </p>
                </div>

                {/* BẢNG CHÍNH SÁCH HOÀN TIỀN & KHẤU TRỪ */}
                <div className={`rounded-xl p-3.5 border-2 flex flex-col gap-2.5 ${
                  (parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty) 
                    ? 'bg-[#FFF5F5] border-[#FEB2B2]' 
                    : 'bg-[#F2FBF2] border-[#9AE6B4]'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className={`text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 ${
                      (parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty) ? 'text-[#C53030]' : 'text-[#22543D]'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {(parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty) ? 'warning' : 'verified_user'}
                      </span>
                      Chính sách hoàn tiền &amp; khấu trừ
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      (parsedRefund?.isPenalty50 || parsedRefund?.isDamagePenalty)
                        ? 'bg-[#FED7D7] text-[#C53030] border-[#FEB2B2]' 
                        : 'bg-[#C6F6D5] text-[#22543D] border-[#9AE6B4]'
                    }`}>
                      {parsedRefund?.policyBadge || (parsedRefund?.isPenalty50 ? 'Khấu trừ 50% tiền cọc' : 'Hoàn 100%')}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    {parsedRefund?.originalTotal && (
                      <div className="flex justify-between py-0.5">
                        <span className="font-bold text-[#718096]">
                          {parsedRefund?.isCheckout ? 'Tiền cọc giữ chỗ ban đầu:' : 'Tổng tiền khách đã đóng:'}
                        </span>
                        <span className="font-black text-[#2D3748]">{parsedRefund.originalTotal}</span>
                      </div>
                    )}

                    {parsedRefund?.isPenalty50 ? (
                      <div className="flex justify-between items-center py-0.5">
                        <span className="font-bold text-[#718096] flex items-center gap-1">
                          Khấu trừ tiền cọc:
                          <span className="text-[10px] font-semibold text-[#E53E3E]">(hủy sát giờ &lt; 24h)</span>
                        </span>
                        <span className="font-black text-[#E53E3E]">
                          - {parsedRefund.penaltyAmount}
                        </span>
                      </div>
                    ) : (
                      <>
                        {parsedRefund?.penaltyAmountNum > 0 && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">Khấu trừ hư hại khoang:</span>
                            <span className="font-black text-[#E53E3E]">
                              - {parsedRefund.penaltyAmount}
                            </span>
                          </div>
                        )}
                        {parsedRefund?.lateFeeNum > 0 && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">
                              Khấu trừ phí trễ hạn {parsedRefund.overdueDays ? `(${parsedRefund.overdueDays} ngày):` : ':'}
                            </span>
                            <span className="font-black text-[#E53E3E]">
                              - {parsedRefund.lateFee}
                            </span>
                          </div>
                        )}
                        {!parsedRefund?.penaltyAmountNum && !parsedRefund?.lateFeeNum && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-bold text-[#718096]">Chính sách áp dụng:</span>
                            <span className="font-black text-[#2F855A]">
                              {parsedRefund?.policyApplied || (parsedRefund?.isCheckout ? 'Khoang bàn giao nguyên vẹn (Hoàn 100% cọc)' : 'Hủy trước giờ hẹn > 24h (Hoàn 100%)')}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="pt-2 mt-1 border-t-2 border-dashed border-[#CBD5E0] flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase tracking-wider text-[#2D3748]">
                        Số tiền thực tế hoàn trả:
                      </span>
                      <span className="text-xl font-black text-[#2F855A]">
                        {parsedRefund?.refundAmount || '—'}
                      </span>
                    </div>

                    <p className="text-[10px] text-[#A0AEC0] italic mt-0.5">
                      {parsedRefund?.footerNote || (parsedRefund?.isCheckout 
                        ? '* Tiền cọc giữ chỗ được hoàn trả 100% sau khi nhân viên cơ sở hoàn tất nghiệm thu khoang trống.'
                        : '* Quý khách hủy đơn trước giờ hẹn > 24h được hoàn trả 100% tiền cọc.')}
                    </p>
                  </div>
                </div>
              </div>
            </InfoCard>
          ) : task.note ? (
            <InfoCard icon="sticky_note_2" title="Ghi chú">
              <div className="rounded-xl bg-[#F7F7F7] p-3 border border-[#E5E5E5] text-xs font-bold text-[#4B4B4B] leading-relaxed whitespace-pre-line">
                {task.note}
              </div>
            </InfoCard>
          ) : null}
        </div>

        {/* Cột phải: Xử lý theo từng loại việc */}
        <div className="flex flex-col gap-4">

          {/* ==================== 1. LOẠI VIỆC: REFUND (HOÀN TIỀN) ==================== */}
          {task.taskType === 'REFUND' ? (
            <div className="duo-card p-6 flex flex-col gap-5">
              {task.status === 'COMPLETED' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                    <span className="material-symbols-outlined text-[32px] text-[#58A700]">verified</span>
                    <div>
                      <p className="text-sm font-black text-[#58A700]">Đã hoàn tất chuyển tiền hoàn trả!</p>
                      <p className="text-xs font-bold text-[#58A700]">
                        Người xử lý: <span className="font-black">{task.staffName || 'Quản lý cơ sở'}</span> · Lúc {formatDateTime(task.completedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Tóm tắt thông tin tài khoản đã nhận tiền hoàn */}
                  <div className="rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] p-4 flex flex-col gap-2">
                    <span className="text-[11px] font-black uppercase text-[#AFAFAF] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      Tài khoản thụ hưởng đã nhận tiền hoàn
                    </span>
                    <div className="bg-white rounded-xl p-3.5 border border-[#E5E5E5] flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                        <span className="font-bold text-[#AFAFAF]">Số tiền hoàn:</span>
                        <span className="font-black text-[#A560E8] text-sm">{parsedRefund?.refundAmount || '—'}</span>
                      </div>
                      {!parsedRefund?.isCash ? (
                        <>
                          <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                            <span className="font-bold text-[#AFAFAF]">Ngân hàng:</span>
                            <span className="font-black text-[#4B4B4B]">{parsedRefund?.bankName || '—'}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                            <span className="font-bold text-[#AFAFAF]">Số tài khoản:</span>
                            <span className="font-mono font-black text-[#1CB0F6]">{parsedRefund?.bankAccountNumber || '—'}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="font-bold text-[#AFAFAF]">Chủ tài khoản:</span>
                            <span className="font-black text-[#4B4B4B] uppercase">{parsedRefund?.bankAccountName || task.customerName || parsedRefund?.customerName || '—'}</span>
                          </div>
                        </>
                      ) : (
                        <div className="py-1 text-[#58A700] font-bold">Hoàn tiền mặt trực tiếp tại quầy cơ sở</div>
                      )}
                    </div>
                  </div>

                  {task.evidenceImageUrl && (
                    <div className="rounded-2xl border-2 border-[#E5E5E5] p-4 flex flex-col gap-2">
                      <span className="text-[11px] font-black uppercase text-[#AFAFAF] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                        Bằng chứng / Biên lai chuyển tiền
                      </span>
                      <a
                        href={task.evidenceImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-black text-[#1CB0F6] hover:underline flex items-center gap-1"
                      >
                        Mở xem biên lai gốc <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                      <img
                        src={task.evidenceImageUrl}
                        alt="Biên lai chuyển khoản"
                        className="max-h-64 rounded-xl object-contain border border-[#E5E5E5] bg-slate-50"
                      />
                    </div>
                  )}

                  <Link to={isManager ? "/manager/refunds" : "/staff"} className="duo-btn-gray px-5 py-2.5 text-xs self-end">
                    Về danh sách hoàn tiền
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div>
                    <h2 className="text-lg font-black text-[#4B4B4B] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#A560E8]">account_balance</span>
                      Xử lý hoàn trả tiền cho khách
                    </h2>
                    <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                      Quản lý thực hiện chuyển khoản ngoài app ngân hàng theo thông tin thụ hưởng dưới đây, sau đó bấm xác nhận hoàn tất.
                    </p>
                  </div>

                  {/* Box hiển thị thông tin ngân hàng của khách */}
                  <div className="rounded-2xl bg-[#F3E8FF] border-2 border-[#CE82FF] p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-[#A560E8] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[20px]">credit_card</span>
                        Thông tin tài khoản thụ hưởng
                      </span>
                      {parsedRefund?.bankAccountNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(parsedRefund.bankAccountNumber, 'stk')}
                          className="px-3 py-1.5 bg-white hover:bg-[#FAF5FF] text-[#A560E8] border border-[#CE82FF] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {copiedField === 'stk' ? 'check' : 'content_copy'}
                          </span>
                          {copiedField === 'stk' ? 'Đã sao chép STK!' : 'Sao chép STK'}
                        </button>
                      )}
                    </div>

                    {/* Dòng số tiền cần chuyển hoàn */}
                    <div className="rounded-xl bg-white p-4 border border-[#E5D4FA] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#DDF4FF] border border-[#84D8FF] flex items-center justify-center text-[#1CB0F6]">
                          <span className="material-symbols-outlined text-[22px]">payments</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-[#AFAFAF] block">Số tiền cần chuyển hoàn</span>
                          <span className="text-2xl font-black text-[#58CC02] tracking-tight">
                            {parsedRefund?.refundAmount || '—'}
                          </span>
                        </div>
                      </div>
                      {parsedRefund?.refundAmountNum > 0 && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(String(parsedRefund.refundAmountNum), 'amount')}
                          className="px-3 py-1.5 bg-[#F0F9FF] hover:bg-[#E0F2FE] text-[#1CB0F6] border border-[#BAE6FD] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {copiedField === 'amount' ? 'check' : 'content_copy'}
                          </span>
                          {copiedField === 'amount' ? 'Đã chép số tiền!' : 'Sao chép số tiền'}
                        </button>
                      )}
                    </div>

                    {/* Chi tiết tài khoản ngân hàng */}
                    {parsedRefund?.isCash ? (
                      <div className="rounded-xl bg-white p-4 border border-[#E5D4FA] flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#58CC02] text-[28px]">payments</span>
                        <div>
                          <p className="text-sm font-black text-[#4B4B4B]">Hoàn tiền mặt trực tiếp</p>
                          <p className="text-xs font-bold text-[#777777]">Khách nhận tiền mặt trực tiếp tại quầy cơ sở.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white p-4 border border-[#E5D4FA] flex flex-col divide-y divide-[#F0F0F0] text-xs">
                        <div className="flex justify-between items-center py-2.5">
                          <span className="font-bold text-[#AFAFAF]">Ngân hàng thụ hưởng</span>
                          <span className="font-black text-[#4B4B4B] text-sm">{parsedRefund?.bankName || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2.5">
                          <span className="font-bold text-[#AFAFAF]">Số tài khoản (STK)</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#1CB0F6] bg-[#DDF4FF] px-3 py-1 rounded-lg border border-[#84D8FF]">
                              {parsedRefund?.bankAccountNumber || '—'}
                            </span>
                            {parsedRefund?.bankAccountNumber && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(parsedRefund.bankAccountNumber, 'stk_inline')}
                                title="Sao chép STK"
                                className="text-[#1CB0F6] hover:text-[#1899D6] p-1 rounded-md hover:bg-[#F0F9FF] transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {copiedField === 'stk_inline' ? 'check' : 'content_copy'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-2.5">
                          <span className="font-bold text-[#AFAFAF]">Tên chủ tài khoản</span>
                          <span className="font-black text-[#4B4B4B] uppercase tracking-wide">
                            {parsedRefund?.bankAccountName || task.customerName || parsedRefund?.customerName || '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form xác nhận của Quản lý */}
                  <div className="flex flex-col gap-3">
                    {/* Upload ảnh biên lai chuyển tiền (Bằng chứng) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase text-[#AFAFAF] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">receipt_long</span>
                          Ảnh chụp biên lai chuyển khoản (Bằng chứng)
                        </span>
                        {evidenceImageUrl && (
                          <button
                            type="button"
                            onClick={() => setEvidenceImageUrl('')}
                            className="text-[11px] font-bold text-[#FF4B4B] hover:underline cursor-pointer"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      {evidenceImageUrl ? (
                        <div className="rounded-2xl border-2 border-[#58CC02] bg-[#EBFBEF] p-3.5 flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <a
                              href={evidenceImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-[#58CC02] bg-white cursor-pointer hover:opacity-90 transition-opacity"
                              title="Bấm để xem ảnh phóng to"
                            >
                              <img
                                src={evidenceImageUrl}
                                alt="Biên lai chuyển khoản"
                                className="w-full h-full object-cover"
                              />
                            </a>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-black text-[#58A700] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                Đã tải ảnh biên lai thành công
                              </span>
                              <span className="text-[11px] text-[#4B4B4B]/80 font-mono truncate max-w-[240px] sm:max-w-[320px]">
                                {evidenceImageUrl.split('/').pop()}
                              </span>
                              <a
                                href={evidenceImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-[#1CB0F6] font-bold hover:underline mt-0.5 inline-flex items-center gap-0.5"
                              >
                                Xem ảnh gốc <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                              </a>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-[#58CC02] text-xs font-bold text-[#58A700] hover:bg-[#D7FFB8] transition-colors cursor-pointer"
                          >
                            Đổi ảnh
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => !uploadingImage && fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 transition-all cursor-pointer ${
                            uploadingImage
                              ? 'bg-slate-50 border-slate-300 pointer-events-none'
                              : 'bg-[#F7F7F7] border-[#CECECE] hover:border-[#1CB0F6] hover:bg-[#DDF4FF]/40'
                          }`}
                        >
                          {uploadingImage ? (
                            <>
                              <span className="material-symbols-outlined text-[36px] text-[#1CB0F6] animate-spin">
                                progress_activity
                              </span>
                              <span className="text-xs font-black text-[#1CB0F6]">
                                Đang tải ảnh biên lai lên...
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#1CB0F6]">
                                <span className="material-symbols-outlined text-[28px]">
                                  cloud_upload
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-black text-[#4B4B4B]">
                                  Bấm để chọn file ảnh biên lai chuyển tiền
                                </span>
                                <span className="text-[11px] text-[#AFAFAF] font-bold">
                                  Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
                        Ghi chú đối soát của Quản lý
                      </span>
                      <textarea
                        rows={2}
                        placeholder="VD: Đã chuyển khoản qua App MB Bank lúc 10:30..."
                        value={refundNotes}
                        onChange={e => setRefundNotes(e.target.value)}
                        className="duo-input text-xs resize-none"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmRefundOpen(true)}
                    disabled={submitting}
                    className="duo-btn-green px-5 py-3 text-sm gap-2 font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                    Xác nhận đã chuyển tiền hoàn
                  </button>
                </div>
              )}
            </div>

          /* ==================== 2. LOẠI VIỆC: CHECK_OUT (NGHIỆM THU TRẢ KHO) ==================== */
          ) : task.taskType === 'CHECK_OUT' ? (
            <div className="duo-card p-6 flex flex-col gap-5">
              {task.status === 'COMPLETED' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                    <span className="material-symbols-outlined text-[32px] text-[#58A700]">check_circle</span>
                    <div>
                      <p className="text-sm font-black text-[#58A700]">Đã nghiệm thu trả kho thành công!</p>
                      <p className="text-xs font-bold text-[#58A700]">Biên bản nghiệm thu đã được lưu. Task hoàn cọc đã được tạo cho Quản lý.</p>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide mb-3">Biên bản nghiệm thu</h2>
                    {record ? (
                      <ul className="flex flex-col gap-2">
                        {CHECKLIST_OUT.map(item => (
                          <li key={item.key} className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B]">
                            <span className={`material-symbols-outlined text-[20px] ${record[item.key] ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                              {record[item.key] ? 'check_circle' : 'cancel'}
                            </span>
                            {item.label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs font-bold text-[#AFAFAF]">Biên bản nghiệm thu đã hoàn tất.</p>
                    )}
                  </div>

                  <Link to={isManager ? "/manager/tasks" : "/staff"} className="duo-btn-gray px-5 py-2.5 text-xs self-end">Về bảng công việc</Link>
                </div>
              ) : reason ? (
                <div className="duo-card p-6 flex flex-col items-center justify-center gap-3 text-center py-12">
                  <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
                  <p className="text-sm font-black text-[#4B4B4B]">Chưa thể nghiệm thu</p>
                  <p className="text-xs font-bold text-[#777777] max-w-[360px]">{reason}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-[#4B4B4B]">Nghiệm thu trả kho &amp; Kiểm tra hiện trạng</h2>
                      <p className="text-xs font-bold text-[#AFAFAF]">Kiểm tra đủ 5 mục hiện trạng trước khi bàn giao khoang.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChecksOut(CHECKLIST_OUT.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}))}
                      className="duo-btn-white px-3.5 py-1.5 text-xs gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">done_all</span>
                      Chọn tất cả
                    </button>
                  </div>

                  {/* Checklist Check-out */}
                  <div className="flex flex-col gap-2">
                    {CHECKLIST_OUT.map(item => (
                      <label
                        key={item.key}
                        className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer select-none transition-colors ${
                          checksOut[item.key] ? 'bg-[#D7FFB8] border-[#58CC02]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checksOut[item.key]}
                          onChange={e => setChecksOut(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 accent-[#58CC02]"
                        />
                        <span className="flex flex-col">
                          <span className="text-xs font-black text-[#4B4B4B]">{item.label}</span>
                          <span className="text-[11px] font-bold text-[#AFAFAF]">{item.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Phí hư hại nếu có (UC-24) */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
                      Chi phí hư hỏng / Bồi thường khấu trừ cọc (VNĐ - UC-24)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={damageFee}
                      onChange={e => setDamageFee(e.target.value)}
                      placeholder="0"
                      className="duo-input font-bold"
                    />
                    <span className="text-[11px] font-bold text-[#777777]">
                      Nếu khoang nguyên vẹn thì để 0₫. Khoản phí này sẽ được tự động trừ vào tiền cọc hoàn lại.
                    </span>
                  </label>

                  {/* Ghi chú */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ghi chú hiện trạng</span>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Ghi nhận hiện trạng, tình trạng hư hỏng nếu có..."
                      className="duo-input resize-none text-xs"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setConfirmCheckoutOpen(true)}
                    disabled={!canSubmitOut}
                    className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                    Xác nhận nghiệm thu trả kho
                  </button>
                </div>
              )}
            </div>

          /* ==================== 3. LOẠI VIỆC: CHECK_IN (BÀN GIAO KHO) ==================== */
          ) : (
            <div className="duo-card p-6 flex flex-col gap-5">
              {task.status === 'COMPLETED' ? (
                <div className="flex flex-col gap-5">
                  {justCompleted && (
                    <div className="flex items-center gap-3 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] p-4">
                      <span className="material-symbols-outlined text-[32px] text-[#58A700]">verified</span>
                      <div>
                        <p className="text-sm font-black text-[#58A700]">Bàn giao thành công!</p>
                        <p className="text-xs font-bold text-[#58A700]">Đọc mã PIN và mã thẻ RFID bên dưới cho khách, sau đó phát thẻ từ.</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <CodeBox icon="pin" label="Mã PIN SmartLock" value={task.accessPinCode} big />
                    <CodeBox icon="contactless" label="Mã thẻ RFID" value={task.rfidCardCode} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-black uppercase text-[#4B4B4B] tracking-wide">Biên bản bàn giao</h2>
                      {record && <span className="text-[11px] font-bold text-[#AFAFAF]">#{record.id} · {formatDateTime(record.createdAt)}</span>}
                    </div>
                    {record ? (
                      <>
                        <ul className="flex flex-col gap-2">
                          {CHECKLIST_IN.map(item => (
                            <li key={item.key} className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B]">
                              <span className={`material-symbols-outlined text-[20px] ${record[item.key] ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                                {record[item.key] ? 'check_circle' : 'cancel'}
                              </span>
                              {item.label}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 rounded-2xl bg-[#F7F7F7] px-4 py-3 text-xs">
                          <p><span className="font-black text-[#AFAFAF] uppercase mr-1">Người lập:</span><span className="font-black text-[#4B4B4B]">{record.staffName}</span></p>
                          <p className="mt-1 whitespace-pre-line"><span className="font-black text-[#AFAFAF] uppercase mr-1">Ghi chú:</span><span className="font-bold text-[#777777]">{record.notes || 'Không có'}</span></p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-bold text-[#AFAFAF]">Task này không có biên bản bàn giao.</p>
                    )}
                  </div>

                  <Link to={isManager ? "/manager/tasks" : "/staff"} className="duo-btn-gray px-5 py-2.5 text-xs self-end">Về bảng công việc</Link>
                </div>
              ) : reason ? (
                <div className="duo-card p-6 flex flex-col items-center justify-center gap-3 text-center py-12">
                  <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
                  <p className="text-sm font-black text-[#4B4B4B]">Không thể lập biên bản</p>
                  <p className="text-xs font-bold text-[#777777] max-w-[360px]">{reason}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-[#4B4B4B]">Biên bản bàn giao</h2>
                      <p className="text-xs font-bold text-[#AFAFAF]">Kiểm tra đủ 5 mục, cấp mã PIN + thẻ RFID rồi xác nhận.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChecks(CHECKLIST_IN.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}))}
                      className="duo-btn-white px-4 py-2 text-xs gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                      Giả lập hoàn thiện
                    </button>
                  </div>

                  {/* Checklist Check-in */}
                  <div className="flex flex-col gap-2">
                    {CHECKLIST_IN.map(item => (
                      <label
                        key={item.key}
                        className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 cursor-pointer select-none transition-colors ${
                          checks[item.key] ? 'bg-[#D7FFB8] border-[#58CC02]' : 'bg-white border-[#E5E5E5] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checks[item.key]}
                          onChange={e => setChecks(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 accent-[#58CC02]"
                        />
                        <span className="flex flex-col">
                          <span className="text-xs font-black text-[#4B4B4B]">{item.label}</span>
                          <span className="text-[11px] font-bold text-[#AFAFAF]">{item.hint}</span>
                        </span>
                      </label>
                    ))}
                    <p className={`text-[11px] font-black ${allCheckedIn ? 'text-[#58A700]' : 'text-[#AFAFAF]'}`}>
                      Đã kiểm tra {CHECKLIST_IN.filter(item => checks[item.key]).length}/{CHECKLIST_IN.length} mục
                    </p>
                  </div>

                  {/* Mã PIN + RFID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Mã PIN SmartLock (hệ thống cấp)</span>
                      <div className="flex gap-2">
                        <div className="duo-input flex-1 font-mono font-black text-xl tracking-[0.3em] text-center text-[#4B4B4B]">
                          {pinLoading ? '······' : pin || '—'}
                        </div>
                        <button
                          type="button"
                          onClick={fetchPin}
                          disabled={pinLoading}
                          title="Sinh mã khác"
                          className="duo-btn-gray px-3 disabled:opacity-50"
                        >
                          <span className={`material-symbols-outlined text-[20px] ${pinLoading ? 'animate-spin' : ''}`}>refresh</span>
                        </button>
                      </div>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Mã thẻ RFID phát cho khách *</span>
                      <input
                        type="text"
                        value={rfid}
                        maxLength={50}
                        onChange={e => setRfid(e.target.value)}
                        placeholder="VD: RFID-TB-000123"
                        className="duo-input font-mono"
                      />
                    </label>
                  </div>

                  {/* Ghi chú */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase text-[#AFAFAF]">Ghi chú</span>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Tình trạng ô, đồ khách mang vào, lưu ý khác..."
                      className="duo-input resize-none"
                    />
                    <span className={`text-[11px] font-bold self-end ${notes.length > NOTES_MAX ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>
                      {notes.length}/{NOTES_MAX}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canSubmitIn}
                    className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                    Xác nhận bàn giao
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialog xác nhận Check-in */}
      <TaskConfirmDialog
        open={confirmOpen}
        icon="how_to_reg"
        title="Xác nhận bàn giao ô kho?"
        message={`Hợp đồng ${task.contractCode} sẽ chuyển sang "Đang hoạt động" và khách nhận mã PIN ${pin}, thẻ RFID ${rfid.trim()}. Biên bản đã lưu không thể sửa.`}
        confirmLabel="Xác nhận"
        submitting={submitting}
        onConfirm={handleSubmitCheckIn}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Dialog xác nhận Check-out */}
      <TaskConfirmDialog
        open={confirmCheckoutOpen}
        icon="assignment_turned_in"
        title="Xác nhận nghiệm thu trả kho?"
        message={`Xác nhận nghiệm thu trả khoang cho hợp đồng ${task.contractCode || ''}. Sau khi nghiệm thu, hệ thống sẽ tự động tạo Task Hoàn tiền cọc cho Quản lý cơ sở xử lý trong vòng 24 giờ.`}
        confirmLabel="Xác nhận nghiệm thu"
        submitting={submitting}
        onConfirm={handleSubmitCheckOut}
        onCancel={() => setConfirmCheckoutOpen(false)}
      />

      {/* Dialog xác nhận Hoàn tiền (Refund) */}
      <TaskConfirmDialog
        open={confirmRefundOpen}
        icon="payments"
        tone="green"
        title="Xác nhận đã chuyển tiền hoàn trả?"
        message={
          task.contractCode
            ? "Quản lý đã chuyển khoản thành công tiền hoàn cho khách. Hệ thống sẽ chính thức đóng hợp đồng, giải phóng ô kho về trạng thái Sẵn sàng và cập nhật giao dịch."
            : `Quản lý đã chuyển tiền hoàn (${parsedRefund?.refundAmount || ''}) cho khách ${task.customerName || parsedRefund?.customerName || ''}. Hệ thống sẽ đóng công việc và cập nhật giao dịch sang THÀNH CÔNG.`
        }
        confirmLabel="Xác nhận đã chuyển tiền"
        submitting={submitting}
        onConfirm={handleSubmitRefund}
        onCancel={() => setConfirmRefundOpen(false)}
      />

      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  );
}
