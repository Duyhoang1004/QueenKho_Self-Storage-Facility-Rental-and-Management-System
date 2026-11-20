package com.queenkho.api.repository;

import com.queenkho.api.entity.CheckoutSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

// D-21 / PR-O19: bảng quyết toán trả kho
public interface CheckoutSettlementRepository extends JpaRepository<CheckoutSettlement, Integer> {

    /** Vòng mới nhất của hợp đồng (kể cả đã COMPLETED) */
    Optional<CheckoutSettlement> findTopByContract_IdOrderByRoundNoDesc(Integer contractId);

    /** Mọi vòng của hợp đồng, mới nhất trước — để hiện lịch sử khiếu nại */
    List<CheckoutSettlement> findByContract_IdOrderByRoundNoDesc(Integer contractId);

    Optional<CheckoutSettlement> findTopByContract_IdAndStatusInOrderByRoundNoDesc(Integer contractId, Collection<String> statuses);

    Optional<CheckoutSettlement> findByDebtTransactionId(Integer debtTransactionId);

    Optional<CheckoutSettlement> findByRefundTaskId(Integer refundTaskId);

    @Query("SELECT s FROM CheckoutSettlement s JOIN FETCH s.contract c JOIN FETCH c.customer JOIN FETCH c.storageUnit su " +
            "WHERE su.facility.id = :facilityId AND s.status IN :statuses ORDER BY s.id DESC")
    List<CheckoutSettlement> findForFacility(@Param("facilityId") Integer facilityId,
                                             @Param("statuses") Collection<String> statuses);

    /** PR-O23: quyết toán dương chờ khách quá hạn → job tự xác nhận */
    @Query("SELECT s FROM CheckoutSettlement s WHERE s.status = 'WAITING_CUSTOMER' AND s.netAmount >= 0 AND s.createdAt <= :before")
    List<CheckoutSettlement> findAutoConfirmDue(@Param("before") LocalDateTime before);

    /** PR-O23: quyết toán âm chưa trả → nhắc 1 / 3 / 7 ngày */
    @Query("SELECT s FROM CheckoutSettlement s JOIN FETCH s.contract c JOIN FETCH c.customer " +
            "WHERE s.netAmount < 0 AND s.status IN ('WAITING_CUSTOMER', 'AWAITING_PAYMENT')")
    List<CheckoutSettlement> findUnpaidNegative();

    /** PR-Q12: khách còn quyết toán âm chưa xong thì không đặt kho mới */
    @Query("SELECT COUNT(s) FROM CheckoutSettlement s WHERE s.contract.customer.id = :customerId AND s.netAmount < 0 " +
            "AND s.status NOT IN ('SUPERSEDED', 'COMPLETED')")
    long countOpenNegativeForCustomer(@Param("customerId") Integer customerId);
}
