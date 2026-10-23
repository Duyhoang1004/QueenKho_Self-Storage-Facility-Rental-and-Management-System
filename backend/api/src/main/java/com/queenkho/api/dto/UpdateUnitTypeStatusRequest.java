package com.queenkho.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

/**
 * DTO đổi trạng thái loại kho (ACTIVE/INACTIVE) (UC-05, PR-M4)
 */
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@Builder
public class UpdateUnitTypeStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống")
    @Pattern(regexp = "^(ACTIVE|INACTIVE)$", message = "Trạng thái chỉ nhận giá trị ACTIVE hoặc INACTIVE")
    private String status;
}
