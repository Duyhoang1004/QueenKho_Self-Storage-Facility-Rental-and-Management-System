package com.queenkho.api.repository;

import com.queenkho.api.entity.CompensationClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

// BR-126: hồ sơ bồi thường hàng hư / mất
public interface CompensationClaimRepository extends JpaRepository<CompensationClaim, Integer> {

    boolean existsByClaimCode(String claimCode);

    @Query("SELECT c FROM CompensationClaim c JOIN FETCH c.contract ct JOIN FETCH ct.storageUnit su JOIN FETCH su.unitType " +
            "JOIN FETCH c.customer JOIN FETCH c.supportRequest LEFT JOIN FETCH ct.reservation WHERE c.id = :id")
    Optional<CompensationClaim> findDetailById(@Param("id") Integer id);

    @Query("SELECT c FROM CompensationClaim c WHERE c.supportRequest.id = :ticketId")
    Optional<CompensationClaim> findByTicketId(@Param("ticketId") Integer ticketId);

    @Query("SELECT c FROM CompensationClaim c WHERE c.supportRequest.id IN :ticketIds")
    List<CompensationClaim> findByTicketIds(@Param("ticketIds") Collection<Integer> ticketIds);

    @Query("SELECT c FROM CompensationClaim c JOIN FETCH c.contract ct JOIN FETCH c.customer " +
            "WHERE (:facilityId IS NULL OR c.facilityId = :facilityId) ORDER BY c.id DESC")
    List<CompensationClaim> findForFacility(@Param("facilityId") Integer facilityId);
}
