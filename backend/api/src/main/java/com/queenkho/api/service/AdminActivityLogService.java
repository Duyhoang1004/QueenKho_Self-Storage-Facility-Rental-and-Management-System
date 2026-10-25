package com.queenkho.api.service;

import com.queenkho.api.dto.ActivityLogResponse;
import com.queenkho.api.dto.PageResponse;
import com.queenkho.api.entity.ActivityLog;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.AdminException;
import com.queenkho.api.repository.ActivityLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// UC-31: Xem nhật ký hoạt động toàn hệ thống (Admin).
// Rule: PR-07 (chỉ xem), PR-A8 (user_id = người thao tác thật), PR-A10 (mã nghiệp vụ), PR-A11 (bộ lọc)
@Service
public class AdminActivityLogService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    // Không lọc ngày → dùng 2 mốc rất xa thay cho null (tránh truyền null kiểu ngày giờ vào JPQL)
    private static final LocalDateTime MIN_TIME = LocalDateTime.of(2000, 1, 1, 0, 0);
    private static final LocalDateTime MAX_TIME = LocalDateTime.of(9999, 1, 1, 0, 0);

    // "[CHECK_IN] Nhận kho..." → code = CHECK_IN, content = "Nhận kho..." (có log cũ dùng "-": [NO-SHOW])
    private static final Pattern ACTION_CODE_PATTERN = Pattern.compile("^\\[([A-Z0-9_-]+)\\]\\s*(.*)$", Pattern.DOTALL);

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private AdminGuard adminGuard;

    // ──────────────────────────────────────────────────────
    // Danh sách + bộ lọc + phân trang
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public PageResponse<ActivityLogResponse> getLogs(Integer actorUserId, Integer userId, String actor,
                                                     String roleName, String targetEntity, String targetId,
                                                     String keyword, LocalDate fromDate, LocalDate toDate,
                                                     int page, int size) {
        adminGuard.requireActiveAdmin(actorUserId);

        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new AdminException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Từ ngày phải trước hoặc bằng đến ngày");
        }
        // Lọc theo NGÀY: [from 00:00, to + 1 ngày 00:00) → lấy trọn ngày "đến"
        LocalDateTime from = fromDate == null ? MIN_TIME : fromDate.atStartOfDay();
        LocalDateTime to = toDate == null ? MAX_TIME : toDate.plusDays(1).atStartOfDay();

        int safePage = Math.max(page, 0);
        int safeSize = (size < 1 || size > MAX_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : size;
        // Mới nhất lên trước; cùng thời điểm thì id lớn trước → thứ tự ổn định giữa các trang
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Page<ActivityLog> result = activityLogRepository.searchLogs(from, to, userId,
                escapeLike(actor), blankToNull(roleName), blankToNull(targetEntity), blankToNull(targetId),
                escapeLike(keyword), pageable);

        List<ActivityLogResponse> content = result.getContent().stream().map(this::toResponse).toList();
        return new PageResponse<>(content, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    // ──────────────────────────────────────────────────────
    // Dropdown "Đối tượng"
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<String> getTargetEntities(Integer actorUserId) {
        adminGuard.requireActiveAdmin(actorUserId);
        return activityLogRepository.findDistinctTargetEntities();
    }

    // Dùng lại cho dashboard Admin (10 log mới nhất) — không kiểm tra quyền ở đây, bên gọi đã kiểm tra
    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getRecentLogs(int limit) {
        Pageable pageable = PageRequest.of(0, limit,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        return activityLogRepository.searchLogs(MIN_TIME, MAX_TIME, null, null, null, null, null, null, pageable)
                .getContent().stream().map(this::toResponse).toList();
    }

    // ──────────────────────────────────────────────────────
    // Hàm phụ
    // ──────────────────────────────────────────────────────
    private ActivityLogResponse toResponse(ActivityLog log) {
        User user = log.getUser();
        String code = null;
        String content = log.getAction();
        Matcher matcher = ACTION_CODE_PATTERN.matcher(log.getAction());
        if (matcher.matches()) {
            code = matcher.group(1);
            content = matcher.group(2);
        }
        return new ActivityLogResponse(log.getId(), log.getCreatedAt(),
                user.getId(), user.getFullName(), user.getEmail(), user.getRole().getName(),
                ActivityLogService.SYSTEM_EMAIL.equals(user.getEmail()),
                code, content, log.getTargetEntity(), log.getTargetId());
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    // Chuẩn bị chuỗi cho LIKE ... ESCAPE '\'. Không escape thì gõ "[CHECK_IN]" sẽ bị SQL Server hiểu
    // là "1 ký tự bất kỳ trong C,H,E,K,_,I,N" → ra kết quả sai. Tương tự % và _ là ký tự đại diện.
    private String escapeLike(String value) {
        String trimmed = blankToNull(value);
        if (trimmed == null) {
            return null;
        }
        return trimmed.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
                .replace("[", "\\[");
    }
}
