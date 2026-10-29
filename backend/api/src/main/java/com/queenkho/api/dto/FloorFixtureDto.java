package com.queenkho.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// UC-06: 1 vật cố định trên mặt bằng (dùng cho cả request lưu mặt bằng và response)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FloorFixtureDto {
    private Integer id;

    @NotBlank(message = "Loại vật cố định không được để trống")
    private String type; // AISLE / ENTRANCE / STAIRS / ELEVATOR / OFFICE

    private String label;

    @NotNull(message = "Thiếu toạ độ x")
    private Integer x;

    @NotNull(message = "Thiếu toạ độ y")
    private Integer y;

    @NotNull(message = "Thiếu chiều rộng")
    private Integer w;

    @NotNull(message = "Thiếu chiều cao")
    private Integer h;
}
