import { useState, useEffect } from 'react';
import { compressImageToDataUrl, createMockEvidenceDataUrl } from '../utils/imageEvidence';
import { uploadImageFile } from '../services/staffTaskService';
import { INCIDENT_REPORT_TEMPLATES, SUPPORT_ISSUE_LABEL, buildIncidentReportNote, buildBlankIncidentReport } from '../utils/incidentTemplates';

const MAX_INCIDENT_PHOTOS = 10; // Đồng bộ tối đa 10 ảnh bằng chứng hiện trường (BR-121)

export default function IncidentReportModal({
  isOpen,
  onClose,
  task,
  resolutionNote,
  evidenceImages = [],
  onUpdateResolutionNote,
  onUpdateImages,
  readOnly = false
}) {
  if (!isOpen || !task) return null;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const currentDateStr = `Ngày ${pad(now.getDate())} tháng ${pad(now.getMonth() + 1)} năm ${now.getFullYear()}`;
  const reportCode = `BB-SC/${now.getFullYear()}/${task.id || '88'}-${task.storageUnitId || 'TB'}`;

  // State chỉnh sửa trực tiếp bên trong biên bản A4
  const [localNote, setLocalNote] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localCustomerName, setLocalCustomerName] = useState('');
  const [localStaffName, setLocalStaffName] = useState('');
  const [localImages, setLocalImages] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Đồng bộ dữ liệu ban đầu khi mở modal
  useEffect(() => {
    if (isOpen && task) {
      setLocalNote(resolutionNote || task.resolutionNote || buildBlankIncidentReport(task));
      setLocalDescription(task.ticketDescription || task.description || 'Khách hàng liên hệ yêu cầu cơ sở hỗ trợ kỹ thuật và kiểm tra hiện trường tại ô kho.');
      setLocalCustomerName(task.customerName || 'Khách hàng QueenKho');
      setLocalStaffName(task.staffName || task.assignedStaffName || 'Nhân viên cơ sở');

      const initialImages = (evidenceImages && evidenceImages.length > 0)
        ? evidenceImages
        : Array.from(new Set([...(task.resolutionImages || []), ...(task.ticketEvidenceImages || [])])).filter(Boolean);
      setLocalImages(initialImages);
      setSelectedTemplateKey('');
      setUploadError('');
    }
  }, [isOpen, task, resolutionNote, evidenceImages]);

  // Khi người dùng gõ sửa nội dung biên bản
  const handleNoteChange = (newText) => {
    setLocalNote(newText);
    if (onUpdateResolutionNote) {
      onUpdateResolutionNote(newText);
    }
  };

  // Áp dụng mẫu biên bản ngay trong modal
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateKey(templateId);
    if (!templateId) return;
    let found = null;
    for (const list of Object.values(INCIDENT_REPORT_TEMPLATES)) {
      found = list.find(t => t.id === templateId);
      if (found) break;
    }
    if (found) {
      const generated = buildIncidentReportNote(task, found);
      setLocalNote(generated);
      if (onUpdateResolutionNote) {
        onUpdateResolutionNote(generated);
      }
    }
  };

  // Thêm ảnh mẫu (demo) ngay trong biên bản
  const handleAddDemoPhoto = () => {
    if (localImages.length >= MAX_INCIDENT_PHOTOS) return;
    const mockUrl = createMockEvidenceDataUrl(
      `Hiện trường xử lý ô ${task?.storageUnitId || ''} lúc ${new Date().toLocaleTimeString('vi-VN')}`,
      'ẢNH HIỆN TRƯỜNG SỰ CỐ'
    );
    const updated = [...localImages, mockUrl].slice(0, MAX_INCIDENT_PHOTOS);
    setLocalImages(updated);
    if (onUpdateImages) {
      onUpdateImages(updated);
    }
  };

  // Tải ảnh từ máy tính / điện thoại ngay trong biên bản
  const handleUploadFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_INCIDENT_PHOTOS - localImages.length);
    if (files.length === 0) return;
    setUploading(true);
    setUploadError('');
    const added = [];
    for (const file of files) {
      try {
        const res = await uploadImageFile(file);
        added.push(res.url);
      } catch {
        try {
          added.push(await compressImageToDataUrl(file));
        } catch (err) {
          setUploadError(err.message || 'Không đọc được file ảnh');
        }
      }
    }
    const updated = [...localImages, ...added].slice(0, MAX_INCIDENT_PHOTOS);
    setLocalImages(updated);
    if (onUpdateImages) {
      onUpdateImages(updated);
    }
    setUploading(false);
    e.target.value = '';
  };

  // Xóa bớt ảnh ngay trong biên bản
  const handleRemoveImage = (indexToRemove) => {
    const updated = localImages.filter((_, idx) => idx !== indexToRemove);
    setLocalImages(updated);
    if (onUpdateImages) {
      onUpdateImages(updated);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    if (!readOnly) {
      if (onUpdateResolutionNote) {
        onUpdateResolutionNote(localNote);
      }
      if (onUpdateImages) {
        onUpdateImages(localImages);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      {/* CSS in ấn chuẩn A4 cô lập hoàn toàn trong modal (không ảnh hưởng file gốc index.css) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-incident-report,
          #printable-incident-report * {
            visibility: visible;
          }
          #printable-incident-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Header Action Bar (Ẩn khi in) */}
        <div className="no-print flex flex-col gap-2.5 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1CB0F6] text-[24px]">description</span>
              <div>
                <h3 className="text-sm font-black uppercase text-[#4B4B4B] flex items-center gap-2">
                  Biên bản xử lý sự cố chuẩn A4
                  {readOnly ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      Biên bản nghiệm thu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Sửa trực tiếp trên biên bản
                    </span>
                  )}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="duo-btn-blue px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[17px]">print</span>
                In biên bản (A4 / PDF)
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="duo-btn-gray px-3.5 py-2 text-xs cursor-pointer"
              >
                {readOnly ? '✕ Đóng' : '✓ Hoàn tất & Đóng'}
              </button>
            </div>
          </div>

          {/* Thanh công cụ chèn khung biên bản & đính kèm ảnh ngay trong modal (Chỉ nhân viên xử lý mới có) */}
          {!readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const skeleton = buildBlankIncidentReport(task);
                    setLocalNote(skeleton);
                    if (onUpdateResolutionNote) {
                      onUpdateResolutionNote(skeleton);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#006699] hover:bg-[#E0F2FE] text-[11px] font-black text-[#006699] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="Chèn khung sườn biên bản chuẩn để nhân viên tự điền"
                >
                  <span className="material-symbols-outlined text-[15px]">edit_note</span>
                  + Chèn khung biên bản (tự điền)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const sampleTemplate = (task?.issueType && INCIDENT_REPORT_TEMPLATES[task.issueType]?.[0]) || INCIDENT_REPORT_TEMPLATES.OTHER[0];
                    const sampleNote = buildIncidentReportNote(task, sampleTemplate);
                    setLocalNote(sampleNote);
                    if (onUpdateResolutionNote) {
                      onUpdateResolutionNote(sampleNote);
                    }
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-blue-700 hover:underline cursor-pointer"
                  title="Điền dữ liệu mẫu đầy đủ để demo nhanh khi cần"
                >
                  (Hoặc điền mẫu demo)
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddDemoPhoto}
                  disabled={localImages.length >= MAX_INCIDENT_PHOTOS}
                  className={`px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 hover:bg-amber-100 text-[11px] font-bold text-amber-800 flex items-center gap-1 transition-colors ${localImages.length >= MAX_INCIDENT_PHOTOS ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                  title="Thêm ảnh hiện trường mẫu"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-600">add_photo_alternate</span>
                  + Ảnh mẫu (demo)
                </button>
                <label className={`px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-300 hover:bg-blue-100 text-[11px] font-bold text-blue-800 flex items-center gap-1 transition-colors ${uploading || localImages.length >= MAX_INCIDENT_PHOTOS ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                  <span className="material-symbols-outlined text-[15px] text-blue-600">
                    {uploading ? 'hourglass_top' : 'upload_file'}
                  </span>
                  {uploading ? 'Đang tải...' : '+ Tải ảnh lên'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={handleUploadFiles}
                  />
                </label>
              </div>
            </div>
          )}
          {uploadError && <p className="text-[11px] font-bold text-red-600">{uploadError}</p>}
        </div>

        {/* Nội dung trang giấy A4 (In ấn & Chỉnh sửa trực tiếp) */}
        <div className="p-6 sm:p-10 overflow-y-auto text-slate-800 print:overflow-visible print:p-8" id="printable-incident-report">
          
          {/* Header công ty & Số hiệu */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm">
                  Q
                </div>
                <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-slate-900">
                  CÔNG TY CỔ PHẦN KHO TỰ QUẢN QUEENKHO
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-600 uppercase">
                CƠ SỞ: {task.facilityName || 'QUEENKHO TÂN BÌNH — TP. HỒ CHÍ MINH'}
              </p>
              <p className="text-[10px] text-slate-500">
                Hệ thống lưu trữ tự quản thông minh 24/7 · Hotline: 1900 6868
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-black tracking-wide text-slate-900">
                SỐ: {reportCode}
              </p>
              <p className="text-[10px] text-slate-500 italic">
                {currentDateStr}
              </p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                task.urgent ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {task.urgent ? 'MỨC ĐỘ: KHẨN CẤP' : 'MỨC ĐỘ: TIÊU CHUẨN'}
              </span>
            </div>
          </div>

          {/* Tiêu đề biên bản */}
          <div className="text-center my-6">
            <h1 className="text-lg sm:text-2xl font-black uppercase text-slate-900 tracking-wide mb-1">
              BIÊN BẢN XỬ LÝ SỰ CỐ &amp; KIỂM TRA HIỆN TRƯỜNG
            </h1>
            <p className="text-xs font-semibold text-slate-500 italic">
              (Căn cứ theo Quy trình Vận hành kỹ thuật &amp; Quản lý chất lượng dịch vụ QueenKho UC-27 / PR-S5)
            </p>
          </div>

          {/* Phần I: Thông tin chung & Thành phần tham gia */}
          <div className="mb-5">
            <h2 className="text-xs font-black uppercase text-blue-900 bg-blue-50 py-1 px-2.5 rounded border-l-4 border-blue-600 mb-2">
              I. THÔNG TIN CHUNG &amp; THÀNH PHẦN THAM GIA
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <p><span className="font-bold text-slate-600">Mã phiếu hỗ trợ:</span> <span className="font-mono font-bold text-blue-700">{task.ticketCode || ('#SR-' + task.id)}</span></p>
              <p><span className="font-bold text-slate-600">Mã hợp đồng thuê:</span> <span className="font-mono font-bold">{task.contractCode || '---'}</span></p>
              <p><span className="font-bold text-slate-600">Vị trí ô kho:</span> <span className="font-black text-slate-900">{task.storageUnitId || '---'}</span></p>
              <p><span className="font-bold text-slate-600">Loại ô kho:</span> <span>{task.unitTypeName || 'Kho Tiêu Chuẩn (Nhiệt độ thường)'}</span></p>
              
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 shrink-0">Đại diện khách hàng:</span>
                <span className={`${readOnly ? 'inline' : 'hidden print:inline'} font-bold text-slate-900`}>
                  {localCustomerName} {task.customerPhone ? `(${task.customerPhone})` : ''}
                </span>
                {!readOnly && (
                  <input
                    type="text"
                    value={localCustomerName}
                    onChange={(e) => setLocalCustomerName(e.target.value)}
                    className="no-print font-bold text-slate-900 bg-slate-50 hover:bg-white focus:bg-white border-b border-dashed border-slate-300 focus:border-blue-500 px-1 py-0.5 rounded text-xs flex-1 min-w-0 outline-none"
                    title="Nhấp để sửa tên khách hàng"
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 shrink-0">Nhân viên xử lý:</span>
                <span className={`${readOnly ? 'inline' : 'hidden print:inline'} font-bold text-slate-900`}>
                  {localStaffName} (Mã NV: NV-{task.staffId || task.assignedStaffId || '01'})
                </span>
                {!readOnly && (
                  <input
                    type="text"
                    value={localStaffName}
                    onChange={(e) => setLocalStaffName(e.target.value)}
                    className="no-print font-bold text-slate-900 bg-slate-50 hover:bg-white focus:bg-white border-b border-dashed border-slate-300 focus:border-blue-500 px-1 py-0.5 rounded text-xs flex-1 min-w-0 outline-none"
                    title="Nhấp để sửa tên nhân viên"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Phần II: Nội dung sự cố tiếp nhận */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-black uppercase text-blue-900 bg-blue-50 py-1 px-2.5 rounded border-l-4 border-blue-600">
                II. NỘI DUNG SỰ CỐ TIẾP NHẬN TỪ KHÁCH HÀNG
              </h2>
              {!readOnly && <span className="no-print text-[10px] text-slate-400 italic">Nhấp vào để sửa</span>}
            </div>
            {/* Khi in hoặc ở chế độ readOnly cho khách hàng */}
            <div className={`${readOnly ? 'block' : 'hidden print:block'} bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs leading-relaxed`}>
              <p className="font-semibold text-slate-700 italic">
                "{localDescription}"
              </p>
            </div>
            {/* Khi xem màn hình ở vai trò nhân viên (sửa trực tiếp) */}
            {!readOnly && (
              <textarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                rows={2}
                className="no-print w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-white focus:bg-white text-xs font-semibold text-slate-700 italic focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Nhập nội dung sự cố phản ánh từ khách..."
              />
            )}
          </div>

          {/* Phần III: Kết quả kiểm tra & Biện pháp xử lý (Soạn thảo trực tiếp) */}
          <div className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <h2 className="text-xs font-black uppercase text-blue-900 bg-blue-50 py-1 px-2.5 rounded border-l-4 border-blue-600">
                III. BIÊN BẢN XỬ LÝ KỸ THUẬT &amp; KẾT QUẢ NGHIỆM THU TẠI CHỖ
              </h2>
              {!readOnly && (
                <span className="no-print text-[11px] text-blue-700 font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">edit_note</span>
                  Gõ sửa trực tiếp nội dung dưới đây:
                </span>
              )}
            </div>

            {/* Bản hiển thị chuẩn khi in ra giấy A4 hoặc khi khách hàng xem */}
            <div className={`${readOnly ? 'block' : 'hidden print:block'} bg-white p-3.5 rounded-lg border border-slate-300 text-xs leading-relaxed whitespace-pre-line text-slate-800 font-medium`}>
              {localNote}
            </div>

            {/* Ô soạn thảo trực tiếp trên màn hình cho nhân viên */}
            {!readOnly && (
              <div className="no-print relative">
                <textarea
                  value={localNote}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  rows={9}
                  className="w-full p-3.5 rounded-xl border-2 border-dashed border-blue-400 focus:border-blue-600 bg-blue-50/20 focus:bg-white text-xs leading-relaxed text-slate-800 font-medium font-sans focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-inner"
                  placeholder="Nhập hoặc chỉnh sửa chi tiết các bước kiểm tra, nguyên nhân và biện pháp khắc phục sự cố tại đây..."
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 px-1">
                  <span className="italic text-emerald-700 font-bold">
                    ✓ Nội dung gõ ở đây sẽ tự động đồng bộ ra form xử lý bên ngoài
                  </span>
                  <span>{localNote.length}/1000 ký tự</span>
                </div>
              </div>
            )}
          </div>

          {/* Phần IV: Ảnh bằng chứng hiện trường */}
          <div className="mb-5 print:break-inside-avoid">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-black uppercase text-blue-900 bg-blue-50 py-1 px-2.5 rounded border-l-4 border-blue-600">
                IV. HÌNH ẢNH BẰNG CHỨNG HIỆN TRƯỜNG ({localImages.length}/{MAX_INCIDENT_PHOTOS} ảnh)
              </h2>
              {!readOnly && (
                <div className="no-print flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddDemoPhoto}
                    disabled={localImages.length >= MAX_INCIDENT_PHOTOS}
                    className={`text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-0.5 ${localImages.length >= MAX_INCIDENT_PHOTOS ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                    + Thêm ảnh mẫu
                  </button>
                </div>
              )}
            </div>

            {localImages.length === 0 ? (
              <div className="no-print p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                {readOnly ? 'Chưa có ảnh bằng chứng hiện trường đính kèm.' : 'Chưa có ảnh hiện trường. Bạn có thể bấm "+ Thêm ảnh mẫu" hoặc bấm nút "+ Tải ảnh lên" ở thanh công cụ phía trên (tối đa 10 ảnh).'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 print:grid-cols-5 print:gap-1.5">
                {localImages.map((src, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center shadow-xs">
                    <img src={src} alt={`Hiện trường ${idx + 1}`} className="w-full h-full object-cover" />
                    
                    {/* Nút xóa ảnh trực tiếp trong biên bản (Chỉ nhân viên mới thấy khi sửa) */}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="no-print absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110"
                        title="Xóa ảnh này khỏi biên bản"
                        aria-label="Xóa ảnh"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}

                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold py-0.5 text-center">
                      Ảnh #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phần V: Cam kết & Chữ ký hai bên */}
          <div className="pt-4 mt-6 border-t-2 border-slate-300 print:break-inside-avoid">
            <p className="text-[11px] text-slate-500 italic mb-6 text-center">
              Biên bản này được lập thành 02 bản có giá trị pháp lý như nhau, lưu vào hồ sơ quản trị số hóa của hệ thống QueenKho để đối soát khi cần thiết.
            </p>
            <div className="grid grid-cols-2 gap-8 text-center">
              <div>
                <p className="text-xs font-black uppercase text-slate-800">ĐẠI DIỆN KHÁCH HÀNG</p>
                <p className="text-[10px] text-slate-500 italic mb-10">(Ký, ghi rõ họ tên &amp; xác nhận hài lòng)</p>
                <p className="font-serif italic text-lg text-blue-900 font-black tracking-wider">
                  {localCustomerName ? localCustomerName.trim().split(' ').slice(-1)[0] : 'Khach'}
                </p>
                <p className="text-xs font-bold text-slate-800 mt-1">{localCustomerName || 'Khách hàng'}</p>
              </div>
              <div className="relative">
                <p className="text-xs font-black uppercase text-slate-800">NHÂN VIÊN XỬ LÝ CƠ SỞ</p>
                <p className="text-[10px] text-slate-500 italic mb-10">(Ký, ghi rõ họ tên &amp; mã nhân viên)</p>
                <p className="font-serif italic text-lg text-blue-900 font-black tracking-wider">
                  {localStaffName ? localStaffName.trim().split(' ').slice(-1)[0] : 'NhanVien'}
                </p>
                <p className="text-xs font-bold text-slate-800 mt-1">{localStaffName || 'Nhân viên cơ sở'} (NV-{task.staffId || task.assignedStaffId || '01'})</p>

                {/* Dấu mộc đỏ tượng trưng của QueenKho */}
                <div className="absolute top-4 right-2 sm:right-6 w-20 h-20 sm:w-24 sm:h-24 border-2 border-red-600 rounded-full flex flex-col items-center justify-center text-red-600 font-bold opacity-80 rotate-[-12deg] pointer-events-none select-none">
                  <span className="text-[7px] sm:text-[8px] uppercase tracking-tighter">CÔNG TY CP QUEENKHO</span>
                  <span className="text-[9px] sm:text-[10px] font-black my-0.5">★ ĐÃ XỬ LÝ ★</span>
                  <span className="text-[6px] sm:text-[7px]">CƠ SỞ {task.facilityName?.toUpperCase() || 'TÂN BÌNH'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}