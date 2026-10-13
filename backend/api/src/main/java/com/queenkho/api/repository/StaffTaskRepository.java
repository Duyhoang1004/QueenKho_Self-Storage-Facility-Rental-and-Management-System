package com.queenkho.api.repository;

import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface StaffTaskRepository extends JpaRepository<StaffTask, Integer> {

    // UC-16: Lấy bảng công việc
    // Left join để lấy hết luôn, cả task chưa ai nhận lẫn task có null contract (Support sau này)
    @Query("SELECT t FROM StaffTask t " +
            "LEFT JOIN FETCH t.contract c " +
            "LEFT JOIN FETCH c.customer " +
            "LEFT JOIN FETCH c.storageUnit su " +
            "LEFT JOIN FETCH su.unitType " +
            "LEFT JOIN FETCH t.staff " +
            "WHERE t.facilityId = :facilityId " +
            "AND (:status IS NULL OR t.status = :status) " +
            "ORDER BY t.dueAt ASC")
    List<StaffTask> findBoard(@Param("facilityId") Integer facilityId,
                              @Param("status") String status);

    // UC-16: chặn sinh trùng (mỗi hợp đồng chỉ có 1 task đang mở cho mỗi loại task)
    boolean existsByContractIdAndTaskTypeAndStatusIn(Integer contractId, String taskType, List<String> statuses);

    // UC-16: lấy task đang mở của 1 hợp đồng để hủy (khách gia hạn)
    List<StaffTask> findByContractIdAndTaskTypeAndStatusIn(Integer contractId, String taskType, List<String> statuses);

    // UC-16: job quá hạn đổi status thành OVERDUE
    @Modifying
    @Query("UPDATE StaffTask t SET t.status = 'OVERDUE' " +
            "WHERE t.status IN ('OPEN', 'IN_PROGRESS') AND t.dueAt < :now")
    int markOverdue(@Param("now") LocalDateTime now);

    // UC-17: nhận việc — 1 câu UPDATE có điều kiện để chống 2 người nhận cùng lúc.
    // DB khoá dòng khi UPDATE: người thứ 2 chạy sau sẽ thấy status đã là IN_PROGRESS → 0 dòng bị ảnh hưởng.
    // clearAutomatically: xoá cache Hibernate sau UPDATE để lần findById sau đọc dữ liệu mới từ DB
    @Modifying(clearAutomatically = true)
    @Query("UPDATE StaffTask t SET t.status = 'IN_PROGRESS', t.staff = :staff, t.claimedAt = :now " +
            "WHERE t.id = :taskId AND t.status = 'OPEN' AND t.staff IS NULL AND t.dueAt > :now")
    int claim(@Param("taskId") Integer taskId,
              @Param("staff") User staff,
              @Param("now") LocalDateTime now);

    // UC-17: Manager gỡ người nhận → task về OPEN cho nhân viên khác nhận
    @Modifying(clearAutomatically = true)
    @Query("UPDATE StaffTask t SET t.status = 'OPEN', t.staff = NULL, t.claimedAt = NULL " +
            "WHERE t.id = :taskId AND t.status = 'IN_PROGRESS'")
    int unassign(@Param("taskId") Integer taskId);
}
