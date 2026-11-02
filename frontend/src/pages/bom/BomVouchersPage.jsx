import { useCallback, useEffect, useState } from 'react'
import { getAllFacilities } from '../../services/facilityService'
import { createBomVoucher, getBomVouchers, setBomVoucherStatus, updateBomVoucher } from '../../services/voucherService'

// BR-25: BOM quản lý voucher đặt kho trực tuyến (tạo / sửa / tạm dừng, theo dõi lượt dùng)

const MONTH_OPTIONS = [1, 3, 6, 12]

const EMPTY_FORM = {
  code: '',
  name: '',
  discountType: 'FIXED',
  discountValue: '',
  maxDiscount: '',
  minMonths: 1,
  facilityId: '',
  startAt: '',
  endAt: '',
  usageLimit: '',
  perUserLimit: '',
  isDefault: false,
}

function formatVND(amount) {
  if (amount === null || amount === undefined || amount === '') return '—'
  return Number(amount).toLocaleString('vi-VN') + '₫'
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// datetime-local cần "yyyy-MM-ddTHH:mm"
function toInputValue(value) {
  return value ? String(value).slice(0, 16) : ''
}

function discountLabel(v) {
  if (v.discountType === 'PERCENT') {
    return `${Number(v.discountValue)}% tiền thuê${v.maxDiscount ? ` (tối đa ${formatVND(v.maxDiscount)})` : ''}`
  }
  return formatVND(v.discountValue)
}

function validityState(v) {
  const now = new Date()
  if (v.status !== 'ACTIVE') return { label: 'Tạm dừng', cls: 'bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]' }
  if (v.startAt && new Date(v.startAt) > now) return { label: 'Chưa bắt đầu', cls: 'bg-[#DDF4FF] text-[#1CB0F6] border-[#84D8FF]' }
  if (v.endAt && new Date(v.endAt) < now) return { label: 'Hết hạn', cls: 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]' }
  if (v.usageLimit && v.usedCount >= v.usageLimit) return { label: 'Hết lượt', cls: 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]' }
  return { label: 'Đang áp dụng', cls: 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]' }
}

export default function BomVouchersPage() {
  const [vouchers, setVouchers] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState(null) // null = đóng form, {} = tạo mới, voucher = sửa
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchVouchers = useCallback(() => getBomVouchers()
    .then((data) => { setVouchers(data || []); setError('') })
    .catch((err) => setError(err.response?.data?.message || 'Không tải được danh sách voucher.'))
    .finally(() => setLoading(false)), [])

  const load = () => {
    setLoading(true)
    fetchVouchers()
  }

  useEffect(() => {
    fetchVouchers()
    getAllFacilities().then((data) => setFacilities(data || [])).catch(() => setFacilities([]))
  }, [fetchVouchers])

  const openCreate = () => {
    setEditing({})
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const openEdit = (v) => {
    setEditing(v)
    setForm({
      code: v.code,
      name: v.name,
      discountType: v.discountType,
      discountValue: v.discountValue ?? '',
      maxDiscount: v.maxDiscount ?? '',
      minMonths: v.minMonths || 1,
      facilityId: v.facilityId ?? '',
      startAt: toInputValue(v.startAt),
      endAt: toInputValue(v.endAt),
      usageLimit: v.usageLimit ?? '',
      perUserLimit: v.perUserLimit ?? '',
      isDefault: Boolean(v.isDefault),
    })
    setFormError('')
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormError('')
  }

  const handleSave = async () => {
    const code = form.code.trim().toUpperCase()
    if (!/^[A-Z0-9]{3,30}$/.test(code)) {
      setFormError('Mã voucher gồm 3–30 ký tự chữ (không dấu) hoặc số, không khoảng trắng.')
      return
    }
    if (!form.name.trim()) {
      setFormError('Vui lòng nhập tên voucher.')
      return
    }
    if (!(Number(form.discountValue) > 0)) {
      setFormError('Mức giảm phải lớn hơn 0.')
      return
    }
    if (form.discountType === 'PERCENT' && Number(form.discountValue) > 100) {
      setFormError('Giảm theo % tối đa 100%.')
      return
    }
    const payload = {
      code,
      name: form.name.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: form.discountType === 'PERCENT' && form.maxDiscount !== '' ? Number(form.maxDiscount) : null,
      minMonths: Number(form.minMonths),
      facilityId: form.facilityId !== '' ? Number(form.facilityId) : null,
      startAt: form.startAt ? `${form.startAt}:00` : null,
      endAt: form.endAt ? `${form.endAt}:00` : null,
      usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit !== '' ? Number(form.perUserLimit) : null,
      isDefault: form.isDefault,
    }
    setSaving(true)
    try {
      if (editing?.id) {
        await updateBomVoucher(editing.id, payload)
        setToast(`Đã cập nhật voucher ${code}.`)
      } else {
        await createBomVoucher(payload)
        setToast(`Đã tạo voucher ${code}.`)
      }
      setEditing(null)
      load()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Không lưu được voucher.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (v) => {
    try {
      await setBomVoucherStatus(v.id, v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      setToast(v.status === 'ACTIVE' ? `Đã tạm dừng voucher ${v.code}.` : `Đã mở lại voucher ${v.code}.`)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Không đổi được trạng thái voucher.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#4B4B4B]">Voucher đặt kho</h1>
          <p className="text-xs font-bold text-[#AFAFAF] mt-1">
            Mỗi đơn đặt kho trực tuyến áp tối đa 1 mã, không cộng dồn, chỉ áp lúc đặt kho (không áp cho gia hạn). Lượt dùng tính khi khách cọc thành công; huỷ đơn không trả lại lượt.
          </p>
        </div>
        <button onClick={openCreate} className="duo-btn-green px-5 py-3 text-xs tracking-wider shrink-0">
          <span className="material-symbols-outlined text-[18px] mr-1">add</span>
          TẠO VOUCHER
        </button>
      </div>

      {toast && (
        <div className="bg-[#D7FFB8] border-2 border-[#58CC02] rounded-2xl px-4 py-3 text-xs font-bold text-[#58A700] flex justify-between items-center">
          <span>{toast}</span>
          <button onClick={() => setToast('')} className="cursor-pointer"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>
      )}
      {error && (
        <div className="bg-[#FFDFDF] border-2 border-[#FF4B4B] rounded-2xl px-4 py-3 text-xs font-bold text-[#FF4B4B]">{error}</div>
      )}

      <div className="duo-card overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[880px]">
          <thead className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Mã</th>
              <th className="py-3 px-4">Mức giảm</th>
              <th className="py-3 px-4">Điều kiện</th>
              <th className="py-3 px-4">Hiệu lực</th>
              <th className="py-3 px-4">Lượt dùng</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#E5E5E5] text-xs font-bold text-[#4B4B4B]">
            {loading && (
              <tr><td colSpan={7} className="py-8 text-center text-[#AFAFAF]">Đang tải...</td></tr>
            )}
            {!loading && vouchers.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-[#AFAFAF]">Chưa có voucher nào.</td></tr>
            )}
            {!loading && vouchers.map((v) => {
              const state = validityState(v)
              return (
                <tr key={v.id} className="hover:bg-[#FDFDFD]">
                  <td className="py-3 px-4">
                    <p className="font-black text-[#1CB0F6] font-mono">{v.code}</p>
                    <p className="text-[11px] text-[#777777]">{v.name}</p>
                    {v.isDefault && (
                      <span className="inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-[#FFF8EE] text-[#E58800] border border-[#FF9600]">Mặc định — tự áp</span>
                    )}
                  </td>
                  <td className="py-3 px-4">{discountLabel(v)}</td>
                  <td className="py-3 px-4 text-[11px]">
                    <p>Gói từ {v.minMonths} tháng</p>
                    <p className="text-[#777777]">{v.facilityName || 'Mọi cơ sở'}</p>
                  </td>
                  <td className="py-3 px-4 text-[11px]">
                    {formatDateTime(v.startAt)} → {v.endAt ? formatDateTime(v.endAt) : 'không hết hạn'}
                  </td>
                  <td className="py-3 px-4 text-[11px]">
                    <p className="font-black">{v.usedCount}{v.usageLimit ? ` / ${v.usageLimit}` : ''}</p>
                    <p className="text-[#777777]">{v.perUserLimit ? `${v.perUserLimit} lượt / khách` : 'Không giới hạn / khách'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`duo-badge border-2 ${state.cls}`}>{state.label}</span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex gap-2">
                      <button onClick={() => openEdit(v)} className="duo-btn-white px-3 py-1.5 text-[11px]">Sửa</button>
                      <button
                        onClick={() => toggleStatus(v)}
                        className={`${v.status === 'ACTIVE' ? 'duo-btn-red' : 'duo-btn-green'} px-3 py-1.5 text-[11px]`}
                      >
                        {v.status === 'ACTIVE' ? 'Tạm dừng' : 'Mở lại'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card bg-white w-full max-w-[560px] max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4">
            <h3 className="text-lg font-black text-[#4B4B4B]">{editing.id ? `Sửa voucher ${editing.code}` : 'Tạo voucher mới'}</h3>
            {editing.id && editing.usedCount > 0 && (
              <p className="text-[11px] font-bold text-[#E58800]">Voucher đã có {editing.usedCount} lượt dùng nên không đổi được mã. Đơn đã đặt giữ nguyên mức giảm cũ.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Mã voucher *
                <input className="duo-input text-xs uppercase" value={form.code} maxLength={30}
                  disabled={Boolean(editing.id && editing.usedCount > 0)}
                  onChange={(e) => setField('code', e.target.value.toUpperCase())} placeholder="VD: HE2026" />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Tên hiển thị *
                <input className="duo-input text-xs" value={form.name} maxLength={150}
                  onChange={(e) => setField('name', e.target.value)} placeholder="VD: Ưu đãi hè 2026" />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Loại giảm *
                <select className="duo-input text-xs" value={form.discountType} onChange={(e) => setField('discountType', e.target.value)}>
                  <option value="FIXED">Số tiền cố định</option>
                  <option value="PERCENT">% tiền thuê</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                {form.discountType === 'PERCENT' ? 'Phần trăm giảm (1–100) *' : 'Số tiền giảm (₫) *'}
                <input type="number" min={1} className="duo-input text-xs" value={form.discountValue}
                  onChange={(e) => setField('discountValue', e.target.value)} />
              </label>
              {form.discountType === 'PERCENT' && (
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Giảm tối đa (₫)
                  <input type="number" min={1} className="duo-input text-xs" value={form.maxDiscount}
                    onChange={(e) => setField('maxDiscount', e.target.value)} placeholder="Bỏ trống = không trần" />
                </label>
              )}
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Gói thuê tối thiểu
                <select className="duo-input text-xs" value={form.minMonths} onChange={(e) => setField('minMonths', e.target.value)}>
                  {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{m} tháng</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Cơ sở áp dụng
                <select className="duo-input text-xs" value={form.facilityId} onChange={(e) => setField('facilityId', e.target.value)}>
                  <option value="">Mọi cơ sở</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Bắt đầu
                <input type="datetime-local" className="duo-input text-xs" value={form.startAt}
                  onChange={(e) => setField('startAt', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Kết thúc
                <input type="datetime-local" className="duo-input text-xs" value={form.endAt}
                  onChange={(e) => setField('endAt', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Tổng lượt dùng
                <input type="number" min={1} className="duo-input text-xs" value={form.usageLimit}
                  onChange={(e) => setField('usageLimit', e.target.value)} placeholder="Bỏ trống = không giới hạn" />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                Lượt / khách
                <input type="number" min={1} className="duo-input text-xs" value={form.perUserLimit}
                  onChange={(e) => setField('perUserLimit', e.target.value)} placeholder="Bỏ trống = không giới hạn" />
              </label>
            </div>

            <label className="flex items-start gap-2 text-xs font-bold text-[#4B4B4B] cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setField('isDefault', e.target.checked)} className="mt-0.5" />
              <span>Mã mặc định — tự áp cho khách không nhập mã (chỉ 1 mã mặc định, chọn mã này sẽ bỏ mặc định của mã cũ)</span>
            </label>

            {formError && (
              <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B]">{formError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button onClick={() => setEditing(null)} disabled={saving} className="duo-btn-gray px-4 py-2.5 text-xs">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="duo-btn-green px-5 py-2.5 text-xs">
                {saving ? 'Đang lưu...' : 'Lưu voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
