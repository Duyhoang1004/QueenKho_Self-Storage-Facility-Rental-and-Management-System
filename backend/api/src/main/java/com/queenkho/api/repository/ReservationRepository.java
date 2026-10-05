package com.queenkho.api.repository;

import com.queenkho.api.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Integer> {

        // UC-12: Lấy danh sách đơn đặt của 1 customer, mới nhất xếp trước
    List<Reservation> findByCustomer_IdOrderByCreatedAtDesc(Integer customerId);

        // UC-13: đơn đã cọc nhưng chưa gán ô, cũ nhất xếp trước (hàng đợi xử lý)
    List<Reservation> findByFacility_IdAndStatusAndStorageUnitIdIsNullOrderByCreatedAtAsc(
        Integer facilityId, String status);

    // UC-09: Đếm reservations đang pending (chưa gán ô) cho 1 facility + unitType
    int countByFacility_IdAndUnitType_IdAndStatusInAndStorageUnitIdIsNull(
        Integer facilityId, Integer unitTypeId, List<String> statuses);

    // UC-09: Đếm pending reservations grouped by unitType (dùng cho batch query)
    @Query("SELECT r.unitType.id, COUNT(r) FROM Reservation r " +
           "WHERE r.facility.id = :facilityId " +
           "AND r.status IN :statuses " +
           "AND r.storageUnitId IS NULL " +
           "GROUP BY r.unitType.id")
    List<Object[]> countPendingGroupedByUnitType(
        @Param("facilityId") Integer facilityId,
        @Param("statuses") List<String> statuses);
}