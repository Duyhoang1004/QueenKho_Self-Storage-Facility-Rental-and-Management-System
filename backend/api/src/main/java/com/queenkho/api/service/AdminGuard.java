package com.queenkho.api.service;

import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

// UC-03/08/31: kiểm tra người thao tác là ADMIN đang ACTIVE.
// Tạm nhận id qua query (nợ PR-90) — khi có token chỉ cần sửa class này, các service gọi nó giữ nguyên.
@Component
public class AdminGuard {

    @Autowired
    private UserRepository userRepository;

    // Trả về chính người thao tác để service dùng tiếp nếu cần
    public User requireActiveAdmin(Integer actorUserId) {
        if (actorUserId == null) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu actorUserId");
        }
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                        "Không tìm thấy người thao tác"));
        if (!"ADMIN".equals(actor.getRole().getName()) || !"ACTIVE".equals(actor.getStatus())) {
            throw new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Chỉ Quản trị viên đang hoạt động mới được thực hiện thao tác này");
        }
        return actor;
    }
}
