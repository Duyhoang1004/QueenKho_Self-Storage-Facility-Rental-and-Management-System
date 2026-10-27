package com.queenkho.api.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

// PR-O10: Staff / FM bấm "Sửa xong" cho task bảo trì ô kho
@Getter
@Setter
@NoArgsConstructor
public class CompleteMaintenanceRequest {
    private String note;             // Bắt buộc 10–1000 ký tự: đã sửa / dọn những gì
    private String evidenceImageUrl; // Không bắt buộc: link ảnh sau sửa (upload qua /api/v1/uploads)

    // PR-Q10: chỉ dùng cho task dọn kho sau thanh lý — biên bản kiểm kê hàng của khách
    private Boolean noGoodsLeft;          // true = ô trống, khách không để lại gì → không lập hồ sơ lưu giữ
    private String inventoryNote;         // Danh sách hàng (10–2000 ký tự)
    private String witnessNote;           // Người mở kho / chứng kiến (≥ 2 người, tối đa 500 ký tự)
    private String storageLocation;       // Khu lưu giữ (tối đa 100 ký tự)
    private List<String> inventoryImages; // ≥ 1 ảnh kiểm kê (link upload)
}
