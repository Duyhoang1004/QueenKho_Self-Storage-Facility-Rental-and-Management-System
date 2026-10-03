package com.queenkho.api.service;

import com.queenkho.api.dto.CancelPreviewResponse;
import com.queenkho.api.dto.CancelReservationRequest;
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

    @Autowired
    private com.queenkho.api.repository.StorageUnitRepository storageUnitRepository;

    @Autowired
    private com.queenkho.api.repository.RentalContractRepository rentalContractRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    // UC-12: khách hàng xem danh sách đơn đặt chỗ của chính mình (mới nhất trước)
    @Transactional(readOnly = true)
    public List<MyReservationResponse> getMyReservations(Integer customerId) {
        return reservationRepository.findByCustomer_IdOrderByCreatedAtDesc(customerId)
                .stream()
                .map(r -> {
                    LocalDate endDate = null;
                    String effectiveStatus = r.getStatus();
                    if ("UNIT_ASSIGNED".equals(r.getStatus()) || "TERMINATION_PENDING".equals(r.getStatus())) {
                        var contractOpt = rentalContractRepository.findByReservationId(r.getId());
                        if (contractOpt.isPresent()) {
                            var contract = contractOpt.get();
                            endDate = contract.getEndDate();
                            if ("TERMINATION_PENDING".equals(contract.getStatus())) {
                                effectiveStatus = "TERMINATION_PENDING";
                            }
                        }
                    }
                    if (endDate == null && r.getStartDate() != null && r.getDurationMonths() != null) {
                        endDate = r.getStartDate().plusMonths(r.getDurationMonths());
                    }
                    return new MyReservationResponse(
                            r.getId(),
                            r.getReservationCode(),
                            r.getFacility().getName(),
                            r.getUnitType().getName(),
                            r.getStorageUnitId(),
                            r.getStartDate(),
                            r.getDurationMonths(),
                            r.getDepositAmount(),
                            effectiveStatus,
                            r.getCreatedAt(),
                            endDate);
                })
                .toList();
    }

    // UC-13: FM xem các đơn đã đặt cọc nhưng chưa được gán ô kho.
    // Truyền facilityId trực tiếp, hoặc managerId để hệ thống tự lấy cơ sở của quản
    // lý đó.
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
                        r.getCreatedAt()))
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

        // Tiền đặt cọc = 1 tháng giá thuê của loại kho (khớp với cách tính của cổng
        // thanh toán SePay)
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
        // Gán mặc định số tiền đã thanh toán là 0 khi vừa mới tạo đơn
        reservation.setTotalDepositPaid(java.math.BigDecimal.ZERO);
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
                "Tạo đơn đặt chỗ thành công");
    }

    // UC-14: Lấy danh sách ô kho trống phù hợp để cấp quyền gán
    @Transactional(readOnly = true)
    public List<com.queenkho.api.dto.StorageUnitResponse> getAvailableUnitsForReservation(Integer reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn đặt chỗ không tồn tại"));

        Integer facilityId = reservation.getFacility().getId();
        Integer unitTypeId = reservation.getUnitType().getId();

        List<com.queenkho.api.entity.StorageUnit> units = storageUnitRepository
                .findByFacility_IdAndUnitType_IdAndStatus(facilityId, unitTypeId, "AVAILABLE");
        if (units.isEmpty()) {
            units = storageUnitRepository.findByFacility_IdAndStatus(facilityId, "AVAILABLE");
        }

        return units.stream()
                .map(su -> new com.queenkho.api.dto.StorageUnitResponse(
                        su.getId(),
                        su.getUnitType().getName(),
                        su.getUnitType().getAreaSqm(),
                        su.getFloor(),
                        su.getZone(),
                        su.getRoomNumber(),
                        su.getStatus()))
                .toList();
    }

    // UC-14: Quản lý xác nhận gán ô kho thực tế
    @Transactional
    public void assignStorageUnit(Integer reservationId, com.queenkho.api.dto.AssignUnitRequest request) {
        if (request == null || request.getStorageUnitId() == null || request.getStorageUnitId().isBlank()) {
            throw new IllegalArgumentException("Vui lòng chọn ô kho thực tế");
        }

        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Đơn đặt chỗ không tồn tại"));

        if (!"DEPOSIT_PAID".equalsIgnoreCase(reservation.getStatus())) {
            throw new IllegalStateException("Đơn đặt chỗ chưa thanh toán cọc hoặc đã được gán ô");
        }

        com.queenkho.api.entity.StorageUnit storageUnit = storageUnitRepository.findById(request.getStorageUnitId())
                .orElseThrow(() -> new IllegalArgumentException("Ô kho không tồn tại"));

        if (!"AVAILABLE".equalsIgnoreCase(storageUnit.getStatus())) {
            throw new IllegalStateException("Ô kho này hiện không khả dụng (đã có người thuê hoặc đang bảo trì)");
        }

        // Cập nhật ô kho
        storageUnit.setStatus("OCCUPIED");
        storageUnitRepository.save(storageUnit);

        // Cập nhật đơn đặt chỗ
        reservation.setStorageUnitId(storageUnit.getId());
        reservation.setStatus("UNIT_ASSIGNED");

        reservationRepository.save(reservation);

        com.queenkho.api.entity.RentalContract contract = new com.queenkho.api.entity.RentalContract();
        String contractCode = "HD-" + (100000 + new java.util.Random().nextInt(900000));
        contract.setContractCode(contractCode);
        contract.setReservation(reservation);
        contract.setCustomer(reservation.getCustomer());
        contract.setStorageUnit(storageUnit);
        
        // Lấy chính sách của chính cơ sở đó từ DB
        Integer facilityId = reservation.getFacility().getId();
        Integer activePolicyId;
        try {
            activePolicyId = jdbcTemplate.queryForObject(
                    "SELECT TOP 1 id FROM rental_policy WHERE facility_id = ? ORDER BY id DESC",
                    Integer.class,
                    facilityId);
        } catch (Exception e) {
            activePolicyId = 1; // Fallback an toàn nếu cơ sở chưa kịp tạo chính sách
        }

        contract.setRentalPolicyId(activePolicyId);
        contract.setStartDate(reservation.getStartDate());
        if (reservation.getDurationMonths() != null) {
            contract.setEndDate(reservation.getStartDate().plusMonths(reservation.getDurationMonths()));
        }
        contract.setBillingCycleMonths(1);
        if (reservation.getDepositAmount() != null) {
            contract.setDepositHeldAmount(reservation.getDepositAmount());
        } else {
            contract.setDepositHeldAmount(java.math.BigDecimal.ZERO);
        }
        contract.setStatus("ACTIVE");
        rentalContractRepository.save(contract);
    }

    public CancelPreviewResponse previewCancel(Integer reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));

        LocalDateTime appointmentTime = reservation.getExpectedAppointmentTime();
        if (appointmentTime == null) {
            // Nếu chưa có giờ hẹn chi tiết trong DB, mặc định lấy 09:00 sáng ngày bắt đầu
            appointmentTime = reservation.getStartDate().atTime(9, 0);
        }
        java.math.BigDecimal deposit = reservation.getDepositAmount() != null ? reservation.getDepositAmount()
                : java.math.BigDecimal.ZERO;
        java.math.BigDecimal penalty;
        java.math.BigDecimal refund;
        // So sánh thời gian hiện tại với (Giờ nhận phòng - 24 giờ)
        if (LocalDateTime.now().plusHours(24).isBefore(appointmentTime)) {
            // TH1: Hủy hợp lệ (Trước 24h)
            penalty = java.math.BigDecimal.ZERO;
            refund = deposit;
        } else {
            // TH2: Hủy trễ (Trong vòng 24h hoặc trễ hơn) -> Phạt 50% cọc
            penalty = deposit.multiply(new java.math.BigDecimal("0.5"));
            refund = deposit.subtract(penalty);
        }

        return new CancelPreviewResponse(deposit, penalty, refund, appointmentTime);
    }

    @org.springframework.transaction.annotation.Transactional
    public void cancelReservation(Integer reservationId, CancelReservationRequest request) {

        // 1. Tìm đơn trong DB
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));

        // 2. Kiểm tra trạng thái hợp lệ để hủy
        if (!"DEPOSIT_PAID".equals(reservation.getStatus()) && !"PENDING".equals(reservation.getStatus())) {
            throw new IllegalStateException("Trạng thái đơn không hợp lệ để hủy");
        }

        boolean wasDepositPaid = "DEPOSIT_PAID".equals(reservation.getStatus());

        // 3. Cập nhật trạng thái đơn thành CANCELLED
        reservation.setStatus("CANCELLED");
        reservationRepository.save(reservation);

        // 4. Nếu khách đã đóng cọc -> Tính hoàn cọc và tạo phiếu REFUND
        CancelPreviewResponse preview = null;
        if (wasDepositPaid) {
            preview = previewCancel(reservationId);
            java.math.BigDecimal refundAmount = preview.getRefundAmount();

            String txnCode = "REF-" + reservation.getReservationCode()
                    + "-" + (System.currentTimeMillis() % 100000);

            jdbcTemplate.update(
                    "INSERT INTO payment_transactions " +
                            "(transaction_code, reservation_id, user_id, amount, payment_type, payment_method, status, paid_at) "
                            +
                            "VALUES (?, ?, ?, ?, 'REFUND', 'BANK_TRANSFER', 'PENDING', SYSDATETIME())",
                    txnCode,
                    reservation.getId(),
                    reservation.getCustomer().getId(),
                    refundAmount);
        }

        // 5. Ghi vết hệ thống vào activity_logs (kèm nội dung task cho nhân viên)
        String actionLog = "Hủy đặt chỗ " + reservation.getReservationCode()
                + ". Lý do: " + request.getReason();

        if (request.getOtherReason() != null && !request.getOtherReason().trim().isEmpty()) {
            actionLog += " (" + request.getOtherReason().trim() + ")";
        }

        if (wasDepositPaid && preview != null) {
            boolean hasBankInfo = request.getBankName() != null
                    && !request.getBankName().trim().isEmpty();
            if (hasBankInfo) {
                actionLog += ". [HOÀN CỌC - CK] Chuyển tiền về tài khoản: "
                        + request.getBankName().trim()
                        + " - STK: " + request.getBankAccountNumber().trim()
                        + " - " + request.getBankAccountName().trim()
                        + ". Số tiền: " + preview.getRefundAmount().toPlainString() + " VND.";
            } else {
                actionLog += ". [HOÀN CỌC - TIỀN MẶT] Khách nhận hoàn cọc trực tiếp tại quầy."
                        + " Số tiền: " + preview.getRefundAmount().toPlainString() + " VND."
                        + " Liên hệ khách để xếp lịch.";
            }
        }

        if (actionLog.length() > 500) {
            actionLog = actionLog.substring(0, 497) + "...";
        }

        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                reservation.getCustomer().getId(),
                actionLog,
                reservation.getId());
    }
}
