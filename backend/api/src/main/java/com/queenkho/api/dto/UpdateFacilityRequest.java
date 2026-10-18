package com.queenkho.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateFacilityRequest {

    @NotBlank(message = "Tên cơ sở không được để trống")
    @Size(max = 150, message = "Tên cơ sở tối đa 150 ký tự")
    private String name;

    @NotBlank(message = "Tỉnh/Thành phố không được để trống")
    @Size(max = 100, message = "Thành phố tối đa 100 ký tự")
    private String city;

    @NotBlank(message = "Quận/Huyện không được để trống")
    @Size(max = 100, message = "Quận/Huyện tối đa 100 ký tự")
    private String district;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 255, message = "Địa chỉ tối đa 255 ký tự")
    private String address;

    @Pattern(regexp = "^(0[0-9]{9,10}|[0-9]{3,4}-[0-9]{3,4}-[0-9]{3,4})?$", message = "Hotline không đúng định dạng số điện thoại")
    private String hotline;
}
