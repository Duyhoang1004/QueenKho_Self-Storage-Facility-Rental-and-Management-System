package com.queenkho.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// UC-08: kết quả của tạo / sửa / đổi trạng thái / đặt lại mật khẩu.
// warning != null → thao tác VẪN thành công, FE hiện toast vàng (PR-A4: "Cơ sở X chưa có quản lý").
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class UserActionResponse {
    private AdminUserResponse user;
    private String warning;
}
