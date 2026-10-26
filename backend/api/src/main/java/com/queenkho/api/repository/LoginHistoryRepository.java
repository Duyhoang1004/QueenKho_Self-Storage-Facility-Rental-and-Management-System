package com.queenkho.api.repository;

import com.queenkho.api.entity.LoginHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Integer> {

    // Admin: lịch sử đăng nhập có bộ lọc — cùng mẹo "(:x IS NULL OR ...)" như ActivityLogRepository.
    // LEFT JOIN: lần đăng nhập sai email không có user_id.
    @Query(value = "SELECT h FROM LoginHistory h LEFT JOIN FETCH h.user u LEFT JOIN FETCH u.role r " +
                   "WHERE h.createdAt >= :from AND h.createdAt < :to " +
                   "AND (:eventType IS NULL OR h.eventType = :eventType) " +
                   "AND (:keyword IS NULL " +
                   "     OR LOWER(h.email) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\' " +
                   "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\' " +
                   "     OR h.ipAddress LIKE CONCAT('%', :keyword, '%') ESCAPE '\\')",
           countQuery = "SELECT COUNT(h) FROM LoginHistory h LEFT JOIN h.user u " +
                   "WHERE h.createdAt >= :from AND h.createdAt < :to " +
                   "AND (:eventType IS NULL OR h.eventType = :eventType) " +
                   "AND (:keyword IS NULL " +
                   "     OR LOWER(h.email) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\' " +
                   "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) ESCAPE '\\' " +
                   "     OR h.ipAddress LIKE CONCAT('%', :keyword, '%') ESCAPE '\\')")
    Page<LoginHistory> search(@Param("from") LocalDateTime from,
                              @Param("to") LocalDateTime to,
                              @Param("eventType") String eventType,
                              @Param("keyword") String keyword,
                              Pageable pageable);

    // Dashboard Admin: số lần đăng nhập thành công / thất bại từ 0h hôm nay
    long countByEventTypeAndCreatedAtGreaterThanEqual(String eventType, LocalDateTime from);
}
