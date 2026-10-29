package com.queenkho.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// UC-06: tạo / sửa mặt bằng tầng (kích thước tính theo ô lưới 0.5m)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FloorRequest {

    @NotBlank(message = "Tên tầng không được để trống")
    @Size(max = 20, message = "Tên tầng tối đa 20 ký tự")
    private String name;

    @NotNull(message = "Thiếu chiều ngang mặt bằng")
    @Min(value = 10, message = "Mặt bằng tối thiểu 10 ô lưới (5m)")
    @Max(value = 200, message = "Mặt bằng tối đa 200 ô lưới (100m)")
    private Integer gridWidth;

    @NotNull(message = "Thiếu chiều dọc mặt bằng")
    @Min(value = 10, message = "Mặt bằng tối thiểu 10 ô lưới (5m)")
    @Max(value = 200, message = "Mặt bằng tối đa 200 ô lưới (100m)")
    private Integer gridHeight;
}
