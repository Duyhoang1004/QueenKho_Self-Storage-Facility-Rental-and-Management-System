package com.queenkho.api.service;

import com.queenkho.api.dto.CancelPreviewResponse;
import com.queenkho.api.dto.CancelReservationRequest;
import com.queenkho.api.dto.CreateReservationRequest;
import com.queenkho.api.dto.CreateReservationResponse;
import com.queenkho.api.dto.MyReservationResponse;
import com.queenkho.api.dto.PendingReservationResponse;
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
                            r.getFacility().getName(),
                            r.getUnitType().getName(),
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
                            staffName);
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
        // thanh toán VNPAY)
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

        // Fallback nếu test data chưa có trong payment_transactions
        if (totalPaid.compareTo(BigDecimal.ZERO) == 0) {
            totalPaid = reservation.getTotalDepositPaid() != null
                    && reservation.getTotalDepositPaid().compareTo(BigDecimal.ZERO) > 0
                            ? reservation.getTotalDepositPaid()
                            : deposit;
        }

        BigDecimal penalty;
        BigDecimal refund;

        // 2. TÍNH TOÁN HOÀN TIỀN DỰA TRÊN MỐC 24H
        if (LocalDateTime.now().plusHours(24).isBefore(appointmentTime)) {
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

    // [EXCEPTION]: Xử lý khách không đến nhận kho (No-Show Handling)
    // neu nhan vien goi nhung khach k nghe may
    @Transactional
    public void handleNoShow(Integer reservationId, com.queenkho.api.dto.NoShowRequest request) {
        // tim don dat cho trong db
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt chỗ"));

        // 2no show handling voi don da dat coc, gan kho
        if (!"DEPOSIT_PAID".equals(reservation.getStatus()) && !"UNIT_ASSIGNED".equals(reservation.getStatus())) {
            throw new IllegalStateException(
                    "Trạng thái đơn không hợp lệ để xử lý No-Show (chỉ áp dụng cho đơn đã cọc hoặc đã gán kho)");
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

        // ghi log vao activitylog
        String staffNote = (request != null && request.getNote() != null && !request.getNote().isBlank())
                ? " - Ghi chú: " + request.getNote()
                : "";
        String reasonStr = (request != null && request.getReason() != null) ? request.getReason()
                : "Khách không đến nhận kho";

        String logAction = "[NO-SHOW] Hủy đơn " + reservation.getReservationCode()
                + ". Lý do: " + reasonStr + staffNote
                + ". Tịch thu cọc: " + (reservation.getDepositAmount() != null ? reservation.getDepositAmount() : "0")
                + "đ";

        if (freedUnitId != null) {
            logAction += ". Đã giải phóng ô kho " + freedUnitId + " về AVAILABLE";
        }

        if (logAction.length() > 500) {
            logAction = logAction.substring(0, 497) + "...";
        }

        Integer operatorId = (request != null && request.getStaffId() != null)
                ? request.getStaffId()
                : reservation.getCustomer().getId();

        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                operatorId,
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
        String logAction = "Dời ngày hẹn nhận kho đơn " + reservation.getReservationCode()
                + " từ " + oldDate + " sang " + request.getNewStartDate()
                + (request.getReason() != null ? " (Lý do: " + request.getReason() + ")" : "");
        if (logAction.length() > 500)
            logAction = logAction.substring(0, 497) + "...";
        jdbcTemplate.update(
                "INSERT INTO activity_logs (user_id, action, target_entity, target_id, created_at) " +
                        "VALUES (?, ?, 'reservations', ?, SYSDATETIME())",
                reservation.getCustomer().getId(),
                logAction,
                reservation.getId());
    }

    // Hàm phụ trợ: Tính deadline 24h bỏ qua Chủ Nhật
    private LocalDateTime calculateRefundDeadline(LocalDateTime requestTime) {
        LocalDateTime deadline = requestTime.plusHours(24);

        if (requestTime.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            deadline = requestTime.plusDays(1).plusHours(24);
        } else if (deadline.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            deadline = deadline.plusDays(1);
        }

        return deadline;
    }

}
