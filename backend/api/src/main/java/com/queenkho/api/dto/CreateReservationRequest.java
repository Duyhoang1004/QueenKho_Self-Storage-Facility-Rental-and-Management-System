package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateReservationRequest {
    private Integer customerId;
    private Integer facilityId;
    private Integer unitTypeId;
    private LocalDate startDate;
    private Integer durationMonths;
    private Boolean acceptedTerms; // Bắt buộc true: khách đồng ý điều khoản xử lý tài sản khi không trả kho
    private String phone;
    private String cccd;
    private String voucherCode;    // BR-25: bỏ trống = tự áp mã mặc định (NEWKHO)
    private String insurancePlan;  // BR-125: BASIC (mặc định, miễn phí) / ADVANCED / PREMIUM
    private java.math.BigDecimal declaredGoodsValue; // giá trị hàng khai báo bắt buộc
    private java.util.List<String> goodsValueEvidenceImages; // 1-5 ảnh hoá đơn/biên lai/chứng từ
    private java.util.List<String> goodsCategoryCodes; // BR-131: mã loại hàng (bắt buộc ≥ 1)
    private String goodsDescription;               // BR-131: mô tả hàng (bắt buộc khi chọn "Khác")
}
