import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getBomCentralWarehouses,
  getBomGoodsCategories,
  saveBomCentralWarehouse,
  saveBomGoodsCategory,
  setBomCentralWarehouseStatus,
  setBomGoodsCategoryStatus,
} from '../../services/catalogService'

// Họp nhóm 05/11/2026 — BOM quản lý:
//  - BR-131 danh mục loại hàng khách chọn khi đặt kho (thực phẩm chỉ cho kho lạnh / đông)
//  - BR-134 kho tổng giữ hàng của khách quá hạn / không tới nhận (không bán)

const TABS = [
  { key: 'goods', path: '/bom/goods-categories', icon: 'category', label: 'Loại hàng gửi kho' },
  { key: 'warehouses', path: '/bom/central-warehouses', icon: 'home_storage', label: 'Kho tổng' },
]

const EMPTY_GOODS = { code: '', name: '', description: '', requiresColdStorage: false, requiresNote: false, sortOrder: 0 }
const EMPTY_WAREHOUSE = { name: '', address: '', hotline: '', note: '' }

function StatusBadge({ status }) {
  return status === 'ACTIVE'
    ? <span className="duo-badge border-2 bg-[#D7FFB8] text-[#58A700] border-[#58CC02]">Đang dùng</span>
    : <span className="duo-badge border-2 bg-[#F7F7F7] text-[#777777] border-[#E5E5E5]">Ngừng</span>
}

export default function BomCatalogPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const tab = location.pathname.startsWith('/bom/central-warehouses') ? 'warehouses' : 'goods'

  const [goods, setGoods] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState(null) // null = đóng; {} = tạo mới; item = sửa
  const [form, setForm] = useState(EMPTY_GOODS)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(() => {
    return Promise.all([getBomGoodsCategories(), getBomCentralWarehouses()])
      .then(([g, w]) => {
        setGoods(Array.isArray(g) ? g : [])
        setWarehouses(Array.isArray(w) ? w : [])
        setError('')
      })
      .catch((err) => setError(err.response?.data?.message || 'Không tải được dữ liệu.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const load = () => {
    setLoading(true)
    fetchAll()
  }

  const openCreate = () => {
    setEditing({})
    setForm(tab === 'goods' ? EMPTY_GOODS : EMPTY_WAREHOUSE)
    setFormError('')
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm(tab === 'goods'
      ? {
        code: item.code,
        name: item.name || '',
        description: item.description || '',
        requiresColdStorage: Boolean(item.requiresColdStorage),
        requiresNote: Boolean(item.requiresNote),
        sortOrder: item.sortOrder ?? 0,
      }
      : { name: item.name || '', address: item.address || '', hotline: item.hotline || '', note: item.note || '' })
    setFormError('')
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormError('')
  }

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setFormError(tab === 'goods' ? 'Vui lòng nhập tên loại hàng.' : 'Vui lòng nhập tên kho tổng.')
      return
    }
    setSaving(true)
    try {
      if (tab === 'goods') {
        await saveBomGoodsCategory(editing?.id, {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          requiresColdStorage: form.requiresColdStorage,
          requiresNote: form.requiresNote,
          sortOrder: Number(form.sortOrder) || 0,
        })
      } else {
        await saveBomCentralWarehouse(editing?.id, {
          name: form.name.trim(),
          address: form.address.trim(),
          hotline: form.hotline.trim() || null,
          note: form.note.trim() || null,
        })
      }
      setToast(editing?.id ? `Đã cập nhật "${form.name.trim()}".` : `Đã thêm "${form.name.trim()}".`)
      setEditing(null)
      load()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Không lưu được.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (item) => {
    const next = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      if (tab === 'goods') await setBomGoodsCategoryStatus(item.id, next)
      else await setBomCentralWarehouseStatus(item.id, next)
      setToast(next === 'ACTIVE' ? `Đã mở lại "${item.name}".` : `Đã ngừng "${item.name}".`)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Không đổi được trạng thái.')
    }
  }

  const rows = tab === 'goods' ? goods : warehouses

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#4B4B4B]">{tab === 'goods' ? 'Loại hàng gửi kho' : 'Kho tổng'}</h1>
          <p className="text-xs font-bold text-[#AFAFAF] mt-1 max-w-[720px]">
            {tab === 'goods'
              ? 'Khách chọn loại hàng khi đặt kho; nhân viên đối chiếu khi nhận kho. Loại "cần kho lạnh" chỉ đặt được ở loại kho lạnh / kho đông. Ngừng một loại hàng không ảnh hưởng đơn đã đặt.'
              : 'Hàng của khách hết hạn không gia hạn / không trả kho được chuyển vào kho tổng và giữ tới khi khách nhận lại (không bán). Khách quá hạn thấy địa chỉ + hotline kho tổng trong trang hợp đồng.'}
          </p>
        </div>
        <button onClick={openCreate} className="duo-btn-green px-5 py-3 text-xs tracking-wider shrink-0">
          <span className="material-symbols-outlined text-[18px] mr-1">add</span>
          {tab === 'goods' ? 'THÊM LOẠI HÀNG' : 'THÊM KHO TỔNG'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate(t.path)}
            className={`px-4 py-2 rounded-2xl border-2 text-xs font-black flex items-center gap-1.5 ${
              tab === t.key ? 'bg-[#DDF4FF] border-[#1CB0F6] text-[#1899D6]' : 'bg-white border-[#E5E5E5] text-[#777777] hover:bg-[#F7F7F7]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
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
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead className="bg-[#F7F7F7] border-b-2 border-[#E5E5E5] text-[#AFAFAF] text-[11px] font-black uppercase tracking-wider">
            {tab === 'goods' ? (
              <tr>
                <th className="py-3 px-4">Mã</th>
                <th className="py-3 px-4">Tên loại hàng</th>
                <th className="py-3 px-4">Điều kiện</th>
                <th className="py-3 px-4">Thứ tự</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            ) : (
              <tr>
                <th className="py-3 px-4">Kho tổng</th>
                <th className="py-3 px-4">Địa chỉ</th>
                <th className="py-3 px-4">Hotline</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y-2 divide-[#E5E5E5] text-xs font-bold text-[#4B4B4B]">
            {loading && <tr><td colSpan={6} className="py-8 text-center text-[#AFAFAF]">Đang tải...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[#AFAFAF]">Chưa có dữ liệu.</td></tr>}
            {!loading && rows.map((item) => (
              <tr key={item.id} className="hover:bg-[#FDFDFD]">
                {tab === 'goods' ? (
                  <>
                    <td className="py-3 px-4 font-mono font-black text-[#1CB0F6]">{item.code}</td>
                    <td className="py-3 px-4">
                      <p className="font-black">{item.name}</p>
                      {item.description && <p className="text-[11px] text-[#777777]">{item.description}</p>}
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {item.requiresColdStorage && <p className="text-[#1899D6]">❄ Chỉ kho lạnh / kho đông</p>}
                      {item.requiresNote && <p className="text-[#E58800]">✎ Khách phải mô tả hàng</p>}
                      {!item.requiresColdStorage && !item.requiresNote && <p className="text-[#AFAFAF]">Mọi loại kho</p>}
                    </td>
                    <td className="py-3 px-4">{item.sortOrder ?? 0}</td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-4">
                      <p className="font-black">{item.name}</p>
                      {item.note && <p className="text-[11px] text-[#777777]">{item.note}</p>}
                    </td>
                    <td className="py-3 px-4 text-[11px]">{item.address}</td>
                    <td className="py-3 px-4">{item.hotline || '—'}</td>
                  </>
                )}
                <td className="py-3 px-4"><StatusBadge status={item.status} /></td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="inline-flex gap-2">
                    <button onClick={() => openEdit(item)} className="duo-btn-white px-3 py-1.5 text-[11px]">Sửa</button>
                    <button
                      onClick={() => toggleStatus(item)}
                      className={`${item.status === 'ACTIVE' ? 'duo-btn-red' : 'duo-btn-green'} px-3 py-1.5 text-[11px]`}
                    >
                      {item.status === 'ACTIVE' ? 'Ngừng' : 'Mở lại'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="duo-card bg-white w-full max-w-[520px] max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4">
            <h3 className="text-lg font-black text-[#4B4B4B]">
              {editing.id ? `Sửa "${editing.name}"` : tab === 'goods' ? 'Thêm loại hàng' : 'Thêm kho tổng'}
            </h3>

            {tab === 'goods' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Mã *
                  <input className="duo-input text-xs uppercase" value={form.code} maxLength={30} disabled={Boolean(editing.id)}
                    onChange={(e) => setField('code', e.target.value.toUpperCase())} placeholder="VD: BOOKS" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Tên hiển thị *
                  <input className="duo-input text-xs" value={form.name} maxLength={100}
                    onChange={(e) => setField('name', e.target.value)} placeholder="VD: Sách, tài liệu" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B] sm:col-span-2">
                  Mô tả / ví dụ
                  <input className="duo-input text-xs" value={form.description} maxLength={300}
                    onChange={(e) => setField('description', e.target.value)} placeholder="VD: sách vở, hồ sơ giấy" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Thứ tự hiển thị
                  <input type="number" className="duo-input text-xs" value={form.sortOrder}
                    onChange={(e) => setField('sortOrder', e.target.value)} />
                </label>
                <div className="flex flex-col gap-2 justify-end">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B] cursor-pointer">
                    <input type="checkbox" checked={form.requiresColdStorage} onChange={(e) => setField('requiresColdStorage', e.target.checked)} />
                    Chỉ gửi kho lạnh / kho đông
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#4B4B4B] cursor-pointer">
                    <input type="checkbox" checked={form.requiresNote} onChange={(e) => setField('requiresNote', e.target.checked)} />
                    Bắt buộc khách mô tả hàng
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Tên kho tổng *
                  <input className="duo-input text-xs" value={form.name} maxLength={150}
                    onChange={(e) => setField('name', e.target.value)} placeholder="VD: Kho tổng QueenKho Thủ Đức" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Địa chỉ *
                  <input className="duo-input text-xs" value={form.address} maxLength={300}
                    onChange={(e) => setField('address', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Hotline
                  <input className="duo-input text-xs" value={form.hotline} maxLength={11}
                    onChange={(e) => setField('hotline', e.target.value)} placeholder="VD: 0901234567" />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-[#4B4B4B]">
                  Ghi chú
                  <input className="duo-input text-xs" value={form.note} maxLength={300}
                    onChange={(e) => setField('note', e.target.value)} placeholder="VD: giờ nhận hàng 8:00–17:00" />
                </label>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-[#FFDFDF] border border-[#FF4B4B] rounded-xl text-xs font-bold text-[#FF4B4B]">{formError}</div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button onClick={() => setEditing(null)} disabled={saving} className="duo-btn-gray px-4 py-2.5 text-xs">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="duo-btn-green px-5 py-2.5 text-xs">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
