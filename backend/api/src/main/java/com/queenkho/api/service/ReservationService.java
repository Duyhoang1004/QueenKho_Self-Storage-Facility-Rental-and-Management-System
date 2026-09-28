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
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.UnitTypeRepository;

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

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private UnitTypeRepository unitTypeRepository;

        // UC-12: khách hàng xem danh sách đơn đặt chỗ của chính mình (mới nhất trước)
    @Transactional(readOnly = true)
    public List<MyReservationResponse> getMyReservations(Integer customerId) {
        return reservationRepository.findByCustomer_IdOrderByCreatedAtDesc(customerId)
            .stream()
            .map(r -> new MyReservationResponse(
                r.getId(),
                r.getReservationCode(),
                r.getFacility().getName(),
                r.getUnitType().getName(),
                r.getStorageUnitId(),
                r.getStartDate(),
                r.getDurationMonths(),
                r.getDepositAmount(),
                r.getStatus(),
                r.getCreatedAt()
            ))
            .toList();
    }

    // UC-13: FM xem các đơn đã đặt cọc nhưng chưa được gán ô kho.
    // Truyền facilityId trực tiếp, hoặc managerId để hệ thống tự lấy cơ sở của quản lý đó.
    @Transactional(readOnly = true)
    public List<PendingReservationResponse> getPendingReservations(Integer facilityId, Integer managerId) {
        Integer targetFacilityId = facilityId;
        if (targetFacilityId == null && managerId != null) {
            User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại"));
            targetFacilityId = manager.getFacilityId();
        }
        if (targetFacilityId == null) {
            throw new IllegalArgumentException("Tài khoản chưa được gán cơ sở nên không xem được đơn chờ gán ô");
        }

        return reservationRepository
            .findByFacility_IdAndStatusAndStorageUnitIdIsNullOrderByCreatedAtAsc(targetFacilityId, "DEPOSIT_PAID")
            .stream()
            .map(r -> new PendingReservationResponse(
                r.getId(),
                r.getReservationCode(),
                r.getCustomer().getFullName(),
                r.getCustomer().getPhone(),
                r.getUnitType().getName(),
                r.getStartDate(),
                r.getDurationMonths(),
                r.getDepositAmount(),
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

        if (request.getFacilityId() == null || request.getUnitTypeId() == null) {
            throw new IllegalArgumentException("Vui lòng chọn cơ sở và loại kho");
        }

        // Lấy cơ sở và loại kho thật từ DB (không tạo object rỗng chỉ có id)
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new IllegalArgumentException("Cơ sở không tồn tại"));

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Loại kho không tồn tại"));

        // Sinh ma don ngau nhien
        String reservationCode = "RES-" + (100000 + new Random().nextInt(900000));

        // Tiền đặt cọc = 1 tháng giá thuê của loại kho (khớp với cách tính của cổng thanh toán SePay)
        BigDecimal depositAmount = unitType.getBasePriceMonthly();

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
