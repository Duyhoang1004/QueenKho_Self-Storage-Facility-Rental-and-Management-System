package com.queenkho.api.repository;

import com.queenkho.api.entity.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Integer> {

    // UC-31 / PR-A11: danh sách log có bộ lọc tuỳ chọn — cùng mẹo "(:x IS NULL OR ...)" như UserRepository.searchUsers.
    // - JOIN FETCH user + role: lấy luôn tên / email / role người thao tác trong 1 query (tránh N+1 vì user là LAZY).
    // - countQuery viết riêng: Spring không tự đếm được query có JOIN FETCH (FETCH trong COUNT là lỗi).
    // - from / to luôn có giá trị (service tự điền mốc rất xa) → không truyền null cho kiểu ngày giờ.
    // - LIKE ... ESCAPE '\': SQL Server coi '[' là ký tự đặc biệt của LIKE → service escape trước khi truyền vào.
    @Query(value = "SELECT l FROM ActivityLog l JOIN FETCH l.user u JOIN FETCH u.role r " +
                   "WHERE l.createdAt >= :from AND l.createdAt < :to " +
                   "AND (:userId IS NULL OR u.id = :userId) " +
                   "AND (:actor IS NULL " +
                   "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :actor, '%')) ESCAPE '\\' " +
                   "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :actor, '%')) ESCAPE '\\') " +
                   "AND (:roleName IS NULL OR r.name = :roleName) " +
                   "AND (:targetEntity IS NULL OR l.targetEntity = :targetEntity) " +
                   "AND (:targetId IS NULL OR l.targetId = :targetId) " +
                   "AND (:keyword IS NULL OR LOWER(l.action) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\')",
           countQuery = "SELECT COUNT(l) FROM ActivityLog l JOIN l.user u JOIN u.role r " +
                   "WHERE l.createdAt >= :from AND l.createdAt < :to " +
                   "AND (:userId IS NULL OR u.id = :userId) " +
                   "AND (:actor IS NULL " +
                   "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :actor, '%')) ESCAPE '\\' " +
                   "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :actor, '%')) ESCAPE '\\') " +
                   "AND (:roleName IS NULL OR r.name = :roleName) " +
                   "AND (:targetEntity IS NULL OR l.targetEntity = :targetEntity) " +
                   "AND (:targetId IS NULL OR l.targetId = :targetId) " +
                   "AND (:keyword IS NULL OR LOWER(l.action) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\')")
    Page<ActivityLog> searchLogs(@Param("from") LocalDateTime from,
                                 @Param("to") LocalDateTime to,
                                 @Param("userId") Integer userId,
                                 @Param("actor") String actor,
                                 @Param("roleName") String roleName,
                                 @Param("targetEntity") String targetEntity,
                                 @Param("targetId") String targetId,
                                 @Param("keyword") String keyword,
                                 Pageable pageable);

    // UC-31: các loại đối tượng đang có trong log → dropdown lọc (không cần sửa FE khi có bảng mới được log)
    @Query("SELECT DISTINCT l.targetEntity FROM ActivityLog l WHERE l.targetEntity IS NOT NULL ORDER BY l.targetEntity")
    List<String> findDistinctTargetEntities();

    // Dashboard Admin: số log từ 0h hôm nay
    long countByCreatedAtGreaterThanEqual(LocalDateTime from);
}
