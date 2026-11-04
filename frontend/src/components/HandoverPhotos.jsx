import { useState } from 'react'
import { uploadImageFile } from '../services/staffTaskService'
import { compressImageToDataUrl, createMockEvidenceDataUrl } from '../utils/imageEvidence'

// BR-121: ảnh hiện trạng ô lúc nhận kho / trả kho — căn cứ biết hư hỏng do ai khi có tranh chấp
export const MAX_HANDOVER_PHOTOS = 10

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function PhotoPreview({ src, onClose }) {
  if (!src) return null
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div onClick={e => e.stopPropagation()} className="duo-card max-w-2xl w-full p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-[#4B4B4B] flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">image</span>
            Ảnh hiện trạng ô kho
          </span>
          <button type="button" onClick={onClose} className="duo-btn-gray px-3 py-1 text-xs">Đóng</button>
        </div>
        <div className="rounded-xl overflow-hidden bg-[#F7F7F7] flex items-center justify-center max-h-[70vh]">
          <img src={src} alt="Ảnh hiện trạng" className="max-w-full max-h-[70vh] object-contain" />
        </div>
      </div>
    </div>
  )
}

// Lưới ảnh nhỏ, bấm để phóng to
export function PhotoGrid({ images, onRemove }) {
  const [preview, setPreview] = useState(null)
  if (!images || images.length === 0) return null
  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {images.map((src, idx) => (
          <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-[#E5E5E5] bg-[#F7F7F7]">
            <button type="button" onClick={() => setPreview(src)} className="w-full h-full cursor-zoom-in">
              <img src={src} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#FF4B4B] text-white flex items-center justify-center shadow"
                aria-label="Xoá ảnh"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <PhotoPreview src={preview} onClose={() => setPreview(null)} />
    </>
  )
}

// Ô chọn ảnh: tải lên server, lỗi thì nén thành data URL lưu thẳng (giống ảnh sự cố UC-24)
export function HandoverPhotoPicker({ images, onChange, label, hint, mockLabel, required = true }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const addFiles = async fileList => {
    const files = Array.from(fileList || []).slice(0, MAX_HANDOVER_PHOTOS - images.length)
    if (files.length === 0) return
    setUploading(true)
    setError('')
    const added = []
    for (const file of files) {
      try {
        const res = await uploadImageFile(file)
        added.push(res.url)
      } catch {
        try {
          added.push(await compressImageToDataUrl(file))
        } catch (e) {
          setError(e.message || 'Không đọc được ảnh')
        }
      }
    }
    onChange([...images, ...added])
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase text-[#AFAFAF]">
          {label}{required ? ' *' : ''} ({images.length}/{MAX_HANDOVER_PHOTOS})
        </span>
        <div className="flex items-center gap-2">
          {mockLabel && (
            <button
              type="button"
              onClick={() => onChange([...images, createMockEvidenceDataUrl(mockLabel, 'ẢNH HIỆN TRẠNG Ô KHO')].slice(0, MAX_HANDOVER_PHOTOS))}
              className="text-[11px] font-black text-[#FF9600] hover:underline cursor-pointer"
            >
              + Ảnh mẫu (demo)
            </button>
          )}
          <label className={`duo-btn-white px-3 py-1.5 text-xs gap-1 ${uploading || images.length >= MAX_HANDOVER_PHOTOS ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
            <span className="material-symbols-outlined text-[16px] text-[#1CB0F6]">{uploading ? 'hourglass_top' : 'add_a_photo'}</span>
            {uploading ? 'Đang tải...' : 'Chụp / tải ảnh'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = '' }}
            />
          </label>
        </div>
      </div>
      {hint && <p className="text-[11px] font-bold text-[#AFAFAF]">{hint}</p>}
      {images.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E5E5E5] px-4 py-5 text-center text-[11px] font-bold text-[#AFAFAF]">
          Chưa có ảnh nào{required ? ' — bắt buộc ít nhất 1 ảnh' : ''}
        </div>
      ) : (
        <PhotoGrid images={images} onRemove={idx => onChange(images.filter((_, i) => i !== idx))} />
      )}
      {error && <p className="text-[11px] font-bold text-[#FF4B4B]">{error}</p>}
    </div>
  )
}

const CHECK_LABELS = [
  { key: 'identityVerified', label: 'Xác minh CCCD' },
  { key: 'unitEmpty', label: 'Ô trống' },
  { key: 'unitClean', label: 'Ô sạch' },
  { key: 'lockIntact', label: 'Khoá nguyên vẹn' },
  { key: 'customerSignatureConfirmed', label: 'Khách xác nhận' },
]

// Danh sách biên bản nhận / trả kho của 1 hợp đồng (khách xem lại, FM đối chiếu khi có tranh chấp)
export function HandoverRecordList({ records }) {
  if (!records || records.length === 0) {
    return <p className="text-xs font-bold text-[#AFAFAF]">Chưa có biên bản bàn giao nào.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map(r => (
        <div key={r.id} className="rounded-2xl border-2 border-[#E5E5E5] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-[#4B4B4B]">
              <span className={`material-symbols-outlined text-[20px] ${r.recordType === 'CHECK_IN' ? 'text-[#58CC02]' : 'text-[#1CB0F6]'}`}>
                {r.recordType === 'CHECK_IN' ? 'login' : 'logout'}
              </span>
              {r.recordType === 'CHECK_IN' ? 'Biên bản nhận kho' : 'Biên bản trả kho'}
              {r.checkInMethod === 'ONLINE' && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#DDF4FF] text-[#1899D6]">Check-in online</span>
              )}
            </span>
            <span className="text-[11px] font-bold text-[#AFAFAF]">#{r.id} · {formatDateTime(r.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CHECK_LABELS.map(c => (
              <span key={c.key} className="flex items-center gap-1 text-[11px] font-bold text-[#4B4B4B]">
                <span className={`material-symbols-outlined text-[16px] ${r[c.key] ? 'text-[#58CC02]' : 'text-[#FF4B4B]'}`}>
                  {r[c.key] ? 'check_circle' : 'cancel'}
                </span>
                {c.label}
              </span>
            ))}
          </div>
          <p className="text-[11px] font-bold text-[#777777]">
            <span className="font-black text-[#AFAFAF] uppercase mr-1">Người lập:</span>{r.staffName}
          </p>
          {r.notes && <p className="text-[11px] font-bold text-[#777777] whitespace-pre-line">{r.notes}</p>}
          {r.evidenceImages && r.evidenceImages.length > 0 ? (
            <PhotoGrid images={r.evidenceImages} />
          ) : (
            <p className="text-[11px] font-bold text-[#AFAFAF]">Biên bản lập trước khi bắt buộc chụp ảnh (không có ảnh).</p>
          )}
        </div>
      ))}
    </div>
  )
}
