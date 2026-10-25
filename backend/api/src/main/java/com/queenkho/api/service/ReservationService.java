package com.queenkho.api.service;

import com.queenkho.api.dto.CancelPreviewResponse;
import com.queenkho.api.dto.CancelReservationRequest;
import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.dto.CreateReservationResponse;
import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.NoShowEligibility;
import com.queenkho.api.dto.NoShowRequest;
import com.queenkho.api.dto.PendingReservationResponse;
import com.queenkho.api.exception.StaffTaskException;
import org.springframework.http.HttpStatus;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.StaffTask;
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
import java.util.Map;
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

    @Autowired
    private StaffTaskService staffTaskService;

    @Autowired
    private com.queenkho.api.repository.StaffTaskRepository staffTaskRepository;

    // UC-12: khách hàng xem danh sách đơn đặt chỗ của chính mình (mới nhất trước)
    @Transactional(readOnly = true)
    public List<MyReservationResponse> getMyReservations(Integer customerId) {
        return reservationRepository.findByCustomer_IdOrderByCreatedAtDesc(customerId)
                .stream()
                .map(r -> {
                    // 1. Tính tổng tiền thực tế khách đã thanh toán thành công từ
                    // payment_transactions
                    BigDecimal actualTotalPaid;
                    try {
                        actualTotalPaid = jdbcTemplate.queryForObject(
                                "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                                        "WHERE (reservation_id = ? OR contract_id IN (SELECT id FROM rental_contracts WHERE reservation_id = ?)) "
                                        +
                                        "AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                                BigDecimal.class,
                                r.getId(), r.getId());
                    } catch (Exception e) {
                        actualTotalPaid = BigDecimal.ZERO;
                    }

                    // 2. Lấy contractId và endDate nếu đơn đã có hợp đồng
                    Integer contractId = null;
                    LocalDate contractEndDate = null;
                    try {
                        var contractRow = jdbcTemplate.queryForMap(
                                "SELECT TOP 1 id, end_date FROM rental_contracts WHERE reservation_id = ?",
                                r.getId());
                        contractId = (Integer) contractRow.get("id");
                        var ed = contractRow.get("end_date");
                        if (ed instanceof java.sql.Date) {
                            contractEndDate = ((java.sql.Date) ed).toLocalDate();
                        } else if (ed instanceof LocalDate) {
                            contractEndDate = (LocalDate) ed;
                        }
                    } catch (Exception ignored) {
                    }

                    // 3. Đồng bộ trạng thái từ hợp đồng nếu HĐ đang TERMINATION_PENDING
                    String displayStatus = r.getStatus();
                    try {
                        String cStatus = jdbcTemplate.queryForObject(
                                "SELECT TOP 1 status FROM rental_contracts WHERE reservation_id = ?",
                                String.class,
                                r.getId());
                        if ("TERMINATION_PENDING".equalsIgnoreCase(cStatus)) {
                            displayStatus = "TERMINATION_PENDING";
                        }
                    } catch (Exception ignored) {
                    }

                    // Trạng thái hiển thị theo giao dịch hoàn tiền và task hoàn tiền
                    Integer openRefundTasks = 0;
                    Integer completedRefundTasks = 0;
                    try {
                        openRefundTasks = jdbcTemplate.queryForObject(
                                "SELECT COUNT(1) FROM facility_tasks WHERE task_type = 'REFUND' AND status IN ('OPEN', 'CLAIMED', 'PENDING', 'OVERDUE') AND note LIKE ?",
                                Integer.class,
                                "%" + r.getReservationCode() + "%");
                        completedRefundTasks = jdbcTemplate.queryForObject(
                                "SELECT COUNT(1) FROM facility_tasks WHERE task_type = 'REFUND' AND status = 'COMPLETED' AND note LIKE ?",
                                Integer.class,
                                "%" + r.getReservationCode() + "%");
                    } catch (Exception ignored) {
                    }

                    if (openRefundTasks != null && openRefundTasks > 0) {
                        // Vẫn còn task hoàn tiền đang mở / chờ Manager xử lý -> BẮT BUỘC LÀ REFUND_PENDING (Chờ hoàn tiền)
                        displayStatus = "REFUND_PENDING";
                    } else if (completedRefundTasks != null && completedRefundTasks > 0) {
                        // Manager đã bấm xác nhận hoàn tất task hoàn tiền -> ĐÃ HOÀN TIỀN
                        displayStatus = "REFUNDED";
                    } else {
                        // Nếu không gắn với task trong facility_tasks, fallback theo payment_transactions hoặc r.getStatus()
                        try {
                            String refundStatus = jdbcTemplate.queryForObject(
                                    "SELECT TOP 1 status FROM payment_transactions WHERE reservation_id = ? AND payment_type = 'REFUND' ORDER BY id DESC",
                                    String.class,
                                    r.getId());
                            if ("SUCCESS".equalsIgnoreCase(refundStatus)) {
                                displayStatus = "REFUNDED";
                            } else if ("PENDING".equalsIgnoreCase(refundStatus)) {
                                displayStatus = "REFUND_PENDING";
                            }
                        } catch (Exception ignored) {
                        }
                    }

                    return new MyReservationResponse(
                            r.getId(),
                            r.getReservationCode(),
                            r.getCustomer().getFullName(),
                            r.getCustomer().getPhone(),
                            r.getFacility().getName(),
                            r.getFacility().getAddress(),
                            r.getUnitType().getName(),
                            r.getUnitType().getAreaSqm(),
                            r.getUnitType().getDimensions(),
                            r.getStorageUnitId(),
                            r.getStartDate(),
                            r.getDurationMonths(),
                            r.getDepositAmount(),
                            displayStatus,
                            r.getCreatedAt(),
                            contractEndDate,
                            actualTotalPaid,
                            contractId);
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

    // [EXCEPTION] No-Show: lấy đơn đã gán ô nhưng startDate đã qua (khách không đến nhận)
    @Transactional(readOnly = true)
    public List<PendingReservationResponse> getOverdueNoShowReservations(Integer facilityId, Integer managerId) {
        Integer targetFacilityId = facilityId;
        if (targetFacilityId == null && managerId != null) {
            User manager = userRepository.findById(managerId)
                    .orElseThrow(() -> new IllegalArgumentException("Người dùng không tồn tại"));
            targetFacilityId = manager.getFacilityId();
        }
        if (targetFacilityId == null) {
            throw new IllegalArgumentException("Tài khoản chưa được gán cơ sở");
        }
        return reservationRepository
                .findOverdueNoShowByFacility(targetFacilityId, LocalDate.now())
                .stream()
                .map(r -> {
                    String staffNote = null;
                    String staffName = null;
                    try {
                        var contractOpt = rentalContractRepository.findByReservationId(r.getId());
                        if (contractOpt.isPresent()) {
                            var tasks = staffTaskRepository.findByContractIdAndTaskTypeAndStatusIn(
                                    contractOpt.get().getId(), "CHECK_IN", List.of("OPEN", "IN_PROGRESS", "OVERDUE", "COMPLETED", "CANCELLED"));
                            if (!tasks.isEmpty()) {
                                StaffTask task = tasks.get(0);
                                staffNote = task.getNote();
                                if (task.getStaff() != null) {
                                    staffName = task.getStaff().getFullName();
                                }
                            }
                        }
                    } catch (Exception ignored) {
                    }
                    NoShowEligibility eligibility = evaluateNoShowEligibility(r);
                    return new PendingReservationResponse(
                            r.getId(),
                            r.getReservationCode(),
                            r.getCustomer().getFullName(),
                            r.getCustomer().getPhone(),
                            r.getUnitType().getName(),
                            r.getStartDate(),
                            r.getDurationMonths(),
                            r.getDepositAmount(),
                            r.getCreatedAt(),
                            staffNote,
                            staffName,
                            eligibility.eligible(),
                            eligibility.failedCount(),
                            eligibility.reason());
                })
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

        // PR-B3 / PR-Q12: Kiểm tra nợ của khách hàng trước khi cho phép đặt chỗ mới
        Map<String, Object> debtCheck = jdbcTemplate.queryForMap(
                "SELECT " +
                        "  (SELECT COUNT(1) FROM rental_contracts WHERE customer_id = ? AND status = 'OVERDUE') AS overdue_count, " +
                        "  (SELECT COUNT(1) FROM payment_transactions WHERE (user_id = ? OR contract_id IN (SELECT id FROM rental_contracts WHERE customer_id = ?)) AND payment_type = 'DAMAGE_FEE' AND status = 'PENDING') AS damage_count",
                customer.getId(), customer.getId(), customer.getId()
        );
        int overdueCount = ((Number) debtCheck.get("overdue_count")).intValue();
        int damageCount = ((Number) debtCheck.get("damage_count")).intValue();

        if (overdueCount > 0 || damageCount > 0) {
            throw new com.queenkho.api.exception.ReservationException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "CUSTOMER_HAS_DEBT",
                    "Quý khách đang có hợp đồng quá hạn hoặc khoản bồi thường thiệt hại (DAMAGE_FEE) chưa thanh toán. Vui lòng thanh toán khoản nợ trước khi đặt chỗ kho mới."
            );
        }

        if (request.getFacilityId() == null || request.getUnitTypeId() == null) {
            throw new IllegalArgumentException("Vui lòng chọn cơ sở và loại kho");
        }

        // Lấy cơ sở và loại kho thật từ DB (không tạo object rỗng chỉ có id)
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new IllegalArgumentException("Cơ sở không tồn tại"));

        UnitType unitType = unitTypeRepository.findById(request.getUnitTypeId())
                .orElseThrow(() -> new IllegalArgumentException("Loại kho không tồn tại"));

        // PR-M4: INACTIVE ẩn khỏi tìm kiếm & đặt chỗ
        if ("INACTIVE".equalsIgnoreCase(unitType.getStatus())) {
            throw new IllegalArgumentException("Loại kho này hiện đang tạm ngưng nhận đặt chỗ mới");
        }

        // Sinh ma don ngau nhien
        String reservationCode = "RES-" + (100000 + new Random().nextInt(900000));

        // PR-M6: chốt tiền cọc theo chính sách hiện hành của cơ sở ngay lúc tạo đơn.
        // VNPAY về sau chỉ đọc reservations.deposit_amount, không tính lại theo chính sách mới.
        Integer depositMultiplier = jdbcTemplate.query(
                "SELECT TOP 1 deposit_month_multiplier FROM rental_policy WHERE facility_id = ? ORDER BY id DESC",
                rs -> rs.next() ? rs.getInt("deposit_month_multiplier") : 1,
                facility.getId());
        int safeMultiplier = depositMultiplier != null && depositMultiplier > 0 ? depositMultiplier : 1;
        BigDecimal depositAmount = unitType.getBasePriceMonthly().multiply(BigDecimal.valueOf(safeMultiplier));

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
        reservation.setExpectedAppointmentTime(request.getStartDate().atTime(9, 0));
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
        if (reservation.getDurationMonths() != null && reservation.getDurationMonths() > 0) {
            contract.setEndDate(reservation.getStartDate().plusMonths(reservation.getDurationMonths()));
            contract.setBillingCycleMonths(reservation.getDurationMonths());
        } else {
            contract.setBillingCycleMonths(1);
        }
        if (reservation.getDepositAmount() != null) {
            contract.setDepositHeldAmount(reservation.getDepositAmount());
        } else {
            contract.setDepositHeldAmount(java.math.BigDecimal.ZERO);
        }
        // UC-16: hợp đồng chờ nhân viên check-in, check-in xong (UC-18) mới ACTIVE
        contract.setStatus("PENDING_CHECK_IN");
        rentalContractRepository.save(contract);

        staffTaskService.createCheckInTask(contract);
    }

    public CancelPreviewResponse previewCancel(Integer reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));

        // 🌟 1. LẤY MỐC GIỜ HẸN: NẾU NULL THÌ BẮT BUỘC LẤY 09:00 SÁNG NGÀY BẮT ĐẦU
        LocalDateTime appointmentTime = reservation.getExpectedAppointmentTime();
        if (appointmentTime == null && reservation.getStartDate() != null) {
            appointmentTime = reservation.getStartDate().atTime(9, 0);
        }

        // 1. LẤY TỔNG TIỀN THỰC TẾ KHÁCH ĐÃ ĐÓNG TỪ PAYMENT_TRANSACTIONS
        BigDecimal totalPaid;
        try {
            totalPaid = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                            "WHERE reservation_id = ? AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                    BigDecimal.class,
                    reservationId);
        } catch (Exception e) {
            totalPaid = BigDecimal.ZERO;
        }

        // Tiền cọc gốc (dùng để tính phạt nếu hủy trễ)
        BigDecimal deposit = reservation.getDepositAmount() != null ? reservation.getDepositAmount() : BigDecimal.ZERO;

        // Chỉ fallback cho dữ liệu cũ đã ở trạng thái ĐÃ CỌC nhưng chưa có
        // payment_transactions. Đơn PENDING chưa thanh toán tuyệt đối không được
        // lấy tiền cọc dự kiến làm tiền đã đóng.
        if (totalPaid.compareTo(BigDecimal.ZERO) == 0
                && "DEPOSIT_PAID".equals(reservation.getStatus())) {
            totalPaid = reservation.getTotalDepositPaid() != null
                    && reservation.getTotalDepositPaid().compareTo(BigDecimal.ZERO) > 0
                            ? reservation.getTotalDepositPaid()
                            : deposit;
        }

        BigDecimal penalty;
        BigDecimal refund;

        // Chưa thu tiền thì không phạt và không phát sinh hoàn tiền.
        if (totalPaid.compareTo(BigDecimal.ZERO) <= 0) {
            penalty = BigDecimal.ZERO;
            refund = BigDecimal.ZERO;
        // 2. TÍNH TOÁN HOÀN TIỀN DỰA TRÊN MỐC 24H
        } else if (appointmentTime != null
                && LocalDateTime.now().plusHours(24).isBefore(appointmentTime)) {
            // TH1: HỦY SỚM (Trước 24h) -> Hoàn 100% TOÀN BỘ TIỀN ĐÃ ĐÓNG (Cọc + Tiền thuê)
            penalty = BigDecimal.ZERO;
            refund = totalPaid;
        } else {
            // TH2: HỦY TRỄ (Trong vòng 24h) -> Chỉ phạt 50% TIỀN CỌC, tiền thuê hoàn lại
            // 100%
            penalty = deposit.multiply(new BigDecimal("0.5"));
            refund = totalPaid.compareTo(penalty) >= 0 ? totalPaid.subtract(penalty) : BigDecimal.ZERO;
        }

        return new CancelPreviewResponse(totalPaid, penalty, refund, appointmentTime);
    }

    @org.springframework.transaction.annotation.Transactional
    public void cancelReservation(Integer reservationId, CancelReservationRequest request) {

        // 1. Tìm đơn trong DB
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));

        // 2. Kiểm tra trạng thái hợp lệ
        if (!"DEPOSIT_PAID".equals(reservation.getStatus()) && !"PENDING".equals(reservation.getStatus())) {
            throw new IllegalStateException("Trạng thái đơn không hợp lệ để hủy");
        }

        BigDecimal actualDepositOrTotalPaid = BigDecimal.ZERO;
        try {
            actualDepositOrTotalPaid = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                            "WHERE reservation_id = ? AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                    BigDecimal.class,
                    reservationId);
        } catch (Exception ignored) {
        }

        boolean wasDepositPaid = "DEPOSIT_PAID".equals(reservation.getStatus())
                || (actualDepositOrTotalPaid != null && actualDepositOrTotalPaid.compareTo(BigDecimal.ZERO) > 0);

        // 3. Cập nhật trạng thái đơn: nếu đã cọc -> REFUND_PENDING (Chờ hoàn tiền), nếu chưa cọc -> CANCELLED (Đã hủy)
        reservation.setStatus(wasDepositPaid ? "REFUND_PENDING" : "CANCELLED");
        reservationRepository.save(reservation);

        // 4. Nếu khách đã đóng cọc -> Tạo giao dịch REFUND & Đẩy Task hoàn cọc sang
        // staff_tasks
        CancelPreviewResponse preview = null;
        if (wasDepositPaid) {
            preview = previewCancel(reservationId);
            java.math.BigDecimal refundAmount = preview.getRefundAmount();

            // 4.1. Tạo bản ghi giao dịch trong payment_transactions
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

            // 4.2. Tính deadline 24h (không tính Chủ Nhật)
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime deadline = calculateRefundDeadline(now);

            // 4.3. Soạn nội dung ghi chú chuyển khoản chi tiết cho Staff
            String refundTaskNote;
            boolean hasBankInfo = request.getBankName() != null && !request.getBankName().trim().isEmpty();
            String reasonText = request.getReason() +
                    (request.getOtherReason() != null && !request.getOtherReason().trim().isEmpty()
                            ? " (" + request.getOtherReason().trim() + ")"
                            : "");

            String penaltyNote = preview.getPenaltyAmount().compareTo(BigDecimal.ZERO) > 0
                    ? " (Đã trừ phạt trễ 50% cọc: " + preview.getPenaltyAmount().toPlainString() + " VND)"
                    : " (Hoàn 100% - Hủy trước 24h)";

            if (hasBankInfo) {
                refundTaskNote = String.format(
                        "[HOÀN CỌC CK] Đơn: %s | Khách: %s (SĐT: %s) | Số tiền hoàn: %s VND%s | Ngân hàng: %s | STK: %s | Chủ TK: %s | Lý do: %s",
                        reservation.getReservationCode(),
                        reservation.getCustomer().getFullName(),
                        reservation.getCustomer().getPhone(),
                        refundAmount.toPlainString(),
                        penaltyNote,
                        request.getBankName().trim(),
                        request.getBankAccountNumber().trim(),
                        request.getBankAccountName().trim(),
                        reasonText);
            } else {
                refundTaskNote = String.format(
                        "[HOÀN CỌC TIỀN MẶT] Đơn: %s | Khách: %s (SĐT: %s) | Số tiền hoàn: %s VND%s | Khách nhận tiền mặt trực tiếp tại quầy | Lý do: %s",
                        reservation.getReservationCode(),
                        reservation.getCustomer().getFullName(),
                        reservation.getCustomer().getPhone(),
                        refundAmount.toPlainString(),
                        penaltyNote,
                        reasonText);
            }

            if (refundTaskNote.length() > 1000) {
                refundTaskNote = refundTaskNote.substring(0, 997) + "...";
            }

            // 4.4. Tìm ID của Facility Manager phụ trách cơ sở này
            Integer managerId = null;
            try {
                managerId = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 u.id FROM users u " +
                                "JOIN roles r ON u.role_id = r.id " +
                                "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE'",
                        Integer.class,
                        reservation.getFacility().getId());
            } catch (Exception ignored) {
            }

            // 4.5. ĐẨY DATA VÀO BẢNG facility_tasks (Gán trực tiếp cho Manager của cơ sở)
            jdbcTemplate.update(
                    "INSERT INTO facility_tasks (facility_id, task_type, contract_id, staff_id, status, due_at, note, created_at) " +
                            "VALUES (?, 'REFUND', NULL, ?, 'OPEN', ?, ?, SYSDATETIME())",
                    reservation.getFacility().getId(),
                    managerId,
                    deadline,
                    refundTaskNote);
        }

        // 5. Ghi nhật ký RÚT GỌN vào activity_logs (chỉ lưu vết cơ bản)
        String actionLog = "Người dùng ID " + reservation.getCustomer().getId()
                + " yêu cầu hủy đơn " + reservation.getReservationCode();
        if (wasDepositPaid && preview != null) {
            actionLog += " (Có hoàn cọc: " + preview.getRefundAmount().toPlainString() + " VND)";
        } else {
            actionLog += " (Không hoàn cọc)";
        }

        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                reservation.getCustomer().getId(),
                actionLog,
                reservation.getId());
    }

    // PR-X3: Đánh giá điều kiện đủ để xử lý No-Show
    public NoShowEligibility evaluateNoShowEligibility(Reservation reservation) {
        if (reservation == null) {
            return new NoShowEligibility(false, 0, "Đơn đặt chỗ không tồn tại");
        }

        // 1. Mốc giờ hẹn: expectedAppointmentTime, nếu null lấy 09:00 ngày startDate, fallback createdAt
        LocalDateTime appointmentTime = reservation.getExpectedAppointmentTime();
        if (appointmentTime == null && reservation.getStartDate() != null) {
            appointmentTime = reservation.getStartDate().atTime(9, 0);
        }
        if (appointmentTime == null) {
            appointmentTime = reservation.getCreatedAt();
        }

        LocalDateTime now = LocalDateTime.now();
        boolean past48Hours = appointmentTime != null && !now.isBefore(appointmentTime.plusHours(48));

        // 2. Tìm tất cả các lần liên hệ thất bại từ activity_logs
        List<LocalDateTime> failedAttemptTimes = new java.util.ArrayList<>();
        try {
            List<Map<String, Object>> logs = jdbcTemplate.queryForList(
                    "SELECT created_at, action FROM activity_logs " +
                            "WHERE (target_entity = 'reservations' AND target_id = ?) " +
                            "   OR (target_entity = 'facility_tasks' AND target_id IN (" +
                            "       SELECT CAST(ft.id AS NVARCHAR(50)) FROM facility_tasks ft " +
                            "       JOIN rental_contracts rc ON ft.contract_id = rc.id " +
                            "       WHERE rc.reservation_id = ?" +
                            "   )) " +
                            "ORDER BY created_at ASC",
                    String.valueOf(reservation.getId()), reservation.getId());

            for (Map<String, Object> log : logs) {
                String action = log.get("action") != null ? log.get("action").toString() : "";
                String actionLower = action.toLowerCase();
                boolean isFailed = action.contains("[CONTACT][FAILED]")
                        || actionLower.contains("không nghe máy")
                        || actionLower.contains("khong nghe may")
                        || actionLower.contains("thuê bao")
                        || actionLower.contains("thue bao")
                        || actionLower.contains("từ chối")
                        || actionLower.contains("tu choi")
                        || actionLower.contains("thất bại")
                        || actionLower.contains("that bai");

                if (isFailed) {
                    Object ca = log.get("created_at");
                    if (ca instanceof java.sql.Timestamp ts) {
                        failedAttemptTimes.add(ts.toLocalDateTime());
                    } else if (ca instanceof LocalDateTime ldt) {
                        failedAttemptTimes.add(ldt);
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // Khử trùng lặp các lần gọi ghi nhận đồng thời (trong vòng 10 phút tính là 1 lần liên hệ)
        List<LocalDateTime> distinctAttempts = new java.util.ArrayList<>();
        for (LocalDateTime t : failedAttemptTimes) {
            if (distinctAttempts.isEmpty() || java.time.Duration.between(distinctAttempts.get(distinctAttempts.size() - 1), t).abs().toMinutes() >= 10) {
                distinctAttempts.add(t);
            }
        }

        int failedCount = distinctAttempts.size();
        boolean enoughAttempts = failedCount >= 2;

        boolean has24hGap = false;
        if (enoughAttempts) {
            // Danh sách đã được sắp xếp tăng dần theo thời gian, kiểm tra khoảng cách giữa lần đầu và lần cuối
            long hoursGap = java.time.Duration.between(distinctAttempts.get(0), distinctAttempts.get(distinctAttempts.size() - 1)).abs().toHours();
            if (hoursGap >= 24) {
                has24hGap = true;
            }
        }

        boolean eligible = past48Hours && enoughAttempts && has24hGap;
        String reason = null;
        if (!past48Hours) {
            String deadlineStr = appointmentTime != null
                    ? appointmentTime.plusHours(48).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"))
                    : "48h";
            reason = "Chưa đủ 48 giờ kể từ giờ hẹn nhận kho (cần đến " + deadlineStr + ").";
        } else if (!enoughAttempts) {
            reason = "Cần tối thiểu 2 lần liên hệ thất bại với khách hàng (hiện có " + failedCount + "/2 lần).";
        } else if (!has24hGap) {
            reason = "Hai lần liên hệ thất bại phải cách nhau tối thiểu 24 giờ để đảm bảo khách có đủ thời gian phản hồi.";
        }

        return new NoShowEligibility(eligible, failedCount, reason);
    }

    // [EXCEPTION]: Xử lý khách không đến nhận kho (No-Show Handling)
    @Transactional
    public void handleNoShow(Integer reservationId, com.queenkho.api.dto.NoShowRequest request) {
        // UC-31 / PR-A8 (L-21): log phải ghi đúng người thao tác (FM) → bắt buộc có staffId
        if (request == null || request.getStaffId() == null) {
            throw new IllegalArgumentException("Thiếu người thao tác (staffId)");
        }
        // tim don dat cho trong db
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));

        // no show handling voi don da dat coc, gan kho
        if (!"DEPOSIT_PAID".equals(reservation.getStatus()) && !"UNIT_ASSIGNED".equals(reservation.getStatus())) {
            throw new IllegalStateException(
                    "Trạng thái đơn không hợp lệ để xử lý No-Show (chỉ áp dụng cho đơn đã cọc hoặc đã gán kho)");
        }

        // PR-X3: Ràng buộc điều kiện No-Show (48h quá hạn & 2 lần liên hệ cách nhau 24h)
        NoShowEligibility eligibility = evaluateNoShowEligibility(reservation);
        if (!eligibility.eligible()) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "NO_SHOW_NOT_ALLOWED_YET", eligibility.reason());
        }

        // PR-X1: Tính toán tài chính No-Show
        BigDecimal totalPaid = BigDecimal.ZERO;
        try {
            totalPaid = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment_transactions " +
                            "WHERE (reservation_id = ? OR contract_id IN (SELECT id FROM rental_contracts WHERE reservation_id = ?)) " +
                            "  AND status = 'SUCCESS' AND payment_type IN ('DEPOSIT', 'MONTHLY_RENT')",
                    BigDecimal.class,
                    reservationId, reservationId);
        } catch (Exception ignored) {
        }
        BigDecimal deposit = reservation.getDepositAmount() != null ? reservation.getDepositAmount() : BigDecimal.ZERO;
        if (totalPaid == null || totalPaid.compareTo(BigDecimal.ZERO) == 0) {
            totalPaid = reservation.getTotalDepositPaid() != null && reservation.getTotalDepositPaid().compareTo(BigDecimal.ZERO) > 0
                    ? reservation.getTotalDepositPaid()
                    : deposit;
        }

        boolean waivePenalty = Boolean.TRUE.equals(request != null ? request.getWaivePenalty() : null);
        BigDecimal refundAmount;
        BigDecimal penaltyAmount;

        if (waivePenalty) {
            // FM phê duyệt miễn phạt: hoàn 100% toàn bộ tiền khách đã thanh toán (cọc + tiền thuê)
            penaltyAmount = BigDecimal.ZERO;
            refundAmount = totalPaid;
        } else {
            // Mặc định No-Show: Tịch thu 100% tiền cọc; hoàn lại tiền thuê trả trước (nếu có)
            penaltyAmount = deposit;
            refundAmount = totalPaid.compareTo(deposit) > 0 ? totalPaid.subtract(deposit) : BigDecimal.ZERO;
        }

        // Sinh task REFUND trong facility_tasks nếu có tiền cần hoàn cho khách
        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            LocalDateTime deadline = calculateRefundDeadline(LocalDateTime.now());
            Integer managerId = null;
            try {
                managerId = jdbcTemplate.queryForObject(
                        "SELECT TOP 1 u.id FROM users u " +
                                "JOIN roles r ON u.role_id = r.id " +
                                "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE'",
                        Integer.class,
                        reservation.getFacility().getId());
            } catch (Exception ignored) {
            }

            String waiveNote = waivePenalty
                    ? " (FM phê duyệt miễn phạt No-Show: hoàn 100% cọc + tiền thuê. Lý do: " + (request.getWaiveReason() != null ? request.getWaiveReason() : "Miễn phạt") + ")"
                    : " (Tịch thu 100% cọc: " + penaltyAmount.toPlainString() + " VND, hoàn tiền thuê trả trước)";

            String refundTaskNote = String.format(
                    "[HOÀN TIỀN NO-SHOW] Đơn: %s | Khách: %s (SĐT: %s) | Số tiền hoàn: %s VND%s | Lý do No-Show: %s",
                    reservation.getReservationCode(),
                    reservation.getCustomer().getFullName(),
                    reservation.getCustomer().getPhone(),
                    refundAmount.toPlainString(),
                    waiveNote,
                    request != null && request.getReason() != null ? request.getReason() : "Khách không đến nhận kho");

            if (refundTaskNote.length() > 1000) {
                refundTaskNote = refundTaskNote.substring(0, 997) + "...";
            }

            jdbcTemplate.update(
                    "INSERT INTO facility_tasks (facility_id, task_type, contract_id, staff_id, status, due_at, note, created_at) " +
                            "VALUES (?, 'REFUND', NULL, ?, 'OPEN', ?, ?, SYSDATETIME())",
                    reservation.getFacility().getId(),
                    managerId,
                    deadline,
                    refundTaskNote);
        }

        reservation.setStatus("CANCELLED");
        reservationRepository.save(reservation);

        // tra ve available
        String freedUnitId = null;
        if (reservation.getStorageUnitId() != null) {
            freedUnitId = reservation.getStorageUnitId();
            storageUnitRepository.findById(freedUnitId).ifPresent(unit -> {
                unit.setStatus("AVAILABLE");
                storageUnitRepository.save(unit);
            });
        }

        // da gan kho -> huy hop dong
        rentalContractRepository.findByReservationId(reservation.getId()).ifPresent(contract -> {
            contract.setStatus("TERMINATED");
            rentalContractRepository.save(contract);
            // UC-16: khách không đến → bỏ task check-in khỏi bảng công việc
            staffTaskService.cancelOpenTasks(contract.getId(), "CHECK_IN");
        });

        // ghi log vao activity_logs
        String staffNote = (request != null && request.getNote() != null && !request.getNote().isBlank())
                ? " - Ghi chú: " + request.getNote()
                : "";
        String reasonStr = (request != null && request.getReason() != null) ? request.getReason()
                : "Khách không đến nhận kho";

        String penaltyLogStr = waivePenalty
                ? "FM phê duyệt miễn phạt (Hoàn 100% tiền đã đóng: " + refundAmount.toPlainString() + "đ)"
                : "Tịch thu cọc: " + penaltyAmount.toPlainString() + "đ" + (refundAmount.compareTo(BigDecimal.ZERO) > 0 ? ", hoàn tiền thuê trả trước: " + refundAmount.toPlainString() + "đ" : "");

        String logAction = "[NO-SHOW] Hủy đơn " + reservation.getReservationCode()
                + ". Lý do: " + reasonStr + staffNote
                + ". " + penaltyLogStr;

        if (freedUnitId != null) {
            logAction += ". Đã giải phóng ô kho " + freedUnitId + " về AVAILABLE";
        }

        if (logAction.length() > 500) {
            logAction = logAction.substring(0, 497) + "...";
        }

        // UC-31 / PR-A8: người thao tác là FM (đã kiểm tra staffId ở đầu hàm), không phải khách
        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                request.getStaffId(),
                logAction,
                reservation.getId());
    }

    // neu nhan vien goi va khach co nghe may
    @Transactional
    public void rescheduleReservation(Integer reservationId,
            com.queenkho.api.dto.RescheduleReservationRequest request) {
        if (request == null || request.getNewStartDate() == null) {
            throw new IllegalArgumentException("Vui lòng chọn ngày nhận kho mới");
        }
        // UC-31 / PR-A8 (L-21): log phải ghi đúng người thao tác (FM gọi điện cho khách rồi dời lịch)
        if (request.getManagerId() == null) {
            throw new IllegalArgumentException("Thiếu người thao tác (managerId)");
        }
        if (request.getNewStartDate().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Ngày nhận kho mới không được ở trong quá khứ");
        }
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));
        if (!"DEPOSIT_PAID".equals(reservation.getStatus()) && !"UNIT_ASSIGNED".equals(reservation.getStatus())) {
            throw new IllegalStateException("Đơn ở trạng thái này không thể dời lịch hẹn");
        }
        LocalDate oldDate = reservation.getStartDate();
        reservation.setStartDate(request.getNewStartDate());
        reservationRepository.save(reservation);

        // cap nhat lai hop dong
        rentalContractRepository.findByReservationId(reservation.getId()).ifPresent(contract -> {
            contract.setStartDate(request.getNewStartDate());
            if (reservation.getDurationMonths() != null) {
                contract.setEndDate(request.getNewStartDate().plusMonths(reservation.getDurationMonths()));
            }
            rentalContractRepository.save(contract);
            // UC-16: hạn check-in theo ngày nhận kho mới
            staffTaskService.rescheduleOpenTasks(contract.getId(), "CHECK_IN", request.getNewStartDate());
        });
        // ghi log
        String logAction = "[RESCHEDULE] Dời ngày hẹn nhận kho đơn " + reservation.getReservationCode()
                + " từ " + oldDate + " sang " + request.getNewStartDate()
                + (request.getReason() != null ? " (Lý do: " + request.getReason() + ")" : "");
        if (logAction.length() > 500)
            logAction = logAction.substring(0, 497) + "...";
        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                request.getManagerId(),
                logAction,
                reservation.getId());
    }

    // Hàm phụ trợ: Tính deadline 24h bỏ qua Chủ Nhật
    public static LocalDateTime calculateRefundDeadline(LocalDateTime requestTime) {
        LocalDateTime deadline = requestTime.plusHours(24);

        if (requestTime.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            deadline = requestTime.plusDays(1).plusHours(24);
        } else if (deadline.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            deadline = deadline.plusDays(1);
        }

        return deadline;
    }

}
