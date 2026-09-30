package com.queenkho.api.service;

import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.PendingReservationResponse;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.repository.ReservationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ReservationService {
    @Autowired
    private ReservationRepository reservationRepository;

    @Transactional(readOnly = true)
    public List<MyReservationResponse> getMyReservations(Integer customerId) {
        return reservationRepository.findByCustomer_IdOrderByCreatedAtDesc(customerId)
            .stream()
            .map(r -> new MyReservationResponse(
                r.getId(),
                r.getReservationCode(),
                r.getFacility().getName(),
                r.getUnitType().getName(),
                r.getStartDate(),
                r.getDurationMonths(),
                r.getDepositAmount(),
                r.getStatus()
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PendingReservationResponse> getPendingReservations(Integer facilityId) {
        return reservationRepository
            .findByFacility_IdAndStatusAndStorageUnitIdIsNull(facilityId, "DEPOSIT_PAID")
            .stream()
            .map(r -> new PendingReservationResponse(
                r.getId(),
                r.getReservationCode(),
                r.getCustomer().getFullName(),
                r.getUnitType().getName(),
                r.getCreatedAt()
            ))
            .toList();
    }
}