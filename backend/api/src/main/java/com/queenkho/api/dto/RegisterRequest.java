package com.queenkho.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không đúng định dạng")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 6, message = "Mật khẩu có ít nhất 6 ký tự")
    private String password;
    
    @NotBlank(message = "Tên không được để trống")
    private String fullName;
    
    @NotBlank(message = "Số điện thoại không được để trống")
    private String phone;
}
