package com.queenkho.api.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * DTO cập nhật loại kho cho BOM Portal (UC-05, PR-M3, PR-12)
 */
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class UpdateUnitTypeRequest {

    @NotBlank(message = "Tên loại kho không được để trống")
    @Size(max = 100, message = "Tên loại kho tối đa 100 ký tự")
    private String name;

    @NotNull(message = "Diện tích không được để trống")
    @DecimalMin(value = "0.01", message = "Diện tích phải lớn hơn 0 m²")
    private BigDecimal areaSqm;

    @NotNull(message = "Thể tích không được để trống")
    @DecimalMin(value = "0.01", message = "Thể tích phải lớn hơn 0 m³")
    private BigDecimal volumeCbm;

    @NotNull(message = "Giá niêm yết không được để trống")
    @DecimalMin(value = "1000", message = "Giá niêm yết phải lớn hơn 0 VNĐ")
    private BigDecimal basePriceMonthly;

    @Size(max = 150, message = "Gợi ý sức chứa tối đa 150 ký tự")
    private String suggestedCapacity;

    @Size(max = 100, message = "Kích thước tối đa 100 ký tự")
    private String dimensions;

    @Size(max = 500, message = "Đặc điểm mô tả tối đa 500 ký tự")
    private String features;

    @Pattern(regexp = "^(ACTIVE|INACTIVE)$", message = "Trạng thái chỉ nhận giá trị ACTIVE hoặc INACTIVE")
    private String status;
}
