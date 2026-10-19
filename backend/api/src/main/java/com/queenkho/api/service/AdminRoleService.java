package com.queenkho.api.service;

import com.queenkho.api.dto.RoleResponse;
import com.queenkho.api.dto.UpdateRoleRequest;
import com.queenkho.api.entity.Role;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.RoleRepository;
import com.queenkho.api.repository.UserRepository;
import com.queenkho.api.repository.UserRepository.RoleStatusCount;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

// UC-03: Quản trị vai trò. PR-A1: 5 role cố định — không tạo / xoá / đổi tên, chỉ sửa mô tả.
@Service
public class AdminRoleService {

    private static final int DESCRIPTION_MAX_LENGTH = 255; // = độ dài cột roles.description

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ActivityLogService activityLogService;

    // UC-03: danh sách 5 role theo id + số người dùng
    @Transactional(readOnly = true)
    public List<RoleResponse> getRoles() {
        List<RoleStatusCount> counts = userRepository.countGroupByRoleAndStatus(ActivityLogService.SYSTEM_EMAIL);
        return roleRepository.findAll(Sort.by("id")).stream()
                .map(role -> toResponse(role, counts))
                .toList();
    }

    // UC-03: sửa mô tả 1 role
    @Transactional
    public RoleResponse updateDescription(Integer roleId, UpdateRoleRequest request, Integer actorUserId) {
        requireActiveAdmin(actorUserId);

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new AdminException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND",
                        "Không tìm thấy vai trò #" + roleId));

        String newDescription = (request == null || request.getDescription() == null)
                ? "" : request.getDescription().trim();
        if (newDescription.isEmpty()) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mô tả không được để trống");
        }
        if (newDescription.length() > DESCRIPTION_MAX_LENGTH) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Mô tả tối đa " + DESCRIPTION_MAX_LENGTH + " ký tự");
        }

        String oldDescription = role.getDescription();
        // Không đổi gì → trả về luôn, không ghi log rác
        if (!Objects.equals(newDescription, oldDescription)) {
            role.setDescription(newDescription);
            // role đang được Hibernate quản lý trong transaction → setter là đủ, commit tự UPDATE.
            // Gọi save() cho dễ đọc, không bắt buộc.
            roleRepository.save(role);

            // PR-A9, PR-A10: mọi CRUD của Admin đều ghi log, mở đầu bằng mã nghiệp vụ
            activityLogService.log(actorUserId,
                    "[ROLE_UPDATE] Sửa mô tả vai trò " + role.getName() + ": \""
                            + (oldDescription == null ? "" : oldDescription) + "\" → \"" + newDescription + "\"",
                    "roles", String.valueOf(role.getId()));
        }

        return toResponse(role, userRepository.countGroupByRoleAndStatus(ActivityLogService.SYSTEM_EMAIL));
    }

    // Người thao tác phải là ADMIN đang ACTIVE (tạm nhận id qua query — nợ PR-90).
    // UC-08 cũng cần hàm này → lúc đó tách ra class dùng chung.
    private void requireActiveAdmin(Integer actorUserId) {
        if (actorUserId == null) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu actorUserId");
        }
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                        "Không tìm thấy người thao tác"));
        if (!"ADMIN".equals(actor.getRole().getName()) || !"ACTIVE".equals(actor.getStatus())) {
            throw new AdminException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE",
                    "Chỉ Quản trị viên đang hoạt động mới được sửa vai trò");
        }
    }

    // Ghép role với kết quả GROUP BY: cộng mọi trạng thái vào userCount, riêng ACTIVE vào activeCount
    private RoleResponse toResponse(Role role, List<RoleStatusCount> counts) {
        long userCount = 0;
        long activeCount = 0;
        for (RoleStatusCount c : counts) {
            if (!c.getRoleName().equals(role.getName())) continue;
            userCount += c.getTotal();
            if ("ACTIVE".equals(c.getStatus())) activeCount += c.getTotal();
        }
        return new RoleResponse(role.getId(), role.getName(), role.getDescription(), userCount, activeCount);
    }
}
