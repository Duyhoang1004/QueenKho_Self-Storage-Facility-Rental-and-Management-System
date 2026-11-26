// utils/incidentTemplates.js
// Cung cấp các mẫu biên bản xử lý sự cố chuẩn hóa theo từng loại sự cố & từng mục lựa chọn cụ thể (UC-27 / PR-S5)

export const SUPPORT_ISSUE_LABEL = {
  LOCK_ISSUE: 'Sự cố khóa / Mã PIN (Khẩn)',
  SECURITY: 'An ninh / Đột nhập (Khẩn)',
  FACILITY_DAMAGE: 'Hư hỏng hạ tầng ô kho',
  CLEANING: 'Vệ sinh ô kho / Hành lang',
  OTHER: 'Yêu cầu hỗ trợ khác',
  GOODS_DAMAGE: 'Hàng bị hư hỏng (Bồi thường)',
  GOODS_LOSS: 'Mất hàng (Bồi thường)',
};

export const INCIDENT_REPORT_TEMPLATES = {
  // ==================== 1. HƯ HỎNG CƠ SỞ VẬT CHẤT (FACILITY_DAMAGE) ====================
  FACILITY_DAMAGE: [
    {
      id: 'FACILITY_VENTILATION',
      matchKeys: ['thông gió', 'quạt gió', 'hút mùi', 'kêu to', 'rung lắc'],
      subCategory: 'Hệ thống thông gió / quạt gió kêu to',
      label: 'Hệ thống thông gió / Quạt gió kêu to & rung lắc',
      summary: 'Vệ sinh cánh quạt thông gió, tra dầu mỡ bạc đạn và siết ốc giảm chấn chống rung.',
      inspection: 'Quạt thông gió trần trước khu vực ô kho phát tiếng kêu rít cơ học, rung lắc nhẹ khi khởi động.',
      cause: 'Trục bạc đạn quạt thông gió bị khô mỡ bôi trơn sau thời gian vận hành liên tục; cánh quạt bám bụi dày.',
      actions: [
        'Ngắt aptomat nguồn điện an toàn, tháo lồng bảo vệ và vệ sinh sạch bụi bẩn trên cánh quạt thông gió.',
        'Bổ sung mỡ chịu nhiệt bôi trơn trục bạc đạn và siết chặt toàn bộ ốc giảm chấn giá treo quạt.',
        'Đóng điện vận hành thử tải 15 phút: tiếng ồn giảm về mức dưới 45dB, quạt hút gió êm ái, thông thoáng.'
      ],
      conclusion: 'Hệ thống thông gió khu vực ô kho hoạt động ổn định, độ ồn đạt tiêu chuẩn quy định, bàn giao hiện trường an toàn.',
      presets: [
        'Đã bảo dưỡng, tra dầu mỡ bạc đạn và cân chỉnh quạt thông gió chạy êm ái, hết tiếng ồn rung lắc.',
        'Đã kiểm tra hệ thống thông gió, siết lại ốc giảm chấn giá treo và vệ sinh cánh quạt thông thoáng.',
      ]
    },
    {
      id: 'FACILITY_LIGHTING',
      matchKeys: ['đèn', 'chiếu sáng', 'cháy', 'chập', 'tắt', 'bóng đèn'],
      subCategory: 'Đèn chiếu sáng bị cháy / chập',
      label: 'Đèn chiếu sáng bị cháy / chập điện',
      summary: 'Thay mới bóng đèn LED 1.2m Rạng Đông 18W chống ẩm và kiểm tra nguồn cấp.',
      inspection: 'Bóng đèn LED chiếu sáng trước cửa ô kho không sáng, kiểm tra thấy driver cấp nguồn bị chập đứt mạch.',
      cause: 'Hao mòn linh kiện điện tử do biến động điện áp lưới điện cục bộ.',
      actions: [
        'Ngắt nguồn chiếu sáng dãy kho, tháo dỡ bóng đèn và bộ nguồn chập cháy.',
        'Lắp đặt mới bộ đèn tuýp LED chống ẩm 18W chính hãng Rạng Đông.',
        'Kiểm tra tiếp địa an toàn và đo điện áp cấp 220V ổn định.'
      ],
      conclusion: 'Khu vực trước ô kho đủ ánh sáng phục vụ bốc dỡ hàng, an toàn điện tuyệt đối, bàn giao hiện trường sạch sẽ.',
      presets: [
        'Đã thay mới bóng đèn LED 1.2m Rạng Đông 18W chống ẩm trước ô kho, thử bật/tắt hoạt động tốt.',
        'Đã kiểm tra đường dây nguồn chiếu sáng và thay tăng phô (driver) đèn, ánh sáng ổn định đầy đủ.',
      ]
    },
    {
      id: 'FACILITY_ROLLING_DOOR',
      matchKeys: ['cửa cuốn', 'kẹt', 'khó kéo', 'ray cửa', 'lệch ray'],
      subCategory: 'Cửa cuốn bị kẹt / khó kéo',
      label: 'Cửa cuốn bị kẹt / Khó kéo / Lệch ray',
      summary: 'Cân chỉnh thanh ray, nắn thẳng lá đáy cửa cuốn và tra dầu mỡ bôi trơn chuyên dụng.',
      inspection: 'Cửa cuốn kim loại của ô kho bị kẹt ở độ cao 50cm, kéo lên hạ xuống rất nặng tay và phát tiếng kêu lớn.',
      cause: 'Rãnh ray dẫn hướng hai bên bị bám bụi bẩn khô mỡ lâu ngày và thanh đáy cửa bị xô lệch 2mm khi bốc dỡ đồ.',
      actions: [
        'Cạo sạch cặn bẩn trong lòng ray dẫn hướng, nắn thẳng thanh đáy cửa cuốn.',
        'Xịt dung dịch vệ sinh kim loại và tra mỡ bôi trơn chịu nhiệt cao cấp vào trục lò xo và rãnh ray.',
        'Thử nghiệm thao tác đóng/mở cửa cuốn 05 lần liên tiếp đạt chuẩn kỹ thuật.'
      ],
      conclusion: 'Cửa cuốn vận hành nhẹ nhàng, kéo thả êm ái, khóa chốt đáy đóng khít hoàn toàn.',
      presets: [
        'Đã vệ sinh rãnh ray và tra dầu mỡ bôi trơn chuyên dụng cho cửa cuốn, cửa kéo lên hạ xuống nhẹ nhàng.',
        'Đã cân chỉnh lá đáy cửa cuốn bị lệch ray và thử kéo thả 5 lần trơn tru, không còn tiếng kêu rít.',
      ]
    },
    {
      id: 'FACILITY_WATER_LEAK',
      matchKeys: ['mái dột', 'thấm', 'trần', 'nước', 'ẩm mốc', 'vách nứt'],
      subCategory: 'Mái dột / trần thấm nước / vách nứt',
      label: 'Xử lý thấm dột trần & Gia cố chống ẩm',
      summary: 'Gia cố mối nối ống nước ngưng điều hòa, dán keo chống thấm và che bạt bảo vệ tài sản.',
      inspection: 'Trần thạch cao phía trước ô kho xuất hiện vệt ẩm nhẹ, đọng giọt nước nhỏ xuống sàn lối đi.',
      cause: 'Mối nối ống thoát nước ngưng điều hòa trung tâm tầng trên bị lỏng gioăng cao su do rung chấn.',
      actions: [
        'Gia cố siết chặt khớp nối ống thoát nước ngưng và quấn băng keo cao su non chống rò rỉ.',
        'Lau khô sàn bê tông, dán màng keo chống thấm ngăn nước tràn vào ô kho.',
        'Kiểm tra hiện trạng tài sản trong ô: không bị ảnh hưởng, che phủ bạt nilon bảo hộ an toàn.'
      ],
      conclusion: 'Khu vực ô kho đã khô ráo, tài sản được bảo vệ an toàn, không còn nguy cơ thấm nước.',
      presets: [
        'Đã kiểm tra hiện trường thấm dột, dán keo chống thấm tạm thời và che bạt bảo vệ tài sản an toàn.',
        'Đã xử lý mối nối thoát nước điều hòa bị rò rỉ, khu vực trước ô kho đã khô ráo hoàn toàn.',
      ]
    },
    {
      id: 'FACILITY_ELECTRICAL',
      matchKeys: ['ổ cắm', 'công tắc', 'mất điện', 'chập chờn', 'điện'],
      subCategory: 'Ổ cắm điện / công tắc chập chờn',
      label: 'Khắc phục ổ cắm điện & Công tắc chập chờn',
      summary: 'Thay mới cụm ổ cắm Panasonic chống cháy và siết chặt đầu cos tiếp xúc nguồn.',
      inspection: 'Ổ cắm điện đa năng trước cửa ô kho tiếp xúc kém, công tắc đèn có hiện tượng đánh tia lửa nhẹ khi bật.',
      cause: 'Tiếp điểm đồng của ổ cắm bị giãn sau thời gian cắm rút thiết bị công suất cao.',
      actions: [
        'Cắt cầu dao điện an toàn, tháo dỡ cụm ổ cắm và công tắc cũ.',
        'Thay mới cụm ổ cắm - công tắc chuẩn âm tường chống cháy Panasonic 16A.',
        'Dùng đồng hồ VOM đo kiểm tra thông mạch, điện áp 220V ổn định, không có dòng rò.'
      ],
      conclusion: 'Hệ thống điện vận hành an toàn tuyệt đối, cấp nguồn ổn định phục vụ khách hàng.',
      presets: [
        'Đã kiểm tra và siết lại đầu cos dây nguồn ổ cắm điện, thử tải cấp điện ổn định an toàn.',
        'Đã thay mới mặt công tắc điện chống giật trước ô kho, thử bật tắt nhạy và an toàn.',
      ]
    }
  ],

  // ==================== 2. SỰ CỐ KHÓA & MÃ PIN (LOCK_ISSUE) ====================
  LOCK_ISSUE: [
    {
      id: 'LOCK_FORGOT_PIN',
      matchKeys: ['quên mã pin', 'đổi pin', 'cấp lại pin', 'quên pin'],
      subCategory: 'Quên mã PIN SmartLock',
      label: 'Xác minh chính chủ & Cấp lại mã PIN SmartLock mới',
      summary: 'Xác minh thông tin CCCD chính chủ hợp đồng và cấp mã PIN 6 số bảo mật mới (PR-S6).',
      inspection: 'Khách hàng liên hệ yêu cầu mở ô kho do quên mã PIN SmartLock sau thời gian dài không ra vào.',
      cause: 'Khách hàng không nhớ mã PIN cũ sau thời gian dài không thao tác mở ô kho.',
      actions: [
        'Đối chiếu CCCD và hợp đồng thuê kho còn hiệu lực của khách hàng theo đúng quy trình PR-S6.',
        'Kích hoạt lệnh cấp lại mã PIN ngẫu nhiên 6 số trên hệ thống máy chủ QueenKho.',
        'Hướng dẫn khách hàng nhập mã PIN mới trực tiếp tại bàn phím SmartLock, thử mở cửa thành công 02 lần.'
      ],
      conclusion: 'Khách hàng đã ghi nhớ mã PIN mới, bảo mật thông tin, bàn giao lại quyền truy cập ô kho an toàn.',
      presets: [
        'Đã xác minh thông tin chính chủ hợp đồng và cấp lại mã PIN 6 số bảo mật mới cho khách hàng.',
        'Đã hỗ trợ khách hàng đổi mã PIN mới trực tiếp tại bàn phím khóa ô kho thành công.',
      ]
    },
    {
      id: 'LOCK_DEAD_BATTERY',
      matchKeys: ['hết pin', 'không nhận mã', 'không sáng', 'yếu pin'],
      subCategory: 'Khóa không nhận mã / Hết pin',
      label: 'Kích nguồn khẩn cấp & Thay pin khóa SmartLock',
      summary: 'Kích nguồn qua cổng phụ Type-C, thay 04 pin AA Panasonic chính hãng và kiểm tra chốt cơ.',
      inspection: 'Bàn phím SmartLock không sáng đèn khi chạm tay, không phản hồi tiếng bíp, pin yếu dưới 10%.',
      cause: 'Bộ 4 pin alkaline sụt nguồn sau thời gian dài vận hành trong môi trường kho.',
      actions: [
        'Cấp nguồn dự phòng 5V qua cổng phụ mặt dưới thân khóa để mở cửa khẩn cấp.',
        'Tháo nắp pin bên trong ô kho, thay mới trọn bộ 04 pin AA Panasonic Alkaline chính hãng.',
        'Đo điện áp đạt 6.2V, kiểm tra cảm biến chạm và chốt âm khóa mở dứt khoát.'
      ],
      conclusion: 'Khóa điện tử hoạt động hoàn hảo, đèn bàn phím sáng rõ, khách thử nghiệm mở khóa thành công.',
      presets: [
        'Đã kích nguồn khẩn cấp qua cổng Type-C và thay mới 4 pin AA Panasonic chính hãng cho khóa SmartLock.',
        'Đã kiểm tra SmartLock, đèn led bàn phím sáng rõ, pin báo 100%, khách mở kho thành công.',
      ]
    },
    {
      id: 'LOCK_JAMMED_KEYPAD',
      matchKeys: ['kẹt phím', 'liệt phím', 'bàn phím số'],
      subCategory: 'Bàn phím số bị kẹt',
      label: 'Vệ sinh tiếp điểm & Cân chỉnh bàn phím số SmartLock',
      summary: 'Vệ sinh cặn bẩn bề mặt phím số, nắn chỉnh lò xo đàn hồi phím bấm.',
      inspection: 'Phím số 3 và 7 trên mặt khóa bị rít, bấm phải dùng lực mạnh mới nhận mã.',
      cause: 'Bụi bẩn tích tụ kẽ phím và khô lò xo đàn hồi sau thời gian dài.',
      actions: [
        'Tháo mặt che bàn phím, vệ sinh sạch cặn bụi bám quanh các phím số bằng cồn y tế.',
        'Bôi trơn đệm cao su vi mạch và cân chỉnh lực nảy lò xo phím bấm.',
        'Thử nhập liên tục các tổ hợp phím số 0-9 phản hồi nhạy bén 100%.'
      ],
      conclusion: 'Bàn phím cảm ứng SmartLock nhận lệnh nhạy bén, các phím bấm êm tay, hoạt động tốt.',
      presets: [
        'Đã vệ sinh bề mặt bàn phím cảm ứng và căn chỉnh lẫy phím số, các phím bấm nhạy bén trở lại.',
      ]
    },
    {
      id: 'LOCK_RFID_ERROR',
      matchKeys: ['thẻ từ', 'rfid', 'không nhận thẻ'],
      subCategory: 'Lỗi thẻ từ RFID',
      label: 'Nạp lại mã thẻ từ RFID & Kích hoạt thẻ mới',
      summary: 'Xóa mã thẻ lỗi trong bộ nhớ khóa SmartLock và nạp mã thẻ từ RFID bảo mật mới.',
      inspection: 'Đầu đọc thẻ RFID trên khóa báo đèn đỏ khi quẹt thẻ của khách hàng.',
      cause: 'Dải từ tính của thẻ bị suy giảm tín hiệu do va đập kim loại hoặc nhiễm từ.',
      actions: [
        'Đọc lại mã chip RFID, xóa mã thẻ cũ trong bộ nhớ điều khiển khóa ô kho.',
        'Nạp và mã hóa lại thẻ từ RFID mới trên phần mềm quản trị cơ sở.',
        'Thử quẹt thẻ 03 lần tại khóa ô kho: đèn xanh báo mở chốt ngay lập tức.'
      ],
      conclusion: 'Thẻ từ RFID mới nhận diện chuẩn xác 100%, bàn giao thẻ cho khách hàng sử dụng an toàn.',
      presets: [
        'Đã nạp lại mã thẻ từ RFID vào đầu đọc SmartLock ô kho, quẹt thẻ nhận ngay.',
        'Đã cấp đổi thẻ từ RFID mới cho khách hàng do thẻ cũ bị trầy xước chip từ.',
      ]
    }
  ],

  // ==================== 3. AN NINH / CẢNH BÁO KHẨN (SECURITY) ====================
  SECURITY: [
    {
      id: 'SECURITY_TAMPER_EVIDENCE',
      matchKeys: ['cạy phá', 'can thiệp', 'vết xước', 'cạy khóa'],
      subCategory: 'Có dấu vết cạy phá cửa / can thiệp khóa',
      label: 'Kiểm tra dấu vết can thiệp, đối chiếu camera & Niêm phong an ninh',
      summary: 'Trích xuất camera hành lang, kiểm tra toàn bộ ổ khóa và dán tem niêm phong an ninh.',
      inspection: 'Có vết xước cơ học nhẹ tại mép ốp kim loại của ổ khóa; chốt khóa cơ và thân khóa còn nguyên vẹn.',
      cause: 'Trích xuất camera xác định do góc xe đẩy hàng va quẹt khi luân chuyển pallet, không có hành vi xâm nhập.',
      actions: [
        'Trích xuất và lưu trữ đoạn clip camera giám sát an ninh hành lang khung giờ liên quan.',
        'Kiểm tra độ chịu lực chốt khóa và thử nghiệm hệ thống cảnh báo cạy cửa hoạt động tốt.',
        'Bàn giao lại hiện trường cho khách và dán tem niêm phong an ninh bổ sung.'
      ],
      conclusion: 'Xác nhận 100% tài sản trong ô an toàn nguyên vẹn, khách hàng đã xem lại camera và đồng thuận kết luận.',
      presets: [
        'Đã kiểm tra an ninh hiện trường và đối chiếu camera: khóa chỉ bị xước nhẹ bên ngoài, chốt trong nguyên vẹn.',
        'Đã kiểm tra an ninh, niêm phong bổ sung ô kho và bàn giao lại cho khách kiểm tra tài sản an toàn.',
      ]
    },
    {
      id: 'SECURITY_SUSPICIOUS_PERSON',
      matchKeys: ['người lạ', 'khả nghi', 'lảng vảng'],
      subCategory: 'Người lạ khả nghi quanh khu kho',
      label: 'Xác minh camera an ninh & Tăng cường tuần tra',
      summary: 'Rà soát camera toàn khu vực kho, xác minh danh tính và tăng cường ca trực tuần tra 30 phút/lần.',
      inspection: 'Ghi nhận phản ánh có người lạ di chuyển ở hành lang tầng kho trong khung giờ vắng.',
      cause: 'Khách thuê ô kho lân cận đi cùng người nhà vận chuyển hàng hóa, chưa nắm rõ sơ đồ lối đi.',
      actions: [
        'Trích xuất camera an ninh lối vào và sảnh thang máy xác minh danh tính người ra vào.',
        'Nhắc nhở khách thuê tuân thủ quy định đeo thẻ khách ra vào khi vào kho.',
        'Tăng cường ca trực bảo vệ tuần tra định kỳ 30 phút/lần tại toàn bộ các tầng kho.'
      ],
      conclusion: 'Tình hình an ninh khu kho đảm bảo tuyệt đối an toàn, không có nguy cơ đe dọa tài sản.',
      presets: [
        'Đã kiểm tra camera an ninh toàn khu vực và tăng cường ca trực bảo vệ tuần tra 30 phút/lần.',
      ]
    },
    {
      id: 'SECURITY_DOOR_AJAR',
      matchKeys: ['thoát hiểm', 'mở', 'cửa ô lân cận', 'cửa hé'],
      subCategory: 'Cửa ô lân cận hoặc cửa thoát hiểm bị mở',
      label: 'Kiểm tra chốt đóng cửa thoát hiểm & Niêm phong ô lân cận',
      summary: 'Đóng chốt an toàn cửa thoát hiểm, kiểm tra tay co thủy lực và niêm phong ô liên quan.',
      inspection: 'Cửa thoát hiểm cuối dãy kho chưa được kéo sát chốt khóa âm sau khi vận chuyển đồ.',
      cause: 'Tay co thủy lực bị yếu lực kéo khép cửa do giãn dầu thủy lực.',
      actions: [
        'Cân chỉnh ốc tăng áp lực tay co thủy lực cửa thoát hiểm, thử đóng tự động khép kín chốt.',
        'Kiểm tra rà soát toàn bộ các ô kho lân cận: khóa SmartLock đều đang ở trạng thái khóa an toàn.',
        'Dán cảnh báo nhắc nhở kiểm tra cửa sau khi ra vào khu vực kho.'
      ],
      conclusion: 'Toàn bộ cửa thoát hiểm và các ô lân cận đã được kiểm soát đóng kín, an ninh an toàn tuyệt đối.',
      presets: [
        'Đã kiểm tra và đóng chốt khóa an toàn cửa thoát hiểm / ô lân cận, khu vực đã được kiểm soát an toàn.',
      ]
    }
  ],

  // ==================== 4. VỆ SINH KHO BÃI (CLEANING) ====================
  CLEANING: [
    {
      id: 'CLEANING_TRASH',
      matchKeys: ['rác', 'thùng carton', 'bao bì'],
      subCategory: 'Rác thải / thùng carton trước cửa ô',
      label: 'Thu gom rác thải, thùng carton & Trả lại lối đi thông thoáng',
      summary: 'Thu dọn vỏ thùng carton, màng bọc nilon và quét sạch lối đi hành lang.',
      inspection: 'Nhiều vỏ thùng carton và màng bọc nilon tập kết chắn lối vào ô kho của khách hàng.',
      cause: 'Khách hàng ô bên cạnh bốc dỡ đồ chưa kịp chuyển phế liệu ra điểm tập kết rác.',
      actions: [
        'Thu gom toàn bộ vỏ thùng carton và rác bao bì về khu vực tập kết rác thải của cơ sở.',
        'Dùng chổi quét sạch bụi cát và dùng máy hút bụi dọn sạch hành lang lối đi.',
        'Nhắc nhở khách thuê ô kế bên tuân thủ nội quy vệ sinh chung của kho bãi.'
      ],
      conclusion: 'Hành lang trước cửa ô kho sạch sẽ, thông thoáng, không còn vật cản trở lối đi.',
      presets: [
        'Đã thu gom toàn bộ rác thải, thùng carton trước cửa ô kho, lối đi hành lang thông thoáng, sạch sẽ.',
      ]
    },
    {
      id: 'CLEANING_LIQUID_SPILL',
      matchKeys: ['nước tràn', 'chất lỏng', 'trơn trượt'],
      subCategory: 'Nước tràn / chất lỏng trơn trượt',
      label: 'Hút khô nước tràn, lau sàn & Khử khuẩn nano bạc',
      summary: 'Hút khô vệt nước tràn trên sàn bê tông, lau khử khuẩn nano bạc chống trơn trượt.',
      inspection: 'Sàn hành lang trước ô kho có vệt nước đọng diện tích khoảng 2m2 gây trơn trượt.',
      cause: 'Khay chứa nước xả đá của xe lạnh vận chuyển đồ bị rò rỉ khi di chuyển qua hành lang.',
      actions: [
        'Đặt biển cảnh báo sàn trơn trượt tại hai đầu hành lang.',
        'Dùng máy hút nước công nghiệp hút khô hoàn toàn lượng nước đọng trên sàn.',
        'Lau sàn bằng dung dịch tẩy rửa sinh học và phun khử khuẩn Nano bạc chống ẩm mốc.'
      ],
      conclusion: 'Mặt bằng hành lang khô ráo hoàn toàn, sạch sẽ, đạt chuẩn vệ sinh dịch vụ kho.',
      presets: [
        'Đã hút khô vệt nước tràn tại hành lang và phun khử trùng nano bạc, sàn khô ráo chống trơn trượt.',
      ]
    },
    {
      id: 'CLEANING_DUST',
      matchKeys: ['bụi bẩn', 'bốc dỡ', 'bụi cát'],
      subCategory: 'Bụi bẩn sau bốc dỡ hàng',
      label: 'Quét dọn & Hút bụi công nghiệp toàn dãy kho',
      summary: 'Hút bụi công nghiệp bề mặt sàn và lau sạch cửa ô kho sau đợt chuyển hàng lớn.',
      inspection: 'Bụi bẩn và đất cát vương vãi trên sàn hành lang sau đợt khách nhập hàng khối lượng lớn.',
      cause: 'Các kiện hàng công nghiệp bám bụi trong quá trình vận chuyển đường dài.',
      actions: [
        'Sử dụng máy hút bụi công nghiệp công suất lớn làm sạch toàn bộ bề mặt sàn hành lang.',
        'Lau sạch bề mặt cánh cửa cuốn của các ô kho bị bám bụi.',
        'Phun sương tạo ẩm khử bụi mịn trong không khí khu vực dãy kho.'
      ],
      conclusion: 'Môi trường kho bãi sạch sẽ, không còn bụi bẩn, không khí trong lành đạt tiêu chuẩn.',
      presets: [
        'Đã quét dọn và hút bụi công nghiệp toàn bộ hành lang xung quanh ô kho sạch sẽ.',
      ]
    }
  ],

  // ==================== 5. BỒI THƯỜNG THIỆT HẠI HÀNG HÓA (GOODS_DAMAGE / GOODS_LOSS) ====================
  GOODS_DAMAGE: [
    {
      id: 'GOODS_INSPECT_FACILITY',
      causeCode: 'FACILITY',
      matchKeys: ['lỗi cơ sở', 'rò rỉ', 'dột', 'thấm nước'],
      subCategory: 'Hàng bị hư hỏng',
      label: 'Kiểm tra hàng hư hỏng — Nguyên nhân sơ bộ: Lỗi do cơ sở',
      summary: 'Kiểm tra thiệt hại tài sản cùng khách, ghi nhận lỗi hạ tầng cơ sở và chuyển FM bồi thường.',
      inspection: 'Nước ngưng/dột thấm từ trần và tường kho gây ướt bao bì, ẩm mốc hàng hóa bên trong ô.',
      cause: 'Lỗi kỹ thuật do cơ sở (FACILITY): Hạ tầng kho/hệ thống làm mát gặp sự cố rò rỉ.',
      actions: [
        'Mở ô cùng khách hàng, chụp ảnh hiện trạng vị trí dột thấm và từng kiện hàng bị hư hỏng.',
        'Lập bảng kê số lượng, ước tính giá trị thiệt hại thực tế tại hiện trường.',
        'Chuyển hồ sơ lên Quản lý cơ sở (FM) đối chiếu ảnh check-in & cảm biến để giải quyết bồi thường (BR-127).'
      ],
      conclusion: 'Ghi nhận dấu hiệu lỗi kỹ thuật từ phía cơ sở; chuyển Quản lý cơ sở thẩm định và chốt mức bồi thường theo gói bảo hiểm.',
      presets: [
        'Ghi nhận dấu hiệu thấm dột từ trần ô kho (nghi lỗi cơ sở), đã chụp ảnh & ước tính thiệt hại chuyển FM thẩm định.',
      ]
    },
    {
      id: 'GOODS_INSPECT_CUSTOMER',
      causeCode: 'CUSTOMER',
      matchKeys: ['do khách', 'đóng gói', 'tự hư', 'bảo quản'],
      subCategory: 'Hàng bị hư hỏng (Do khách hàng)',
      label: 'Kiểm tra hàng hư hỏng — Nguyên nhân sơ bộ: Lỗi do khách hàng',
      summary: 'Kiểm tra hiện trường cho thấy kết cấu ô kho bình thường, hàng hư hỏng do đóng gói/bảo quản từ phía khách.',
      inspection: 'Trần, vách, sàn ô kho khô ráo hoàn toàn, hệ thống thông gió/nhiệt ẩm bình thường; hàng hóa bên trong bị hư hỏng từ bao bì/đặc tính tự nhiên.',
      cause: 'Lỗi từ phía khách hàng (CUSTOMER): Đóng gói/kê lót chưa đúng quy cách hoặc hàng hóa tự biến chất trong quá trình lưu trữ.',
      actions: [
        'Mở ô cùng khách hàng, kiểm tra trần/tường/khóa ô (khô ráo, nguyên vẹn) và chụp ảnh đối chứng.',
        'Kiểm kê các kiện hàng hư hỏng và ghi nhận mức ước tính thiệt hại thực tế tại hiện trường.',
        'Chuyển toàn bộ hồ sơ & bằng chứng ảnh lên Quản lý cơ sở (FM) đối chiếu cảm biến và chốt kết luận.'
      ],
      conclusion: 'Hiện trạng ô kho đảm bảo tiêu chuẩn; sự cố phát sinh do lỗi đóng gói/bảo quản từ phía khách hàng (không thuộc lỗi cơ sở theo BR-127), chuyển FM thẩm định và chốt kết luận.',
      presets: [
        'Ô kho khô ráo bình thường, hàng hư do đóng gói/bảo quản từ phía khách hàng. Đã lập biên bản chuyển FM chốt kết luận.',
      ]
    },
    {
      id: 'GOODS_INSPECT_FORCE_MAJEURE',
      causeCode: 'FORCE_MAJEURE',
      matchKeys: ['bất khả kháng', 'thiên tai', 'hỏa hoạn', 'ngập lụt'],
      subCategory: 'Hàng bị hư hỏng (Bất khả kháng)',
      label: 'Kiểm tra hàng hư hỏng — Nguyên nhân sơ bộ: Bất khả kháng',
      summary: 'Kiểm tra thiệt hại hàng hóa phát sinh từ sự kiện bất khả kháng bên ngoài để chuyển FM xét bảo hiểm.',
      inspection: 'Khu vực ô kho bị ảnh hưởng bởi yếu tố thiên tai/sự cố bất khả kháng từ bên ngoài làm hư hại hàng hóa lưu trữ.',
      cause: 'Sự kiện bất khả kháng (FORCE_MAJEURE): Thiên tai, mưa bão cực đoan hoặc sự cố bên ngoài ngoài tầm kiểm soát.',
      actions: [
        'Mở ô cùng khách hàng, lập danh mục hàng hóa hư hỏng và chụp ảnh hiện trường chi tiết.',
        'Ghi nhận mức thiệt hại ước tính tại chỗ và rà soát thông tin gói bảo hiểm của hợp đồng.',
        'Chuyển hồ sơ lên Quản lý cơ sở (FM) xem xét phạm vi chi trả theo gói bảo hiểm (BR-127).'
      ],
      conclusion: 'Xác định sơ bộ do sự kiện bất khả kháng; chuyển Quản lý cơ sở thẩm định giá trị và xử lý theo điều khoản bảo hiểm hợp đồng.',
      presets: [
        'Ghi nhận thiệt hại do yếu tố bất khả kháng từ bên ngoài, đã kiểm đếm & chuyển FM xem xét theo gói bảo hiểm.',
      ]
    },
    {
      id: 'GOODS_INSPECT_UNKNOWN',
      causeCode: 'UNKNOWN',
      matchKeys: ['chưa xác định', 'đối chiếu'],
      subCategory: 'Hàng bị hư hỏng (Chưa rõ nguyên nhân)',
      label: 'Kiểm tra hàng hư hỏng — Nguyên nhân sơ bộ: Chưa xác định được',
      summary: 'Ghi nhận trung lập hiện trạng hư hỏng hàng hóa và chuyển FM đối chiếu cảm biến & ảnh check-in.',
      inspection: 'Hàng hóa trong ô có dấu hiệu hư hỏng; cần đối chiếu thêm lịch sử nhiệt độ/độ ẩm và ảnh lúc nhận kho để xác định nguyên nhân.',
      cause: 'Chưa xác định được nguyên nhân rõ ràng tại hiện trường (UNKNOWN).',
      actions: [
        'Mở ô cùng khách hàng, chụp ảnh toàn cảnh ô kho, vách/trần và từng kiện hàng bị ảnh hưởng.',
        'Ghi nhận ước tính giá trị thiệt hại ban đầu để làm cơ sở tham khảo.',
        'Chuyển Quản lý cơ sở (FM) trích xuất nhật ký cảm biến, camera và ảnh bàn giao lúc nhận kho để kết luận (BR-127).'
      ],
      conclusion: 'Chưa đủ cơ sở kết luận nguyên nhân tại hiện trường; chuyển toàn bộ bằng chứng lên FM kiểm tra cảm biến và chốt trách nhiệm.',
      presets: [
        'Đã kiểm tra hiện trạng hàng hư hỏng nhưng chưa xác định rõ nguyên nhân, chuyển FM đối chiếu cảm biến & ảnh check-in.',
      ]
    }
  ],

  GOODS_LOSS: [
    {
      id: 'GOODS_LOSS_FACILITY',
      causeCode: 'FACILITY',
      matchKeys: ['mất hàng', 'cạy khóa', 'mất trộm', 'lỗi cơ sở'],
      subCategory: 'Mất hàng (Do cơ sở)',
      label: 'Kiểm tra mất hàng — Nguyên nhân sơ bộ: Lỗi an ninh/khóa cơ sở',
      summary: 'Kiểm tra dấu vết cạy phá khóa, kiểm đếm hàng tồn và chuyển FM xử lý bồi thường.',
      inspection: 'Phát hiện dấu hiệu bất thường ở khóa SmartLock/chốt cửa ô kho; một số kiện hàng theo kê khai không còn trong ô.',
      cause: 'Lỗi kỹ thuật / an ninh từ cơ sở (FACILITY): Khóa ô gặp sự cố hoặc phát hiện dấu hiệu xâm nhập trái phép.',
      actions: [
        'Kiểm tra niêm phong, tình trạng khóa SmartLock cùng khách hàng và chụp ảnh hiện trường.',
        'Đối chiếu bảng kê hàng lúc nhận kho, xác định danh mục thiếu và ước tính giá trị thiệt hại.',
        'Chuyển hồ sơ khẩn lên FM & trích xuất lịch sử mở khóa / camera để giải quyết bồi thường (BR-127).'
      ],
      conclusion: 'Ghi nhận dấu hiệu mất an toàn khóa/an ninh từ phía cơ sở; chuyển FM xác minh camera và giải quyết bồi thường theo quy định.',
      presets: [
        'Phát hiện bất thường tại khóa ô và thiếu hụt hàng hóa, nghi lỗi an ninh cơ sở — đã chuyển FM trích xuất camera & bồi thường.',
      ]
    },
    {
      id: 'GOODS_LOSS_CUSTOMER',
      causeCode: 'CUSTOMER',
      matchKeys: ['do khách', 'khóa nguyên vẹn', 'lấy nhầm'],
      subCategory: 'Mất hàng (Do khách hàng)',
      label: 'Kiểm tra mất hàng — Nguyên nhân sơ bộ: Lỗi từ phía khách hàng',
      summary: 'Khóa và vách ô nguyên vẹn, không có dấu hiệu đột nhập; nghi sai sót quản lý từ phía khách.',
      inspection: 'Khóa SmartLock, chốt cửa và vách bao che ô kho nguyên vẹn 100%, không có dấu hiệu cạy phá hay can thiệp từ bên ngoài.',
      cause: 'Lỗi từ phía khách hàng (CUSTOMER): Khách tự quản lý mã PIN/thẻ từ hoặc nhầm lẫn trong quá trình xuất nhập hàng.',
      actions: [
        'Kiểm tra nguyên vẹn khóa SmartLock & niêm phong ô cùng khách hàng, chụp ảnh xác nhận.',
        'Kiểm đếm phần hàng còn lại trong ô và ghi nhận giá trị khách kê khai thiếu.',
        'Chuyển hồ sơ lên Quản lý cơ sở (FM) cung cấp nhật ký mở khóa SmartLock để chốt kết luận.'
      ],
      conclusion: 'Khóa ô và an ninh khu vực nguyên vẹn, không có dấu hiệu xâm nhập; sự cố không thuộc lỗi cơ sở (BR-127), chuyển FM đối chiếu log và chốt kết luận.',
      presets: [
        'Khóa SmartLock và vách ô còn nguyên vẹn hoàn toàn, không có dấu hiệu đột nhập; đã lập biên bản chuyển FM đối chiếu log mở khóa.',
      ]
    },
    {
      id: 'GOODS_LOSS_FORCE_MAJEURE',
      causeCode: 'FORCE_MAJEURE',
      matchKeys: ['bất khả kháng'],
      subCategory: 'Mất hàng (Bất khả kháng)',
      label: 'Kiểm tra mất hàng — Nguyên nhân sơ bộ: Bất khả kháng',
      summary: 'Ghi nhận mất mát tài sản do sự kiện bất khả kháng để FM xét gói bảo hiểm.',
      inspection: 'Ô kho chịu ảnh hưởng của sự cố bất khả kháng dẫn đến thất thoát hàng hóa đang lưu trữ.',
      cause: 'Sự kiện bất khả kháng (FORCE_MAJEURE): Thiên tai, hỏa hoạn hoặc sự cố khách quan bên ngoài.',
      actions: [
        'Kiểm tra hiện trường cùng khách hàng, lập danh mục hàng thất thoát và chụp ảnh chứng cứ.',
        'Ước tính giá trị hàng hóa tại hiện trường để làm cơ sở đối chiếu bảo hiểm.',
        'Chuyển hồ sơ lên FM xử lý theo quyền lợi gói bảo hiểm hợp đồng (BR-127).'
      ],
      conclusion: 'Xác định sơ bộ do bất khả kháng; chuyển FM rà soát gói bảo hiểm và giải quyết theo đúng điều khoản hợp đồng.',
      presets: [
        'Ghi nhận thất thoát do sự kiện bất khả kháng, đã kiểm đếm chuyển FM xem xét gói bảo hiểm.',
      ]
    },
    {
      id: 'GOODS_LOSS_UNKNOWN',
      causeCode: 'UNKNOWN',
      matchKeys: ['chưa xác định'],
      subCategory: 'Mất hàng (Chưa rõ nguyên nhân)',
      label: 'Kiểm tra mất hàng — Nguyên nhân sơ bộ: Chưa xác định được',
      summary: 'Ghi nhận hiện trạng thiếu hụt hàng hóa, chuyển FM trích xuất camera & log SmartLock.',
      inspection: 'Cần đối chiếu lịch sử ra vào cổng, log mở khóa SmartLock và dữ liệu camera hành lang để làm rõ nguyên nhân thiếu hụt.',
      cause: 'Chưa xác định được nguyên nhân tại hiện trường (UNKNOWN).',
      actions: [
        'Chụp ảnh hiện trạng khóa, cửa ô và số lượng hàng hóa thực tế còn lại trong ô.',
        'Ghi nhận giá trị hàng ước tính ban đầu cùng với khách hàng.',
        'Chuyển FM trích xuất log SmartLock, camera an ninh và ảnh lúc bàn giao nhận kho (BR-127).'
      ],
      conclusion: 'Chưa đủ căn cứ kết luận tại chỗ; chuyển hồ sơ lên FM trích xuất dữ liệu an ninh để xác định trách nhiệm.',
      presets: [
        'Đã ghi nhận tình trạng thiếu hàng tại hiện trường, chuyển FM trích xuất camera & log mở khóa để làm rõ nguyên nhân.',
      ]
    }
  ],

  // ==================== 6. YÊU CẦU HỖ TRỢ KHÁC (OTHER) ====================
  OTHER: [
    {
      id: 'OTHER_CONTRACT_RENEWAL',
      matchKeys: ['hợp đồng', 'gia hạn', 'thủ tục'],
      subCategory: 'Tư vấn thủ tục hợp đồng / gia hạn',
      label: 'Tư vấn thủ tục gia hạn & Hợp đồng thuê kho',
      summary: 'Giải thích chi tiết quy trình gia hạn hợp đồng và hướng dẫn thao tác online cho khách.',
      inspection: 'Khách hàng có nhu cầu gia hạn thêm 6 tháng và hỏi về chính sách ưu đãi cước thuê.',
      cause: 'Hợp đồng hiện tại sắp đến hạn kết thúc kỳ hạn thuê ban đầu.',
      actions: [
        'Kiểm tra thời hạn hợp đồng và áp dụng chính sách giảm 5% cho kỳ gia hạn 6 tháng.',
        'Hướng dẫn khách thao tác gia hạn và thanh toán VNPAY trực tiếp trên ứng dụng QueenKho.',
        'In phụ lục hợp đồng gia hạn lưu hồ sơ lưu trữ.'
      ],
      conclusion: 'Khách hàng đã nắm rõ thủ tục, hoàn tất gia hạn thành công và hài lòng với chất lượng dịch vụ.',
      presets: [
        'Đã tư vấn chi tiết thủ tục gia hạn hợp đồng và chính sách ưu đãi cước phí, khách đã hoàn tất gia hạn.',
      ]
    },
    {
      id: 'OTHER_BILLING_INVOICE',
      matchKeys: ['cước phí', 'hóa đơn', 'thanh toán', 'tiền cọc'],
      subCategory: 'Thắc mắc cước phí / hóa đơn thanh toán',
      label: 'Giải thích chi tiết cước phí & Xuất hóa đơn VAT',
      summary: 'Đối soát các giao dịch thanh toán cước thuê kho, tiền cọc và giải đáp chi tiết cho khách.',
      inspection: 'Khách hàng cần đối chiếu bảng kê chi phí tiền thuê và biên lai cọc lưu trữ.',
      cause: 'Khách hàng cần chứng từ đối soát tài chính nội bộ doanh nghiệp.',
      actions: [
        'Trích xuất bảng kê giao dịch thanh toán chi tiết từ hệ thống quản lý tài chính.',
        'Giải thích rõ ràng các khoản tiền cọc, cước thuê tháng và các ưu đãi đã áp dụng.',
        'Cung cấp biên lai điện tử có chữ ký số xác nhận của cơ sở QueenKho.'
      ],
      conclusion: 'Khách hàng đã nhận đủ chứng từ hóa đơn, số liệu đối khớp 100%, không còn thắc mắc.',
      presets: [
        'Đã đối soát chi tiết cước phí và giải thích rõ ràng các khoản tiền cọc, xuất biên lai thành công cho khách.',
      ]
    },
    {
      id: 'OTHER_TRANSFER_UNIT',
      matchKeys: ['đổi ô', 'chuyển kho', 'di chuyển đồ'],
      subCategory: 'Hướng dẫn đổi ô kho / chuyển đồ',
      label: 'Khảo sát ô kho mới & Hướng dẫn thủ tục đổi kho',
      summary: 'Dẫn khách khảo sát ô kho diện tích lớn hơn và lập phiếu chuyển kho theo quy định.',
      inspection: 'Khách hàng có nhu cầu nâng cấp từ kho Tiêu Chuẩn 5m2 lên kho Lớn 15m2 do tăng lượng hàng.',
      cause: 'Nhu cầu mở rộng kinh doanh lưu trữ thực tế của khách hàng.',
      actions: [
        'Dẫn khách trực tiếp tham quan các ô kho trống phù hợp tại tầng 2 cơ sở.',
        'Hướng dẫn quy trình chuyển kho, bảo lưu tiền cọc và tính chênh lệch cước phí thuê.',
        'Hỗ trợ xe đẩy hàng chuyên dụng của kho để khách chuyển đồ sang ô mới an toàn.'
      ],
      conclusion: 'Khách hàng đã chọn được ô kho ưng ý và hoàn tất thủ tục đổi ô kho thuận lợi.',
      presets: [
        'Đã dẫn khách khảo sát ô kho mới, hỗ trợ xe đẩy chuyển đồ và hoàn tất thủ tục đổi ô kho.',
      ]
    },
    {
      id: 'OTHER_GENERAL',
      matchKeys: ['khác', 'chung'],
      subCategory: 'Yêu cầu hỗ trợ chung khác',
      label: 'Biên bản ghi nhận & Giải quyết yêu cầu hỗ trợ chung',
      summary: 'Khảo sát và xử lý thỏa đáng yêu cầu vận hành phát sinh cho khách hàng.',
      inspection: 'Ghi nhận đầy đủ thông tin yêu cầu thực tế của khách hàng tại cơ sở.',
      cause: 'Yêu cầu phát sinh trong quá trình sử dụng dịch vụ lưu trữ kho.',
      actions: [
        'Trực tiếp hỗ trợ và tư vấn giải pháp tối ưu cho khách hàng.',
        'Kiểm tra lại toàn bộ điều kiện vận hành của ô kho để khách yên tâm sử dụng.',
        'Cung cấp thông tin hotline kỹ thuật 24/7 để hỗ trợ nhanh khi cần.'
      ],
      conclusion: 'Yêu cầu của khách hàng đã được xử lý hoàn tất, khách hàng hài lòng và ký xác nhận.',
      presets: [
        'Đã tiếp nhận yêu cầu và xử lý thỏa đáng cho khách hàng tại hiện trường cơ sở.',
      ]
    }
  ]
};

const CAUSE_CODE_LABELS = {
  FACILITY: 'Lỗi kỹ thuật / vận hành từ phía cơ sở (FACILITY) - ',
  CUSTOMER: 'Lỗi đóng gói / bảo quản từ phía khách hàng (CUSTOMER) - ',
  FORCE_MAJEURE: 'Sự kiện bất khả kháng từ bên ngoài (FORCE_MAJEURE) - ',
  UNKNOWN: 'Chưa xác định được nguyên nhân tại hiện trường (UNKNOWN) - Chuyển FM đối chiếu cảm biến & ảnh check-in',
};

/**
 * Tìm kiếm template phù hợp nhất dựa vào preliminaryCause (với claim bồi thường), task.subCategory và task.issueType
 * ƯU TIÊN 0 (Claim): Khớp causeCode theo preliminaryCause (FACILITY / CUSTOMER / FORCE_MAJEURE / UNKNOWN)
 * ƯU TIÊN 1: Khớp chính xác hoặc khớp từ khóa với task.subCategory (hoặc task.note)
 * ƯU TIÊN 2: Khớp theo task.issueType
 * ƯU TIÊN 3: Mẫu mặc định OTHER
 */
export function findMatchingTemplate(task, preliminaryCause = '') {
  if (!task) return INCIDENT_REPORT_TEMPLATES.OTHER[0];
  const issueType = task.issueType || task?.claim?.claimType || 'OTHER';
  const list = INCIDENT_REPORT_TEMPLATES[issueType] || INCIDENT_REPORT_TEMPLATES.OTHER;

  const normCause = String(preliminaryCause || task?.claim?.preliminaryCause || '').trim().toUpperCase();
  if (normCause && (issueType === 'GOODS_DAMAGE' || issueType === 'GOODS_LOSS')) {
    const byCause = list.find(item => item.causeCode === normCause);
    if (byCause) return byCause;
  }

  // Lấy chuỗi tìm kiếm từ subCategory hoặc note
  const rawTarget = String(task.subCategory || task.note || task.ticketDescription || '').toLowerCase();

  if (rawTarget) {
    // 1. Thử khớp theo subCategory chính xác hoặc matchKeys
    for (const item of list) {
      if (item.subCategory && rawTarget.includes(item.subCategory.toLowerCase())) {
        return item;
      }
      if (item.matchKeys && item.matchKeys.some(k => rawTarget.includes(k.toLowerCase()))) {
        return item;
      }
    }
  }

  // Fallback: trả về template đầu tiên của loại sự cố đó
  return list[0] || INCIDENT_REPORT_TEMPLATES.OTHER[0];
}

/**
 * Lấy danh sách các câu phản hồi nhanh phù hợp với task (ưu tiên khớp đúng preliminaryCause, subCategory và biện pháp xử lý)
 */
export function getPresetsForTask(task, repairStatus = 'FIXED', preliminaryCause = '') {
  if (repairStatus === 'ESCALATED_MAINTENANCE') {
    return [
      'Đã khảo sát hiện trường, phát hiện sự cố phức tạp vượt thẩm quyền xử lý nhanh, đã lập phiếu chuyển bảo trì chuyên sâu.',
      'Đã kiểm tra và cô lập tạm thời khu vực sự cố để đảm bảo an toàn, đã chuyển tiếp sang task bảo trì chuyên sâu.',
      'Đã ghi nhận hỏng hóc thiết bị, tạm ngắt nguồn và lập phiếu yêu cầu kỹ thuật bảo trì kho để xử lý dứt điểm.'
    ];
  }

  const matched = findMatchingTemplate(task, preliminaryCause);
  if (matched && matched.presets && matched.presets.length > 0) {
    return matched.presets;
  }
  const issueType = task?.issueType || task?.claim?.claimType || 'OTHER';
  const list = INCIDENT_REPORT_TEMPLATES[issueType] || INCIDENT_REPORT_TEMPLATES.OTHER;
  const allPresets = [];
  for (const item of list) {
    if (item.presets) allPresets.push(...item.presets);
  }
  return allPresets.slice(0, 4);
}

// Hàm sinh khung sườn biên bản chuẩn (chỉ điền sẵn thông tin hành chính, để trống các mục cho nhân viên tự ghi theo hiện trường thực tế)
export function buildBlankIncidentReport(task, repairStatus = 'FIXED', preliminaryCause = '') {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ngày ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const unit = task?.storageUnitId || '---';
  const staff = task?.staffName || task?.assignedStaffName || 'Nhân viên cơ sở';
  const rawTicket = task?.ticketCode || (task?.id ? `SR-${task.id}` : '---');
  const ticketCode = String(rawTicket).startsWith('#') ? String(rawTicket).slice(1) : String(rawTicket);
  const subCategoryStr = task?.subCategory ? ` [${task.subCategory}]` : '';
  const normCause = String(preliminaryCause || '').trim().toUpperCase();
  const causePrefix = CAUSE_CODE_LABELS[normCause] || '';

  if (repairStatus === 'ESCALATED_MAINTENANCE') {
    return `[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]
• Thời gian: ${dateStr} · Ô kho: ${unit}
• Cán bộ xử lý: ${staff} · Phiếu: ${ticketCode}${subCategoryStr}
• Hiện trạng sự cố: 
• Nguyên nhân sơ bộ: ${causePrefix}
• Biện pháp xử lý tạm thời: Đã khảo sát hiện trường, tạm thời cô lập sự cố và lập phiếu yêu cầu bảo trì chuyên sâu
• Kết luận & Bàn giao: Đã chuyển sang quy trình Bảo trì chuyên sâu, bàn giao cho đội ngũ kỹ thuật xử lý dứt điểm.`;
  }

  return `[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]
• Thời gian: ${dateStr} · Ô kho: ${unit}
• Cán bộ xử lý: ${staff} · Phiếu: ${ticketCode}${subCategoryStr}
• Hiện trạng: 
• Nguyên nhân sơ bộ: ${causePrefix}
• Biện pháp xử lý kỹ thuật:

• Kết quả nghiệm thu: `;
}

// Hàm sinh đoạn văn bản biên bản mẫu đầy đủ (dùng khi cần demo test nhanh)
export function buildIncidentReportNote(task, template, repairStatus = 'FIXED', preliminaryCause = '') {
  const issueType = task?.issueType || task?.claim?.claimType || 'OTHER';
  const isClaimType = issueType === 'GOODS_DAMAGE' || issueType === 'GOODS_LOSS';
  const tpl = (isClaimType && preliminaryCause
    ? findMatchingTemplate(task, preliminaryCause)
    : template) || findMatchingTemplate(task, preliminaryCause);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getHours())}:${pad(now.getMinutes())} ngày ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const unit = task?.storageUnitId || 'Ô kho';
  const staff = task?.staffName || task?.assignedStaffName || 'Nhân viên kỹ thuật';
  const rawTicket = task?.ticketCode || (task?.id ? `SR-${task.id}` : '---');
  const ticketCode = String(rawTicket).startsWith('#') ? String(rawTicket).slice(1) : String(rawTicket);
  const subCategoryStr = task?.subCategory ? ` [${task.subCategory}]` : '';

  const isEscalated = repairStatus === 'ESCALATED_MAINTENANCE';
  const actions = isEscalated
    ? [
        `Khảo sát hiện trường, ghi nhận hỏng hóc kỹ thuật phức tạp cần thiết bị chuyên dụng.`,
        'Tạm thời ngắt nguồn cấp điện / cô lập khu vực sự cố để đảm bảo an toàn.',
        'Lập phiếu chuyển tiếp sang quy trình Bảo trì chuyên sâu (Task bảo trì kho).'
      ]
    : tpl.actions;

  const conclusion = isEscalated
    ? 'Đã cô lập an toàn tạm thời và chuyển hồ sơ sang quy trình Bảo trì chuyên sâu để đội kỹ thuật xử lý dứt điểm.'
    : tpl.conclusion;

  return `[BIÊN BẢN XỬ LÝ SỰ CỐ & KIỂM TRA HIỆN TRƯỜNG]
• Thời gian: ${dateStr} · Ô kho: ${unit}
• Cán bộ xử lý: ${staff} · Phiếu: ${ticketCode}${subCategoryStr}
• Hiện trạng: ${tpl.inspection}
• Nguyên nhân sơ bộ: ${tpl.cause}
• Biện pháp xử lý kỹ thuật:
  - ${actions.join('\n  - ')}
• Kết quả nghiệm thu: ${conclusion}`;
}
