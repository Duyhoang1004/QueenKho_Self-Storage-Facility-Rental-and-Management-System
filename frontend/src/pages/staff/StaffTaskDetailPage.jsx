import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TaskConfirmDialog, TaskToast } from '../../components/TaskActionFeedback';
import { checkInStaffTask, getStaffTaskDetail, suggestAccessPin } from '../../services/staffTaskService';

// UC-18: Chi tiết task + Check-in & lập biên bản bàn giao (Handover Record)

const TYPE_META = {
  CHECK_IN:  { label: 'Check-in',  icon: 'login',  cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' },
  CHECK_OUT: { label: 'Check-out', icon: 'logout', cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' },
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

// 5 mục kiểm tra của biên bản — khớp field của CheckInRequest / handover_records
const CHECKLIST = [
  { key: 'identityVerified',           label: 'Đã xác minh CCCD của khách',     hint: 'Đối chiếu CCCD với thông tin đặt chỗ' },
  { key: 'unitEmpty',                  label: 'Ô kho trống',                    hint: 'Không còn đồ của người thuê trước' },
  { key: 'unitClean',                  label: 'Ô kho sạch sẽ',                  hint: 'Sàn, tường, cửa đã vệ sinh' },
  { key: 'lockIntact',                 label: 'Khoá SmartLock nguyên vẹn',      hint: 'Khoá hoạt động, không trầy xước' },
  { key: 'customerSignatureConfirmed', label: 'Khách đã ký biên bản bàn giao',  hint: 'Khách ký xác nhận trên biên bản giấy' },
];

const EMPTY_CHECKS = CHECKLIST.reduce((acc, item) => ({ ...acc, [item.key]: false }), {});
const NOTES_MAX = 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

// Vì sao người đang xem không lập được biên bản (null = lập được)
function blockedReason(task, userId) {
  if (task.taskType !== 'CHECK_IN') return 'Trang này chỉ hỗ trợ lập biên bản cho task check-in.';
  switch (task.status) {
    case 'OPEN': return 'Task chưa có người nhận. Hãy quay lại bảng công việc và bấm "Nhận việc" trước.';
    case 'OVERDUE': return 'Task đã quá hạn 21:00 ngày hẹn nên không thể lập biên bản. Vui lòng báo quản lý cơ sở.';
    case 'CANCELLED': return 'Task đã bị huỷ (khách không đến hoặc đơn đã huỷ).';
    case 'COMPLETED': return null;
    default:
      if (task.staffId !== userId) return `Task đang do ${task.staffName || 'nhân viên khác'} phụ trách.`;
      if (new Date(task.dueAt) <= new Date()) return 'Task đã quá hạn 21:00 ngày hẹn nên không thể lập biên bản.';
      return null;
  }
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

// Ô hiển thị mã PIN / RFID chữ to (để đọc cho khách)
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
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userId = user.userId;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Form biên bản
  const [checks, setChecks] = useState(EMPTY_CHECKS);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [rfid, setRfid] = useState('');
  const [notes, setNotes] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
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

  // Tải chi tiết; nếu mình lập được biên bản thì lấy luôn PIN gợi ý
  const loadTask = useCallback(() => {
    return getStaffTaskDetail(id, userId)
      .then(data => {
        setTask(data);
        setLoadError('');
        if (!blockedReason(data, userId) && data.status !== 'COMPLETED') {
          fetchPin();
        }
      })
      .catch(err => setLoadError(err.response?.data?.message || 'Không tải được công việc.'))
      .finally(() => setLoading(false));
  }, [id, userId, fetchPin]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const allChecked = CHECKLIST.every(item => checks[item.key]);
  const canSubmit = allChecked && /^\d{6}$/.test(pin) && rfid.trim() !== '' && notes.length <= NOTES_MAX && !submitting;

  const handleSubmit = () => {
    setSubmitting(true);
    checkInStaffTask(task.id, userId, { ...checks, accessPinCode: pin, rfidCardCode: rfid.trim(), notes })
      .then(data => {
        setTask(data);
        setJustCompleted(true);
        setToast({ type: 'success', message: `Check-in thành công. Hợp đồng ${data.contractCode} đã kích hoạt.` });
      })
      .catch(err => {
        const code = err.response?.data?.error;
        setToast({ type: 'error', message: err.response?.data?.message || 'Không lưu được biên bản, vui lòng thử lại.' });
        if (code === 'PIN_TAKEN') {
          fetchPin();
        } else if (code?.startsWith('TASK_') || code === 'CONTRACT_STATUS_INVALID') {
          // Trạng thái task / hợp đồng đã đổi (huỷ, quá hạn...) → tải lại để hiện đúng
          loadTask();
        }
      })
      .finally(() => {
        setSubmitting(false);
        setConfirmOpen(false);
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
    return (
      <div className="max-w-[1240px] mx-auto px-8 py-8">
        <div className="duo-card flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="material-symbols-outlined text-[#FF4B4B] text-[40px]">error</span>
          <p className="text-sm font-black text-[#FF4B4B]">{loadError || 'Không tìm thấy công việc.'}</p>
          <Link to="/staff" className="duo-btn-gray px-5 py-2.5 text-xs">Về bảng công việc</Link>
        </div>
      </div>
    );
  }

  const type = TYPE_META[task.taskType] || { label: task.taskType, icon: 'task', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' };
  const status = STATUS_META[task.status] || { label: task.status, cls: 'bg-[#F7F7F7] text-[#777777] border-2 border-[#E5E5E5]' };
  const reason = blockedReason(task, userId);
  const record = task.handoverRecord;

  return (
    <div className="max-w-[1240px] mx-auto px-8 py-8">
      {/* Header */}
      <Link to="/staff" className="inline-flex items-center gap-1 text-xs font-black uppercase text-[#AFAFAF] hover:text-[#1CB0F6] mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>Bảng công việc
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
        {/* Cột trái: thông tin */}
        <div className="flex flex-col gap-4">
          <InfoCard icon="person" title="Khách hàng">
            <InfoRow label="Họ tên" value={task.customerName} />
            <InfoRow label="Số điện thoại" value={task.customerPhone} />
            <InfoRow label="Email" value={task.customerEmail} />
          </InfoCard>
          <InfoCard icon="warehouse" title="Ô kho">
            <InfoRow label="Mã ô" value={task.storageUnitId} mono />
            <InfoRow label="Loại ô" value={task.unitTypeName} />
            <InfoRow label="Cơ sở" value={task.facilityName} />
          </InfoCard>
          <InfoCard icon="description" title="Hợp đồng">
            <InfoRow label="Mã hợp đồng" value={task.contractCode} mono />
            <InfoRow label="Trạng thái" value={CONTRACT_STATUS_LABEL[task.contractStatus] || task.contractStatus} />
            <InfoRow label="Ngày bắt đầu" value={formatDate(task.contractStartDate)} />
            <InfoRow label="Ngày kết thúc" value={formatDate(task.contractEndDate)} />
          </InfoCard>
          {task.note && (
            <InfoCard icon="sticky_note_2" title="Ghi chú task">
              <p className="text-xs font-bold text-[#777777] leading-relaxed whitespace-pre-line">{task.note}</p>
            </InfoCard>
          )}
        </div>

        {/* Cột phải: biên bản */}
        <div className="flex flex-col gap-4">
          {task.status === 'COMPLETED' ? (
            <div className="duo-card p-6 flex flex-col gap-5">
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
                      {CHECKLIST.map(item => (
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

              <Link to="/staff" className="duo-btn-gray px-5 py-2.5 text-xs self-end">Về bảng công việc</Link>
            </div>
          ) : reason ? (
            <div className="duo-card p-6 flex flex-col items-center justify-center gap-3 text-center py-12">
              <span className="material-symbols-outlined text-[#FF9600] text-[40px]">lock</span>
              <p className="text-sm font-black text-[#4B4B4B]">Không thể lập biên bản</p>
              <p className="text-xs font-bold text-[#777777] max-w-[360px]">{reason}</p>
            </div>
          ) : (
            <div className="duo-card p-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#4B4B4B]">Biên bản bàn giao</h2>
                  <p className="text-xs font-bold text-[#AFAFAF]">Kiểm tra đủ 5 mục, cấp mã PIN + thẻ RFID rồi xác nhận.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChecks(CHECKLIST.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}))}
                  className="duo-btn-white px-4 py-2 text-xs gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  Giả lập hoàn thiện
                </button>
              </div>

              {/* Checklist */}
              <div className="flex flex-col gap-2">
                {CHECKLIST.map(item => (
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
                <p className={`text-[11px] font-black ${allChecked ? 'text-[#58A700]' : 'text-[#AFAFAF]'}`}>
                  Đã kiểm tra {CHECKLIST.filter(item => checks[item.key]).length}/{CHECKLIST.length} mục
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
                disabled={!canSubmit}
                className="duo-btn-green px-5 py-3 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                Xác nhận bàn giao
              </button>
              {!canSubmit && !submitting && (
                <p className="text-[11px] font-bold text-[#AFAFAF] text-center -mt-3">
                  {!allChecked ? 'Cần tick đủ 5 mục kiểm tra.' : rfid.trim() === '' ? 'Cần nhập mã thẻ RFID.' : 'Đang chờ mã PIN...'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <TaskConfirmDialog
        open={confirmOpen}
        icon="how_to_reg"
        title="Xác nhận bàn giao ô kho?"
        message={`Hợp đồng ${task.contractCode} sẽ chuyển sang "Đang hoạt động" và khách nhận mã PIN ${pin}, thẻ RFID ${rfid.trim()}. Biên bản đã lưu không thể sửa.`}
        confirmLabel="Xác nhận"
        submitting={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
      <TaskToast toast={toast} onClose={closeToast} />
    </div>
  );
}
