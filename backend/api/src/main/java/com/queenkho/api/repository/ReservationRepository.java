package com.queenkho.api.repository;

import com.queenkho.api.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Integer> {

    List<Reservation> findByCustomer_IdOrderByCreatedAtDesc(Integer customerId);

    List<Reservation> findByFacility_IdAndStatusAndStorageUnitIdIsNull(
        Integer facilityId, String status);
}