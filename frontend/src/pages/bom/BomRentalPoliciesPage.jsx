import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBomFacilities } from '../../services/facilityService';
import {
  FALLBACK_POLICY_FACILITIES,
  createRentalPolicyVersion,
  getRentalPolicies,
  getRentalPolicyHistory,
  restoreRentalPolicyVersion,
} from '../../services/rentalPolicyService';

const EMPTY_FORM = {
  depositMonthMultiplier: '1',
  cancelFeePercent: '20',
  cancelFreeHours: '24',
  lateFeePercentPerDay: '10',
  lateFeeMaxPercent: '50',
  liquidationDays: '30',
};

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function normalizeFacilities(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function getLatestPolicies(items) {
  const latest = new Map();
  items.forEach((item) => {
    const current = latest.get(String(item.facilityId));
    if (!current || Number(item.version) > Number(current.version)) {
      latest.set(String(item.facilityId), item);
    }
  });
  return latest;
}

function validatePolicy(form) {
  const errors = {};
  const number = (key) => Number(form[key]);

  if (!form.depositMonthMultiplier || number('depositMonthMultiplier') < 1 || number('depositMonthMultiplier') > 3) {
    errors.depositMonthMultiplier = 'Tiền cọc phải từ 1 đến 3 tháng.';
  }
  if (form.cancelFeePercent === '' || number('cancelFeePercent') < 0 || number('cancelFeePercent') > 100) {
    errors.cancelFeePercent = 'Phí hủy phải từ 0% đến 100%.';
  }
  if (form.cancelFreeHours === '' || number('cancelFreeHours') < 0) {
    errors.cancelFreeHours = 'Số giờ miễn phí không được âm.';
  }
  if (form.lateFeePercentPerDay === '' || number('lateFeePercentPerDay') < 0 || number('lateFeePercentPerDay') > 100) {
    errors.lateFeePercentPerDay = 'Phí trễ hạn phải từ 0% đến 100%.';
  }
  if (form.lateFeeMaxPercent === '' || number('lateFeeMaxPercent') < 0 || number('lateFeeMaxPercent') > 100) {
    errors.lateFeeMaxPercent = 'Mức trần phải từ 0% đến 100%.';
  } else if (number('lateFeeMaxPercent') < number('lateFeePercentPerDay')) {
    errors.lateFeeMaxPercent = 'Mức trần phải lớn hơn hoặc bằng phí mỗi ngày.';
  }
  if (!form.liquidationDays || number('liquidationDays') < 1) {
    errors.liquidationDays = 'Thời hạn thanh lý tối thiểu là 1 ngày.';
  }
  return errors;
}

function SummaryCard({ icon, label, value, badge, tone }) {
  const styles = {
    blue: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]',
    green: 'bg-[#EAF7DD] text-[#58A700] border-[#B4E885]',
    orange: 'bg-[#FFF4E5] text-[#FF9600] border-[#FFD299]',
  };
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-2xl border-2 border-[#E5E5E5] bg-[#FAFAFA] p-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 ${styles[tone]}`}>
        <span className="material-symbols-outlined text-[23px]">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[#AFAFAF]">{label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="truncate text-base font-black text-[#4B4B4B]">{value}</p>
          {badge && <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${styles[tone]}`}>{badge}</span>}
        </div>
      </div>
    </div>
  );
}

function RuleLine({ icon, title, description, tone = 'blue' }) {
  const styles = {
    blue: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]',
    green: 'bg-[#EAF7DD] text-[#58A700] border-[#B4E885]',
    orange: 'bg-[#FFF4E5] text-[#FF9600] border-[#FFD299]',
    red: 'bg-[#FFF0F0] text-[#FF4B4B] border-[#FFC1C1]',
  };
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border-2 border-[#E5E5E5] bg-white px-4 py-3.5">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${styles[tone]}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-[#4B4B4B]">{title}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-[#777777]">{description}</p>
      </div>
    </div>
  );
}

function PolicySection({ icon, title, expanded, onToggle, children, tone = 'blue' }) {
  const tones = {
    blue: {
      border: 'border-[#1CB0F6]',
      softBorder: 'border-[#84D8FF]',
      background: 'bg-[#DDF4FF]',
      hover: 'hover:bg-[#CDEFFF]',
      icon: 'border-[#84D8FF] bg-[#DDF4FF] text-[#1CB0F6]',
    },
    orange: {
      border: 'border-[#FF9600]',
      softBorder: 'border-[#FFD299]',
      background: 'bg-[#FFF4E5]',
      hover: 'hover:bg-[#FFE8C2]',
      icon: 'border-[#FFD299] bg-[#FFF4E5] text-[#FF9600]',
    },
    red: {
      border: 'border-[#FF4B4B]',
      softBorder: 'border-[#FFC1C1]',
      background: 'bg-[#FFF0F0]',
      hover: 'hover:bg-[#FFE1E1]',
      icon: 'border-[#FFC1C1] bg-[#FFF0F0] text-[#FF4B4B]',
    },
    purple: {
      border: 'border-[#A559D9]',
      softBorder: 'border-[#CE82FF]',
      background: 'bg-[#F3E3FF]',
      hover: 'hover:bg-[#EBD3FC]',
      icon: 'border-[#CE82FF] bg-[#F3E3FF] text-[#A559D9]',
    },
  };
  const color = tones[tone] || tones.blue;

  return (
    <div className={`overflow-hidden rounded-2xl border-2 bg-white transition-colors ${expanded ? `${color.border} shadow-sm` : 'border-[#E5E5E5]'}`}>
      <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors ${expanded ? `${color.background} ${color.hover}` : 'bg-white hover:bg-[#F7F7F7]'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${color.icon}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <p className="truncate text-base font-black text-[#4B4B4B]">{title}</p>
          <span className="shrink-0 rounded-full border border-[#B4E885] bg-[#EAF7DD] px-2.5 py-1 text-[10px] font-semibold text-[#58A700]">● Đang áp dụng</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1CB0F6]">
          {expanded ? 'Thu gọn' : 'Chi tiết'}
          <span className="material-symbols-outlined text-[17px]">{expanded ? 'expand_less' : 'expand_more'}</span>
        </span>
      </button>
      {expanded && (
        <div className={`border-t-2 p-4 ${color.softBorder} ${color.background}`}>
          <div className={`rounded-2xl border-2 bg-white p-3 ${color.softBorder}`}>
            <div className="space-y-2.5">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalShell({ icon, title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#00000066] p-4" onMouseDown={onClose}>
      <div
        className={`duo-card flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-2xl ${wide ? 'max-w-[820px]' : 'max-w-[680px]'}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b-2 border-[#E5E5E5] px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-[#84D8FF] bg-[#DDF4FF] text-[#1CB0F6]">
              <span className="material-symbols-outlined text-[24px]">{icon}</span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-[#4B4B4B]">{title}</h2>
              <p className="truncate text-sm font-medium text-[#AFAFAF]">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#AFAFAF] hover:bg-[#F7F7F7] hover:text-[#4B4B4B]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NumberField({ label, name, value, onChange, error, min, max, suffix, step = '1', hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#777777]">{label}</span>
      <div className="relative">
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          className={`duo-input w-full pr-16 text-sm ${error ? 'border-[#FF4B4B] bg-[#FFF5F5]' : ''}`}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#AFAFAF]">{suffix}</span>
      </div>
      <p className={`mt-1 min-h-4 text-[11px] font-medium ${error ? 'text-[#FF4B4B]' : 'text-[#AFAFAF]'}`}>{error || hint}</p>
    </label>
  );
}

function PolicyFormModal({ facility, policy, onClose, onSaved }) {
  const [form, setForm] = useState(() => policy ? {
    depositMonthMultiplier: String(policy.depositMonthMultiplier),
    cancelFeePercent: String(policy.cancelFeePercent),
    cancelFreeHours: String(policy.cancelFreeHours),
    lateFeePercentPerDay: String(policy.lateFeePercentPerDay),
    lateFeeMaxPercent: String(policy.lateFeeMaxPercent),
    liquidationDays: String(policy.liquidationDays),
  } : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validatePolicy(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const user = getCurrentUser();
      await createRentalPolicyVersion(facility.id, form, user.fullName);
      onSaved(policy ? `Đã tạo phiên bản mới cho ${facility.name}.` : `Đã thiết lập chính sách cho ${facility.name}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      icon={policy ? 'edit_document' : 'add_notes'}
      title={policy ? 'Cập nhật chính sách' : 'Thiết lập chính sách'}
      subtitle={`${facility.code ? `${facility.code} · ` : ''}${facility.name}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="overflow-y-auto p-6">
        {policy && (
          <div className="mb-5 flex gap-3 rounded-2xl border-2 border-[#FFD58A] bg-[#FFF8E9] p-4 text-[#946000]">
            <span className="material-symbols-outlined shrink-0">history</span>
            <div>
              <p className="text-sm font-semibold">Thay đổi sẽ tạo phiên bản {Number(policy.version) + 1}</p>
              <p className="mt-0.5 text-xs font-medium">Phiên bản {policy.version} vẫn được giữ để đối chiếu với các hợp đồng đã ký.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
          <NumberField label="Tiền cọc" name="depositMonthMultiplier" value={form.depositMonthMultiplier} onChange={handleChange} error={errors.depositMonthMultiplier} min="1" max="3" suffix="tháng" hint="Từ 1 đến 3 tháng tiền thuê" />
          <NumberField label="Phí hủy đặt chỗ" name="cancelFeePercent" value={form.cancelFeePercent} onChange={handleChange} error={errors.cancelFeePercent} min="0" max="100" suffix="%" hint="Tỷ lệ khấu trừ khi hủy" />
          <NumberField label="Thời gian hủy miễn phí" name="cancelFreeHours" value={form.cancelFreeHours} onChange={handleChange} error={errors.cancelFreeHours} min="0" suffix="giờ" hint="Tính từ lúc đặt chỗ" />
          <NumberField label="Phí trễ hạn mỗi ngày" name="lateFeePercentPerDay" value={form.lateFeePercentPerDay} onChange={handleChange} error={errors.lateFeePercentPerDay} min="0" max="100" suffix="%/ngày" hint="Tính trên khoản quá hạn" />
          <NumberField label="Mức trần phí trễ hạn" name="lateFeeMaxPercent" value={form.lateFeeMaxPercent} onChange={handleChange} error={errors.lateFeeMaxPercent} min="0" max="100" suffix="%" hint="Không nhỏ hơn phí trễ mỗi ngày" />
          <NumberField label="Thời hạn trước thanh lý" name="liquidationDays" value={form.liquidationDays} onChange={handleChange} error={errors.liquidationDays} min="1" suffix="ngày" hint="Tối thiểu 1 ngày" />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 border-t-2 border-[#E5E5E5] pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="duo-btn-gray px-5 py-2.5 text-xs disabled:opacity-50">Hủy</button>
          <button type="submit" disabled={saving} className="duo-btn-green gap-2 px-5 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? 'Đang lưu...' : policy ? 'Lưu phiên bản mới' : 'Lưu chính sách'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function HistoryModal({ facility, history, onClose, onRestore }) {
  return (
    <ModalShell icon="history" title="Lịch sử chính sách" subtitle={`${facility.code ? `${facility.code} · ` : ''}${facility.name}`} onClose={onClose} wide>
      <div className="overflow-y-auto p-6">
        <div className="space-y-3">
          {history.map((item, index) => (
            <article key={item.id} className={`rounded-2xl border-2 p-4 ${index === 0 ? 'border-[#B4E885] bg-[#F6FFF0]' : 'border-[#E5E5E5] bg-white'}`}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${index === 0 ? 'bg-[#58CC02] text-white' : 'bg-[#F7F7F7] text-[#777777]'}`}>v{item.version}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#4B4B4B]">Phiên bản {item.version}</p>
                      {index === 0 && <span className="duo-badge border border-[#B4E885] bg-[#EAF7DD] px-2 py-0.5 text-[10px] text-[#58A700]">Đang áp dụng</span>}
                    </div>
                    <p className="text-xs font-medium text-[#AFAFAF]">{formatDate(item.createdAt)} · {item.createdBy}</p>
                  </div>
                </div>
                {index > 0 && (
                  <button type="button" onClick={() => onRestore(item)} className="duo-btn-white gap-1 px-3 py-2 text-[11px]">
                    <span className="material-symbols-outlined text-[17px]">restore</span>
                    Dùng lại phiên bản này
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-[#777777] md:grid-cols-3">
                <span>Cọc: <strong className="text-[#4B4B4B]">{item.depositMonthMultiplier} tháng</strong></span>
                <span>Phí hủy: <strong className="text-[#4B4B4B]">{item.cancelFeePercent}%</strong></span>
                <span>Miễn hủy: <strong className="text-[#4B4B4B]">{item.cancelFreeHours} giờ</strong></span>
                <span>Trễ hạn: <strong className="text-[#4B4B4B]">{item.lateFeePercentPerDay}%/ngày</strong></span>
                <span>Trần phí: <strong className="text-[#4B4B4B]">{item.lateFeeMaxPercent}%</strong></span>
                <span>Thanh lý: <strong className="text-[#4B4B4B]">{item.liquidationDays} ngày</strong></span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

export default function BomRentalPoliciesPage() {
  const [facilities, setFacilities] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [expandedSections, setExpandedSections] = useState({ cancellation: false, overdue: false, liquidation: false });
  const [activeFacility, setActiveFacility] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    let loadedFacilities;
    try {
      loadedFacilities = normalizeFacilities(await getBomFacilities());
      if (!loadedFacilities.length) loadedFacilities = FALLBACK_POLICY_FACILITIES;
    } catch {
      loadedFacilities = FALLBACK_POLICY_FACILITIES;
    }
    const loadedPolicies = await getRentalPolicies(loadedFacilities);
    setFacilities(loadedFacilities);
    setPolicies(loadedPolicies);
    setSelectedFacilityId((current) => current || String(loadedFacilities[0]?.id || ''));
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const latestPolicies = useMemo(() => getLatestPolicies(policies), [policies]);
  const selectedFacility = useMemo(
    () => facilities.find((item) => String(item.id) === String(selectedFacilityId)) || facilities[0] || null,
    [facilities, selectedFacilityId]
  );
  const selectedPolicy = selectedFacility ? latestPolicies.get(String(selectedFacility.id)) : null;
  const configuredCount = facilities.filter((item) => latestPolicies.has(String(item.id))).length;

  const openForm = (facility) => {
    setActiveFacility(facility);
    setFormOpen(true);
  };

  const openHistory = async (facility) => {
    setActiveFacility(facility);
    setHistory(await getRentalPolicyHistory(facility.id));
    setHistoryOpen(true);
  };

  const handleSaved = async (message) => {
    setFormOpen(false);
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
    setPolicies(await getRentalPolicies(facilities));
  };

  const handleRestore = async (policy) => {
    const user = getCurrentUser();
    await restoreRentalPolicyVersion(policy, user.fullName);
    setHistory(await getRentalPolicyHistory(policy.facilityId));
    setPolicies(await getRentalPolicies(facilities));
    setNotice(`Đã khôi phục nội dung phiên bản ${policy.version} thành một phiên bản mới.`);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const toggleSection = (name) => {
    setExpandedSections((current) => ({ ...current, [name]: !current[name] }));
  };

  return (
    <div className="mx-auto max-w-[1280px] select-none space-y-6 px-6 py-8 font-sans">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-[#E5E5E5] pb-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#AFAFAF]">
            <span>Hệ thống BOM</span><span>/</span><span>Vận hành</span><span>/</span><span className="text-[#1CB0F6]">Chính sách thuê kho</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#4B4B4B] md:text-3xl">Chính Sách Thuê Kho Theo Cơ Sở</h1>
          <p className="text-xs font-medium text-[#777777]">Quy định nghiệp vụ và biểu phí được áp dụng tự động trên hệ thống QueenKho.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!selectedPolicy} onClick={() => selectedFacility && openHistory(selectedFacility)} className="duo-btn-gray gap-1.5 px-4 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">
            <span className="material-symbols-outlined text-[17px]">history</span>Lịch sử
          </button>
          <button type="button" disabled={!selectedFacility} onClick={() => selectedFacility && openForm(selectedFacility)} className="duo-btn-green gap-1.5 px-4 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">
            <span className="material-symbols-outlined text-[17px]">add</span>{selectedPolicy ? 'Tạo phiên bản mới' : 'Thiết lập mới'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="duo-card flex items-center justify-between border-[#B4E885] bg-[#F6FFF0] p-4 text-sm font-semibold text-[#3E8E14]">
          <span className="flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}><span className="material-symbols-outlined">close</span></button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-white" />
          <div className="h-80 animate-pulse rounded-xl bg-white" />
        </div>
      ) : (
        <>
          <section className="duo-card space-y-4 bg-white p-5">
            <div className="flex flex-col justify-between gap-3 border-b-2 border-[#F0F0F0] pb-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#B4E885] bg-[#EAF7DD] text-[#58A700]">
                  <span className="material-symbols-outlined text-[22px]">policy</span>
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#4B4B4B]">Tổng quan chính sách</h2>
                  <p className="text-[11px] font-medium text-[#AFAFAF]">Trạng thái thiết lập và phiên bản chính sách đang áp dụng</p>
                </div>
              </div>
              <span className="duo-badge border-2 border-[#B4E885] bg-[#EAF7DD] text-[10px] text-[#58A700]">
                <span className="h-2 w-2 rounded-full bg-[#58CC02]" />
                {configuredCount}/{facilities.length} cơ sở đã thiết lập
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <SummaryCard icon="verified_user" label="Trạng thái đồng bộ" value={`${configuredCount}/${facilities.length} cơ sở có chính sách`} badge={configuredCount === facilities.length ? '100% khớp' : 'Cần kiểm tra'} tone="green" />
              <SummaryCard icon="description" label="Phiên bản đang dùng" value={selectedPolicy ? `Phiên bản ${selectedPolicy.version}` : 'Chưa thiết lập'} badge={selectedPolicy ? 'Hiệu lực' : undefined} tone="blue" />
              <SummaryCard icon="notifications_active" label="Cảnh báo quy định" value={selectedPolicy ? 'Không có vi phạm' : 'Thiếu chính sách'} badge={selectedPolicy ? 'An toàn' : 'Kiểm tra'} tone="orange" />
            </div>
          </section>

          <section className="duo-card flex flex-col gap-3 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#84D8FF] bg-[#DDF4FF] text-[#1CB0F6]"><span className="material-symbols-outlined text-[22px]">warehouse</span></div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-[#4B4B4B]">Cơ sở áp dụng</p>
                <p className="truncate text-[11px] font-medium text-[#AFAFAF]">Chọn cơ sở để xem và thiết lập chính sách riêng</p>
              </div>
            </div>
            <select value={selectedFacilityId} onChange={(event) => setSelectedFacilityId(event.target.value)} className="duo-input min-w-[320px] cursor-pointer py-2.5 text-sm">
              {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.code ? `${facility.code} · ` : ''}{facility.name}</option>)}
            </select>
          </section>

          {selectedPolicy ? (
            <>
              <section className="duo-card bg-white p-5">
                <div className="mb-4 flex flex-col justify-between gap-3 border-b-2 border-[#F0F0F0] pb-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#CE82FF] bg-[#F3E3FF] text-[#A559D9]">
                      <span className="material-symbols-outlined text-[21px]">folder_open</span>
                    </span>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-[#4B4B4B]">Danh mục quy trình & chế tài</h2>
                      <p className="text-[11px] font-medium text-[#AFAFAF]">Các quy định được hệ thống áp dụng tự động cho cơ sở đã chọn</p>
                    </div>
                  </div>
                  <span className="duo-badge border-2 border-[#84D8FF] bg-[#DDF4FF] text-[10px] text-[#1CB0F6]">3 nhóm quy định</span>
                </div>
                <div className="space-y-3 rounded-2xl border-2 border-[#E5E5E5] bg-[#F7F7F7] p-3">
                  <PolicySection icon="currency_exchange" title="Chính sách đặt cọc & hủy đặt chỗ" tone="orange" expanded={expandedSections.cancellation} onToggle={() => toggleSection('cancellation')}>
                    <RuleLine icon="account_balance_wallet" title={`Cọc khi đặt kho: ${selectedPolicy.depositMonthMultiplier} tháng tiền thuê`} description="Cọc được tính từ giá niêm yết theo chính sách hiện hành và lưu cố định vào đơn đặt kho." tone="green" />
                    <RuleLine icon="timer" title={`Hủy trước giờ nhận kho trên ${selectedPolicy.cancelFreeHours} giờ: Hoàn 100%`} description="Mốc tính là giờ hẹn nhận kho; khách hàng được hoàn lại toàn bộ số tiền đã thanh toán." tone="blue" />
                    <RuleLine icon="percent" title={`Hủy trong ${selectedPolicy.cancelFreeHours} giờ trước khi nhận: Phí ${selectedPolicy.cancelFeePercent}% cọc`} description="Phí hủy được khấu trừ trên tiền cọc; phần tiền còn lại được tạo yêu cầu hoàn." tone="orange" />
                  </PolicySection>

                  <PolicySection icon="running_with_errors" title="Xử lý thanh toán trễ hạn" tone="red" expanded={expandedSections.overdue} onToggle={() => toggleSection('overdue')}>
                    <RuleLine icon="schedule" title={`Mỗi ngày quá hạn: ${selectedPolicy.lateFeePercentPerDay}% cọc đang giữ`} description="Phí được tính động theo số ngày quá hạn và chưa ghi giao dịch cho đến khi khách thanh toán hoặc bị khấu trừ vào cọc." tone="blue" />
                    <RuleLine icon="vertical_align_top" title={`Mức phí tối đa: ${selectedPolicy.lateFeeMaxPercent}% cọc đang giữ`} description="Khi chạm mức trần, hệ thống ngừng tăng phí trễ hạn." tone="orange" />
                    <RuleLine icon="inventory_2" title={`Quá ${selectedPolicy.liquidationDays} ngày: Cho phép FM thanh lý`} description="Hệ thống chỉ mở quyền thao tác; FM phải xác nhận thanh lý và nhập ghi chú quá trình liên hệ khách." tone="red" />
                  </PolicySection>

                  <PolicySection icon="inventory" title="Chính sách thanh lý tài sản" tone="purple" expanded={expandedSections.liquidation} onToggle={() => toggleSection('liquidation')}>
                    <RuleLine icon="event_upcoming" title={`Điều kiện thanh lý: Quá hạn trên ${selectedPolicy.liquidationDays} ngày`} description="Thời hạn được đọc từ phiên bản chính sách đã gắn với hợp đồng khi ký." tone="blue" />
                    <RuleLine icon="fact_check" title="FM xác nhận thanh lý và ghi chú liên hệ" description="Thanh lý không chạy tự động; FM tại cơ sở là người thực hiện thao tác khi đã đủ điều kiện." tone="green" />
                    <RuleLine icon="savings" title="Khấu trừ phí trễ và tạm giữ phần cọc còn lại" description="Phần cọc còn lại chỉ được hoàn khi khách đến cơ sở làm việc; việc xử lý tài sản diễn ra ngoài hệ thống và được ghi log." tone="orange" />
                  </PolicySection>
                </div>
              </section>

              <section className="duo-card bg-white p-5">
                <div className="mb-4 flex flex-col justify-between gap-3 border-b-2 border-[#F0F0F0] pb-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#FFD299] bg-[#FFF4E5] text-[#FF9600]">
                      <span className="material-symbols-outlined text-[21px]">account_tree</span>
                    </span>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-[#4B4B4B]">Quy trình xử lý vi phạm thanh toán</h2>
                      <p className="text-[11px] font-medium text-[#AFAFAF]">Các mốc theo dõi và điều kiện xử lý theo chính sách hiện hành</p>
                    </div>
                  </div>
                  <span className="duo-badge border-2 border-[#B4E885] bg-[#EAF7DD] text-[10px] text-[#58A700]">Tính phí tự động</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border-2 border-b-4 border-[#84D8FF] bg-[#DDF4FF] p-4">
                    <p className="text-[10px] font-semibold uppercase text-[#1CB0F6]">Giai đoạn 1</p>
                    <p className="mt-0.5 text-lg font-black text-[#4B4B4B]">Từ ngày 1</p>
                    <p className="mt-1 text-xs font-medium text-[#777777]">Bắt đầu tính {selectedPolicy.lateFeePercentPerDay}% cọc đang giữ mỗi ngày</p>
                  </div>
                  <div className="rounded-2xl border-2 border-b-4 border-[#FFC1C1] bg-[#FFF0F0] p-4">
                    <p className="text-[10px] font-semibold uppercase text-[#FF4B4B]">Giai đoạn 2</p>
                    <p className="mt-0.5 text-lg font-black text-[#4B4B4B]">Tối đa {selectedPolicy.lateFeeMaxPercent}% cọc</p>
                    <p className="mt-1 text-xs font-medium text-[#777777]">Dừng tăng phí và cảnh báo cơ sở phụ trách</p>
                  </div>
                  <div className="rounded-2xl border-2 border-b-4 border-[#CE82FF] bg-[#F3E3FF] p-4">
                    <p className="text-[10px] font-semibold uppercase text-[#A559D9]">Giai đoạn 3</p>
                    <p className="mt-0.5 text-lg font-black text-[#4B4B4B]">Quá {selectedPolicy.liquidationDays} ngày</p>
                    <p className="mt-1 text-xs font-medium text-[#777777]">FM được phép xác nhận thanh lý sau khi ghi chú liên hệ</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-[#AFAFAF]">
                  <span>Phiên bản {selectedPolicy.version} · Cập nhật {formatDate(selectedPolicy.createdAt)}</span>
                  <span>Quy định có hiệu lực tại {selectedFacility?.name}</span>
                </div>
              </section>
            </>
          ) : (
            <div className="duo-card flex flex-col items-center gap-3 bg-white py-14 text-center">
              <span className="material-symbols-outlined text-4xl text-[#AFAFAF]">note_add</span>
              <div><p className="font-black text-[#4B4B4B]">Cơ sở chưa có chính sách</p><p className="mt-1 text-xs font-medium text-[#777777]">Thiết lập chính sách trước khi mở nhận đặt kho.</p></div>
              <button type="button" onClick={() => selectedFacility && openForm(selectedFacility)} className="duo-btn-blue gap-1 px-4 py-2.5 text-xs"><span className="material-symbols-outlined text-[18px]">add</span>Thiết lập ngay</button>
            </div>
          )}
        </>
      )}

      <div className="duo-card flex items-start gap-3 bg-white p-4 text-xs font-medium text-[#777777]">
        <span className="material-symbols-outlined text-[#1CB0F6]">info</span>
        <p>Chính sách đã phát hành không bị ghi đè hoặc xóa. Mỗi lần chỉnh sửa hay khôi phục đều tạo một phiên bản mới; hợp đồng cũ tiếp tục dùng đúng phiên bản đã gắn khi ký.</p>
      </div>

      {formOpen && activeFacility && (
        <PolicyFormModal facility={activeFacility} policy={latestPolicies.get(String(activeFacility.id))} onClose={() => setFormOpen(false)} onSaved={handleSaved} />
      )}
      {historyOpen && activeFacility && (
        <HistoryModal facility={activeFacility} history={history} onClose={() => setHistoryOpen(false)} onRestore={handleRestore} />
      )}
    </div>
  );
}
