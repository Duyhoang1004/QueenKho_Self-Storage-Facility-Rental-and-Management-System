package com.queenkho.api.repository;

import com.queenkho.api.entity.HeldGoods;
import com.queenkho.api.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

// PR-Q10: hàng của khách lưu giữ sau thanh lý
public interface HeldGoodsRepository extends JpaRepository<HeldGoods, Integer> {

    // Danh sách của 1 cơ sở — fetch sẵn hợp đồng, khách, ô, người lập / xử lý để không N+1
    @Query("SELECT h FROM HeldGoods h " +
            "JOIN FETCH h.contract c " +
            "LEFT JOIN FETCH c.customer " +
            "LEFT JOIN FETCH c.storageUnit " +
            "LEFT JOIN FETCH c.reservation " +
            "LEFT JOIN FETCH h.createdBy " +
            "LEFT JOIN FETCH h.resolvedBy " +
            "WHERE h.facilityId = :facilityId AND h.status IN :statuses " +
            "ORDER BY h.holdUntil ASC, h.id ASC")
    List<HeldGoods> findBoard(@Param("facilityId") Integer facilityId,
                              @Param("statuses") Collection<String> statuses);

    @Query("SELECT h FROM HeldGoods h " +
            "JOIN FETCH h.contract c " +
            "LEFT JOIN FETCH c.customer " +
            "LEFT JOIN FETCH c.storageUnit " +
            "LEFT JOIN FETCH c.reservation " +
            "LEFT JOIN FETCH h.createdBy " +
            "LEFT JOIN FETCH h.resolvedBy " +
            "WHERE h.id = :id")
    Optional<HeldGoods> findDetailById(@Param("id") Integer id);

    Optional<HeldGoods> findFirstByContract_IdOrderByIdDesc(Integer contractId);

    Optional<HeldGoods> findFirstByTaskId(Integer taskId);

    // Chốt kết quả xử lý bằng 1 câu UPDATE có điều kiện — chống 2 người bấm cùng lúc / bấm đúp
    @Modifying(clearAutomatically = true)
    @Query("UPDATE HeldGoods h SET h.status = :status, h.resolvedNote = :note, h.resolvedBy = :actor, " +
            "h.resolvedAt = CURRENT_TIMESTAMP, h.proceedsAmount = :proceeds, h.debtOffsetAmount = :debtOffset, " +
            "h.refundAmount = :refund " +
            "WHERE h.id = :id AND h.status = 'HOLDING'")
    int resolve(@Param("id") Integer id,
                @Param("status") String status,
                @Param("note") String note,
                @Param("actor") User actor,
                @Param("proceeds") BigDecimal proceeds,
                @Param("debtOffset") BigDecimal debtOffset,
                @Param("refund") BigDecimal refund);
}
