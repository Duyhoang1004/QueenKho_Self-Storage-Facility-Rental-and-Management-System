// utils/incidentTemplates.js
// Cung cấp các mẫu biên bản xử lý sự cố chuẩn hóa theo từng loại sự cố (UC-27 / PR-S5)

export const SUPPORT_ISSUE_LABEL = {
  LOCK_ISSUE: 'Sự cố khóa / Mã PIN (Khẩn)',
  SECURITY: 'An ninh / Đột nhập (Khẩn)',
  FACILITY_DAMAGE: 'Hư hỏng hạ tầng ô kho',
  CLEANING: 'Vệ sinh ô kho / Hành lang',
  OTHER: 'Yêu cầu hỗ trợ khác',
};

export const INCIDENT_REPORT_TEMPLATES = {
  LOCK_ISSUE: [
    {
      id: 'LOCK_PIN_REPLACE',
      label: 'Sự cố pin yếu / Kẹt chốt & Cấp lại mã PIN mới',
      summary: 'Khóa SmartLock pin yếu không nhả chốt cơ, thay pin Panasonic và cấp mã PIN mới.',
      inspection: 'Khóa điện tử SmartLock pin yếu dưới 15%, mô-tơ chốt điện không đủ điện áp nhả chốt. Không có dấu hiệu cạy phá ngoại lực.',
      cause: 'Sụt nguồn bộ 4 pin alkaline sau thời gian sử dụng dài ngày trong môi trường kho.',
      actions: [
        'Kích nguồn khẩn cấp qua cổng phụ và thay mới 04 pin AA Panasonic chính hãng (báo pin 100%).',
        'Cấp lại mã PIN 6 số bảo mật mới cho khách hàng theo đúng quy tắc PR-S6.',
        'Tra dầu bôi trơn ray cửa và cân chỉnh khe hở chốt âm để đóng/mở trơn tru.'
      ],
      conclusion: 'Khách hàng trực tiếp nhập mã PIN mới thử nghiệm đóng/mở 03 lần thành công, cửa khóa chắc chắn, bàn giao lại quyền sử dụng ô kho an toàn.'
    },
    {
      id: 'LOCK_MECHANICAL_JAM',
      label: 'Kẹt chốt cơ học / Tra mỡ bôi trơn ray cửa',
      summary: 'Chốt khóa bị lệch khe do va chạm nhẹ, đã cân chỉnh và bôi trơn.',
      inspection: 'Chốt âm trên khung cửa bị xô lệch 2mm do cửa cuốn hạ lệch tâm, gây kẹt chốt khi khóa điện tử xoay.',
      cause: 'Bụi bẩn bám rãnh ray và khô mỡ bôi trơn cơ học.',
      actions: [
        'Cân chỉnh lại thanh ray cửa cuốn và nắn thẳng chốt định vị khung cửa.',
        'Vệ sinh rãnh khóa, tra mỡ chịu nhiệt bôi trơn bộ truyền động cơ.',
        'Thử tải đóng/mở tự động 05 lần liên tiếp đạt chuẩn kỹ thuật.'
      ],
      conclusion: 'Hệ thống khóa và cửa cuốn vận hành êm ái, khách hàng đã nghiệm thu tại chỗ.'
    }
  ],

  FACILITY_DAMAGE: [
    {
      id: 'FACILITY_LIGHT_DOOR',
      label: 'Hỏng đèn chiếu sáng & Bảo dưỡng ray cửa cuốn',
      summary: 'Thay mới bóng đèn tuýp LED chống ẩm và bảo dưỡng ray dẫn hướng cửa cuốn.',
      inspection: 'Bóng đèn chiếu sáng trước ô kho bị đứt nguồn driver do tăng áp; thanh ray dẫn hướng cửa bị rít.',
      cause: 'Hao mòn linh kiện điện tử thông thường; ray cửa bám bụi sau thời gian sử dụng.',
      actions: [
        'Thay mới bóng đèn LED 1.2m Rạng Đông 18W chống ẩm, thử bật/tắt sáng ổn định.',
        'Vệ sinh rãnh ray cửa cuốn và tra dầu mỡ bôi trơn bảo dưỡng định kỳ.',
        'Kiểm tra độ kín khít đáy cửa chống bụi và côn trùng xâm nhập.'
      ],
      conclusion: 'Hạ tầng ô kho được phục hồi nguyên trạng, ánh sáng đầy đủ, cửa đóng mở an toàn.'
    },
    {
      id: 'FACILITY_WATER_ROOF',
      label: 'Xử lý thấm dột trần & Gia cố chống ẩm',
      summary: 'Kiểm tra hiện trường thấm dột, dán keo chống thấm tạm thời và lên lịch sửa chữa mái.',
      inspection: 'Góc trần thạch cao phía trước ô kho xuất hiện vệt ẩm nhẹ, chưa ảnh hưởng sâu vào tài sản.',
      cause: 'Mối nối ống thoát nước ngưng điều hòa tầng trên bị rò rỉ nhẹ.',
      actions: [
        'Khắc phục tạm thời mối nối ống thoát nước và dán màng keo chống thấm chuyên dụng.',
        'Di chuyển tài sản trong ô sang khu vực khô ráo, che chắn bạt bảo vệ.',
        'Lập phiếu bàn giao cho đội kỹ thuật bảo trì (MAINTENANCE) xử lý triệt để trong 24h.'
      ],
      conclusion: 'Khu vực ô kho đã khô ráo, tài sản được bảo vệ an toàn, tiếp tục theo dõi sát sao.'
    }
  ],

  SECURITY: [
    {
      id: 'SECURITY_PATROL_CAMERA',
      label: 'Kiểm tra an ninh hiện trường, trích xuất camera & Niêm phong',
      summary: 'Đối chiếu camera an ninh, kiểm tra toàn bộ ổ khóa và dán niêm phong bổ sung.',
      inspection: 'Phát hiện vết xước nhẹ trên bề mặt kim loại ốp khóa; chốt khóa cơ và thân khóa hoàn toàn nguyên vẹn.',
      cause: 'Trích xuất camera xác định do xe đẩy hàng vô tình va quẹt khi chuyển đồ qua hành lang, không có hành vi xâm nhập trái phép.',
      actions: [
        'Trích xuất và lưu trữ đoạn clip camera giám sát an ninh hành lang khung giờ liên quan.',
        'Kiểm tra độ chịu lực chốt khóa và thử nghiệm hệ thống cảnh báo cạy cửa.',
        'Bàn giao lại hiện trường cho khách và dán tem niêm phong an ninh bổ sung.'
      ],
      conclusion: 'Xác nhận 100% tài sản trong ô an toàn nguyên vẹn, khách hàng đã xem lại camera và đồng thuận kết luận.'
    }
  ],

  CLEANING: [
    {
      id: 'CLEANING_SPILL_WASTE',
      label: 'Xử lý vệ sinh môi trường, rác thải & Lau khử khuẩn',
      summary: 'Thu gom rác chắn lối đi, lau khô vệt nước tràn và phun khử khuẩn nano bạc.',
      inspection: 'Hành lang trước ô kho có rác bao bì carton và vệt nước ngưng tụ điều hòa gây trơn trượt.',
      cause: 'Khách hàng ô bên cạnh bốc dỡ đồ để lại phế liệu và ống xả máy lạnh bị nghẹt bụi.',
      actions: [
        'Thu gom toàn bộ rác thải về khu vực xử lý phế liệu của cơ sở.',
        'Lau khô sàn gạch và phun xịt dung dịch khử khuẩn Nano bạc chống ẩm mốc.',
        'Thông tắc đường thoát nước ngưng điều hòa khu vực hành lang.'
      ],
      conclusion: 'Mặt bằng hành lang và trước cửa ô khô ráo, sạch sẽ, đạt chuẩn vệ sinh kho dịch vụ cao cấp.'
    }
  ],

  GOODS_DAMAGE: [
    {
      id: 'GOODS_INSPECT_FACILITY',
      label: 'Biên bản kiểm tra thiệt hại hàng hóa do lỗi cơ sở (Chuyển FM thẩm định)',
      summary: 'Kiểm tra thiệt hại tài sản cùng khách, lập danh mục hư hại và chuyển FM bồi thường.',
      inspection: 'Nước ngưng thẩm thấu từ trần làm ướt bao bì và ẩm mốc một số thùng hàng lưu trữ trong ô.',
      cause: 'Lỗi kỹ thuật do cơ sở (FACILITY): Hệ thống làm mát gặp sự cố rò rỉ nước ngưng.',
      actions: [
        'Chụp 06 ảnh hiện trường độ phân giải cao ghi nhận chi tiết mức độ hư hại của từng kiện hàng.',
        'Lập bảng kê chi tiết danh mục hàng hóa bị ảnh hưởng cùng khách hàng.',
        'Chuyển toàn bộ hồ sơ lên Quản lý cơ sở (FM) để thực hiện quy trình thẩm định bồi thường (BR-127).'
      ],
      conclusion: 'Cơ sở nhận trách nhiệm lỗi kỹ thuật, cam kết giải quyết bồi thường thỏa đáng theo đúng gói bảo hiểm hợp đồng.'
    }
  ],

  OTHER: [
    {
      id: 'OTHER_GENERAL_SUPPORT',
      label: 'Biên bản ghi nhận & Giải quyết yêu cầu hỗ trợ chung',
      summary: 'Khảo sát và xử lý thỏa đáng yêu cầu vận hành cho khách hàng.',
      inspection: 'Ghi nhận đầy đủ thông tin yêu cầu thực tế của khách hàng tại cơ sở.',
      cause: 'Yêu cầu phát sinh trong quá trình sử dụng dịch vụ lưu trữ kho.',
      actions: [
        'Trực tiếp hỗ trợ và tư vấn giải pháp tối ưu cho khách hàng.',
        'Kiểm tra lại toàn bộ điều kiện vận hành của ô kho để khách yên tâm sử dụng.',
        'Cung cấp thông tin hotline kỹ thuật 24/7 để hỗ trợ nhanh khi cần.'
      ],
      conclusion: 'Yêu cầu của khách hàng đã được xử lý hoàn tất, khách hàng hài lòng và ký xác nhận.'
    }
  ]
};

// Hàm sinh khung sườn biên bản chuẩn (chỉ điền sẵn thông tin hành chính, để trống các mục cho nhân viên tự ghi theo hiện trường thực tế)
export function buildBlankIncidentReport(task) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ngày ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const unit = task?.storageUnitId || '---';
  const staff = task?.staffName || task?.assignedStaffName || 'Nhân viên cơ sở';
  const rawTicket = task?.ticketCode || (task?.id ? `SR-${task.id}` : '---');
  const ticketCode = String(rawTicket).startsWith('#') ? String(rawTicket).slice(1) : String(rawTicket);

  return `[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]
• Thời gian: ${dateStr} · Ô kho: ${unit}
• Cán bộ xử lý: ${staff} · Phiếu: ${ticketCode}
• Hiện trạng: 
• Nguyên nhân sơ bộ: 
• Biện pháp xử lý kỹ thuật:

• Kết quả nghiệm thu: `;
}

// Hàm sinh đoạn văn bản biên bản mẫu đầy đủ (dùng khi cần demo test nhanh)
export function buildIncidentReportNote(task, template) {
  if (!template) return buildBlankIncidentReport(task);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ngày ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const unit = task?.storageUnitId || 'Ô kho';
  const staff = task?.staffName || task?.assignedStaffName || 'Nhân viên kỹ thuật';
  const rawTicket = task?.ticketCode || (task?.id ? `SR-${task.id}` : '---');
  const ticketCode = String(rawTicket).startsWith('#') ? String(rawTicket).slice(1) : String(rawTicket);

  return `[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]
• Thời gian: ${dateStr} · Ô kho: ${unit}
• Cán bộ xử lý: ${staff} · Phiếu: ${ticketCode}
• Hiện trạng: ${template.inspection}
• Nguyên nhân sơ bộ: ${template.cause}
• Biện pháp xử lý kỹ thuật:
  - ${template.actions.join('\n  - ')}
• Kết quả nghiệm thu: ${template.conclusion}`;
}
