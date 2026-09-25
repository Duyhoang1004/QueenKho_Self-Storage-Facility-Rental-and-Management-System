package com.queenkho.api.service;

import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.dto.CreateReservationResponse;
import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.PendingReservationResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.UnitType;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
public class ReservationService {
    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private UserRepository userRepository;

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

    @Transactional
    public CreateReservationResponse createReservation(CreateReservationRequest request) {
        // Kiem tra hop le
        if (request.getStartDate() == null || request.getStartDate().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Ngày bắt đầu không được ở quá khứ");
        }
        if (request.getDurationMonths() == null || request.getDurationMonths() <= 0) {
            throw new IllegalArgumentException("Thời gian thuê phải tối thiểu 1 tháng");
        }

        // Kiem tra khach hang
        User customer = userRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new RuntimeException("Khách hàng không tồn tại"));

        Facility facility = new Facility();
        facility.setId(request.getFacilityId());

        UnitType unitType = new UnitType();
        unitType.setId(request.getUnitTypeId());

        // Sinh ma don ngau nhien
        String reservationCode = "RES-" + (100000 + new Random().nextInt(900000));

        // Tien dat coc theo du lieu mau (500.000 VND)
        BigDecimal depositAmount = new BigDecimal("500000");

        // Khoi tao va luu don dat cho
        Reservation reservation = new Reservation();
        reservation.setReservationCode(reservationCode);
        reservation.setCustomer(customer);
        reservation.setFacility(facility);
        reservation.setUnitType(unitType);
        reservation.setStorageUnitId(null);
        reservation.setStatus("PENDING");
        reservation.setDurationMonths(request.getDurationMonths());
        reservation.setDepositAmount(depositAmount);
        reservation.setStartDate(request.getStartDate());
        reservation.setCreatedAt(LocalDateTime.now());

        Reservation saved = reservationRepository.save(reservation);

        // Tra ve ket qua tao don
        return new CreateReservationResponse(
                saved.getId(),
                saved.getReservationCode(),
                saved.getDepositAmount(),
                saved.getStatus(),
                saved.getStartDate(),
                saved.getDurationMonths(),
                "Tạo đơn đặt chỗ thành công"
        );
    }
}