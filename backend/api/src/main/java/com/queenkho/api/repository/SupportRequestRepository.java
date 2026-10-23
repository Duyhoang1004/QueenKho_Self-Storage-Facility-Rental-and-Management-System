package com.queenkho.api.repository;

import com.queenkho.api.entity.SupportRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SupportRequestRepository extends JpaRepository<SupportRequest, Integer> {

    @Query("SELECT sr FROM SupportRequest sr " +
            "LEFT JOIN FETCH sr.contract c " +
            "LEFT JOIN FETCH c.storageUnit su " +
            "LEFT JOIN FETCH su.unitType " +
            "LEFT JOIN FETCH su.facility " +
            "JOIN FETCH sr.customer " +
            "WHERE sr.customer.id = :customerId " +
            "ORDER BY sr.id DESC")
    List<SupportRequest> findByCustomerIdWithDetails(@Param("customerId") Integer customerId);

    @Query("SELECT sr FROM SupportRequest sr " +
            "LEFT JOIN FETCH sr.contract c " +
            "LEFT JOIN FETCH c.storageUnit su " +
            "LEFT JOIN FETCH su.unitType " +
            "LEFT JOIN FETCH su.facility " +
            "JOIN FETCH sr.customer " +
            "WHERE sr.id = :id")
    Optional<SupportRequest> findDetailById(@Param("id") Integer id);

    @Query("SELECT sr FROM SupportRequest sr " +
            "LEFT JOIN FETCH sr.contract c " +
            "LEFT JOIN FETCH c.storageUnit su " +
            "LEFT JOIN FETCH su.unitType " +
            "LEFT JOIN FETCH su.facility " +
            "LEFT JOIN FETCH sr.customer " +
            "WHERE sr.id IN :ids")
    List<SupportRequest> findByIdInWithDetails(@Param("ids") Collection<Integer> ids);

    boolean existsByTicketCode(String ticketCode);

    // PR-S2: Mỗi hợp đồng tối đa 1 ticket mở / loại, tối đa 3 ticket mở
    boolean existsByContract_IdAndIssueTypeAndStatusIn(Integer contractId, String issueType, Collection<String> statuses);

    long countByContract_IdAndStatusIn(Integer contractId, Collection<String> statuses);

    List<SupportRequest> findByContract_IdAndStatusIn(Integer contractId, Collection<String> statuses);

    // PR-52: 3 ngày không phản hồi sau khi RESOLVED -> job tự động CLOSED
    List<SupportRequest> findByStatusAndResolvedAtBefore(String status, LocalDateTime cutoff);
}
