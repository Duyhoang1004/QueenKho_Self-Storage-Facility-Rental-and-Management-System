package com.queenkho.api.repository;

import com.queenkho.api.entity.StaffTask;
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
}
