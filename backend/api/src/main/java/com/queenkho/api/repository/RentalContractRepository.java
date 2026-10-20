package com.queenkho.api.repository;

import com.queenkho.api.entity.RentalContract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface RentalContractRepository extends JpaRepository<RentalContract, Integer> {

    // Lấy tất cả hợp đồng theo facilityId
    @Query("SELECT rc FROM RentalContract rc JOIN FETCH rc.customer JOIN FETCH rc.storageUnit su JOIN FETCH su.unitType JOIN FETCH rc.reservation WHERE su.facility.id = :facilityId ORDER BY rc.id DESC")
    List<RentalContract> findAllByFacilityId(@Param("facilityId") Integer facilityId);

    // Lấy hợp đồng theo managerId (thông qua facility_id của user đó)
    @Query("SELECT rc FROM RentalContract rc JOIN FETCH rc.customer JOIN FETCH rc.storageUnit su JOIN FETCH su.unitType JOIN FETCH su.facility JOIN FETCH rc.reservation WHERE su.facility.id = (SELECT u.facilityId FROM User u WHERE u.id = :managerId)")
    List<RentalContract> findAllByManagerId(@Param("managerId") Integer managerId);

    // Hợp đồng của 1 khách hàng (customer xem HĐ của mình)
    @Query("SELECT rc FROM RentalContract rc JOIN FETCH rc.customer JOIN FETCH rc.storageUnit su JOIN FETCH su.unitType JOIN FETCH su.facility JOIN FETCH rc.reservation WHERE rc.customer.id = :customerId ORDER BY rc.id DESC")
    List<RentalContract> findAllByCustomerId(@Param("customerId") Integer customerId);

    // Hợp đồng theo reservationId (1 reservation → 1 contract)
    @Query("SELECT rc FROM RentalContract rc JOIN FETCH rc.customer JOIN FETCH rc.storageUnit su JOIN FETCH su.unitType JOIN FETCH su.facility JOIN FETCH rc.reservation WHERE rc.reservation.id = :reservationId")
    Optional<RentalContract> findByReservationId(@Param("reservationId") Integer reservationId);

    // Chi tiết 1 hợp đồng
    @Query("SELECT rc FROM RentalContract rc JOIN FETCH rc.customer JOIN FETCH rc.storageUnit su JOIN FETCH su.unitType JOIN FETCH su.facility JOIN FETCH rc.reservation WHERE rc.id = :id")
    Optional<RentalContract> findDetailById(@Param("id") Integer id);

    // UC-18: PIN / thẻ RFID không được trùng với hợp đồng còn hiệu lực
    boolean existsByAccessPinCodeAndStatusIn(String accessPinCode, List<String> statuses);

    boolean existsByRfidCardCodeAndStatusIn(String rfidCardCode, List<String> statuses);

    // Tự động chuyển các hợp đồng ACTIVE có ngày kết thúc trước hôm nay sang OVERDUE
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("UPDATE RentalContract rc SET rc.status = 'OVERDUE' WHERE rc.status = 'ACTIVE' AND rc.endDate < :today")
    int markOverdueContracts(@Param("today") java.time.LocalDate today);

    // UC-08 / PR-A5: khách còn hợp đồng đang hiệu lực không
    boolean existsByCustomer_IdAndStatusIn(Integer customerId, List<String> statuses);
}
