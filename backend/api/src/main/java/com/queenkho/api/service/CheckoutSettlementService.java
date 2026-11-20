package com.queenkho.api.service;

import com.queenkho.api.dto.CheckOutRequest;
import com.queenkho.api.dto.MoneyLine;
import com.queenkho.api.dto.RefundCalculationResult;
import com.queenkho.api.dto.SettlementActionRequest;
import com.queenkho.api.dto.SettlementAdjustRequest;
import com.queenkho.api.dto.SettlementCashPaymentRequest;
import com.queenkho.api.dto.SettlementResponse;
import com.queenkho.api.entity.CheckoutSettlement;
import com.queenkho.api.entity.CompensationClaim;
import com.queenkho.api.entity.DamageCase;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.CheckoutSettlementRepository;
import com.queenkho.api.repository.CompensationClaimRepository;
import com.queenkho.api.repository.DamageCaseRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.ReservationRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.UserRepository;
import com.queenkho.api.security.CurrentUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * D-21 (19/11/2026): Trả kho = tất toán, khách xác nhận kết thúc hợp đồng.
 * <pre>
 * Staff nghiệm thu ─▶ HĐ SETTLEMENT_PENDING + bảng quyết toán vòng 1 (PR-O18, PR-O19)
 *   ├─ còn hồ sơ bồi thường INSPECTED → WAITING_CLAIM, FM chốt xong → tính lại (onClaimDecided)
 *   ├─ khách xác nhận, số tiền ≥ 0 → 1 task REFUND (gồm bồi thường), HĐ TERMINATED (PR-O20)
 *   ├─ khách đồng ý, số tiền < 0 → 1 dòng nợ, AWAITING_PAYMENT → trả VNPAY / tiền mặt → TERMINATED (PR-O21)
 *   ├─ khách "Không đồng ý" → DISPUTED → FM sửa tiền / giữ nguyên / giao Staff kiểm tra lại → vòng mới (PR-O22)
 *   └─ ≥ 0 không xác nhận 3 ngày → job tự xác nhận; < 0 nhắc 1 / 3 / 7 ngày (PR-O23)
 * </pre>
 */
@Service
public class CheckoutSettlementService {

    public static final int AUTO_CONFIRM_DAYS = 3;
    public static final List<Integer> REMIND_DAYS = List.of(1, 3, 7);
    public static final String RECHECK_TAG = "[RECHECK]";
    static final List<String> OPEN_STATUSES = List.of(
            CheckoutSettlement.WAITING_CLAIM, CheckoutSettlement.WAITING_CUSTOMER, CheckoutSettlement.DISPUTED,
            CheckoutSettlement.RECHECKING, CheckoutSettlement.AWAITING_PAYMENT);

    private final CheckoutSettlementRepository settlementRepository;
    private final RentalContractRepository contractRepository;
    private final ReservationRepository reservationRepository;
    private final CompensationClaimRepository claimRepository;
    private final DamageCaseRepository damageCaseRepository;
    private final StaffTaskRepository staffTaskRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ActivityLogService activityLogService;
    private final TransactionTemplate txTemplate;
    private final boolean simulationEnabled;

    @Autowired(required = false)
    private NotificationService notificationService;

    // Các service dưới cũng gọi ngược lại service này → @Lazy để tránh vòng phụ thuộc khi khởi tạo
    @Autowired
    @Lazy
    private StaffTaskService staffTaskService;

    @Autowired
    @Lazy
    private CompensationClaimService claimService;

    @Autowired
    @Lazy
    private VnpayService vnpayService;

    public CheckoutSettlementService(CheckoutSettlementRepository settlementRepository,
                                     RentalContractRepository contractRepository,
                                     ReservationRepository reservationRepository,
                                     CompensationClaimRepository claimRepository,
                                     DamageCaseRepository damageCaseRepository,
                                     StaffTaskRepository staffTaskRepository,
                                     UserRepository userRepository,
                                     JdbcTemplate jdbcTemplate,
                                     ActivityLogService activityLogService,
                                     PlatformTransactionManager transactionManager,
                                     @Value("${queenkho.simulation.enabled:false}") boolean simulationEnabled) {
        this.settlementRepository = settlementRepository;
        this.contractRepository = contractRepository;
        this.reservationRepository = reservationRepository;
        this.claimRepository = claimRepository;
        this.damageCaseRepository = damageCaseRepository;
        this.staffTaskRepository = staffTaskRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.activityLogService = activityLogService;
        this.txTemplate = new TransactionTemplate(transactionManager);
        this.simulationEnabled = simulationEnabled;
    }

    // ================== CÔNG THỨC (PR-O19) ==================

    /**
     * Phân bổ cọc theo thứ tự sự cố → phí trễ → phí chiếm dụng (PR-O11). Phí trễ chỉ trừ trong phần cọc còn lại,
     * không bao giờ thành nợ (PR-Q3). Số tiền tất toán = phần cọc còn lại + hoàn tiền thuê + bồi thường − phí vượt cọc.
     */
    public record Allocation(BigDecimal damageOffset, BigDecimal lateOffset, BigDecimal overstayOffset,
                             BigDecimal depositRefund, BigDecimal damageBeyond, BigDecimal overstayBeyond,
                             BigDecimal net) {
        public BigDecimal feesBeyond() {
            return damageBeyond.add(overstayBeyond);
        }
    }

    public static Allocation allocate(BigDecimal deposit, BigDecimal damage, BigDecimal late, BigDecimal overstay,
                                      BigDecimal rentRefund, BigDecimal compensation) {
        BigDecimal remaining = nz(deposit);
        BigDecimal damageOffset = nz(damage).min(remaining);
        remaining = remaining.subtract(damageOffset);
        BigDecimal lateOffset = nz(late).min(remaining);
        remaining = remaining.subtract(lateOffset);
        BigDecimal overstayOffset = nz(overstay).min(remaining);
        remaining = remaining.subtract(overstayOffset);
        BigDecimal damageBeyond = nz(damage).subtract(damageOffset);
        BigDecimal overstayBeyond = nz(overstay).subtract(overstayOffset);
        BigDecimal net = remaining.add(nz(rentRefund)).add(nz(compensation)).subtract(damageBeyond).subtract(overstayBeyond);
        return new Allocation(damageOffset, lateOffset, overstayOffset, remaining, damageBeyond, overstayBeyond,
                net.setScale(0, RoundingMode.HALF_UP));
    }

    private static Allocation allocate(CheckoutSettlement s) {
        return allocate(s.getDepositHeld(), s.getDamageFee(), s.getLateFee(), s.getOverstayFee(),
                s.getRentRefund(), s.getCompensationAmount());
    }

    // ================== 1. NGHIỆM THU → VÒNG 1 (PR-O17, PR-O18) ==================

    /** PR-O17: còn ticket thường đang mở / hồ sơ bồi thường chưa kiểm tra hiện trường thì chưa được nghiệm thu */
    public void assertReadyForCheckout(Integer contractId) {
        List<Map<String, Object>> tickets = jdbcTemplate.queryForList(
                "SELECT ticket_code, issue_type FROM support_requests WHERE contract_id = ? AND status IN ('OPEN', 'IN_PROGRESS') " +
                        "AND issue_type NOT IN ('GOODS_DAMAGE', 'GOODS_LOSS')", contractId);
        if (!tickets.isEmpty()) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "OPEN_TICKETS_PENDING",
                    "Hợp đồng còn " + tickets.size() + " yêu cầu hỗ trợ chưa xử lý xong ("
                            + String.join(", ", tickets.stream().map(t -> String.valueOf(t.get("ticket_code"))).toList())
                            + "). Xử lý xong rồi mới nghiệm thu (PR-O17).");
        }
        List<String> uninspected = jdbcTemplate.queryForList(
                "SELECT claim_code FROM compensation_claims WHERE contract_id = ? AND status = 'SUBMITTED'", String.class, contractId);
        if (!uninspected.isEmpty()) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CLAIM_INSPECTION_PENDING",
                    "Hồ sơ bồi thường " + String.join(", ", uninspected)
                            + " chưa được kiểm tra hiện trường. Lập biên bản kiểm tra trước khi dọn ô (PR-O17).");
        }
    }

    /**
     * PR-O18 / PR-O19: tạo bảng quyết toán vòng 1 ngay sau khi Staff nghiệm thu.
     * Phải gọi TRƯỚC khi đổi trạng thái hợp đồng (phí trễ / chiếm dụng tính theo HĐ còn giữ ô — như màn xem trước của khách).
     */
    @Transactional
    public CheckoutSettlement createInitial(RentalContract contract, StaffTask checkOutTask, LocalDate checkoutDate,
                                            BigDecimal customerDamageCost, String staffNote, Integer staffId) {
        RefundCalculationResult calc = staffTaskService.calculateCheckoutRefund(contract, checkoutDate, customerDamageCost);

        CheckoutSettlement s = new CheckoutSettlement();
        s.setContract(contract);
        s.setRoundNo(1);
        s.setCheckOutTaskId(checkOutTask.getId());
        s.setCheckoutDate(checkoutDate);
        s.setDepositHeld(money(calc.getDepositHeld()));
        s.setDamageFee(money(customerDamageCost));
        s.setLateFee(money(nz(calc.getGraceFee()).add(nz(calc.getLateFee()))));
        s.setOverstayFee(money(calc.getOverstayFee()));
        s.setRentRefund(money(calc.getEarlyRentRefund()));
        s.setRefundMethod(StaffTaskService.detectRefundMethodFromNote(checkOutTask.getNote()));
        s.setRentBasis(new RefundBreakdown.RentBasis(calc.getRentPaidNet(), calc.getInsurancePaid(), calc.getPeriodMonths(),
                calc.getPeriodStart(), calc.isEarlyCheckout(), calc.isFaultTermination(), calc.getUsedMonths(),
                calc.getBaseMonthlyPrice(), calc.getBreakFee(), calc.getDaysPastEndDate()).toText());
        s.setStaffNote(truncate(staffNote, 1000));
        s.setCreatedBy(staffId);
        fillClaimsAndTotals(s);
        settlementRepository.save(s);

        log(staffId, "[SETTLEMENT_CREATE] Quyết toán trả kho HĐ " + contract.getContractCode() + " vòng 1: "
                + describeNet(s.getNetAmount()), contract.getId());
        notifyCustomerSettlementReady(s, false);
        return s;
    }

    /** Bồi thường đã duyệt + trạng thái chờ chốt hồ sơ + số tiền tất toán + diễn giải */
    private void fillClaimsAndTotals(CheckoutSettlement s) {
        Integer contractId = s.getContract().getId();
        List<CompensationClaim> claims = claimRepository.findForContract(contractId);
        BigDecimal compensation = claims.stream()
                .filter(c -> "APPROVED".equals(c.getStatus()))
                .map(c -> nz(c.getTotalCompensation()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean waitingClaim = claims.stream().anyMatch(c -> "INSPECTED".equals(c.getStatus()));
        s.setCompensationAmount(money(compensation));
        s.setStatus(waitingClaim ? CheckoutSettlement.WAITING_CLAIM : CheckoutSettlement.WAITING_CUSTOMER);
        Allocation a = allocate(s);
        s.setNetAmount(a.net());
        s.setBreakdownNote(buildBreakdown(s, a));
    }

    // ================== 2. TÍNH LẠI → VÒNG MỚI (PR-O19, PR-O22) ==================

    private CheckoutSettlement newRound(CheckoutSettlement current, Integer actorId, Integer checkOutTaskId,
                                        BigDecimal lateFee, BigDecimal overstayFee, String staffNote, String managerNote) {
        current.setStatus(CheckoutSettlement.SUPERSEDED);
        current.setUpdatedAt(LocalDateTime.now());
        settlementRepository.save(current);

        CheckoutSettlement s = new CheckoutSettlement();
        s.setContract(current.getContract());
        s.setRoundNo(current.getRoundNo() + 1);
        s.setCheckOutTaskId(checkOutTaskId != null ? checkOutTaskId : current.getCheckOutTaskId());
        s.setCheckoutDate(current.getCheckoutDate());
        s.setDepositHeld(current.getDepositHeld());
        s.setDamageFee(money(customerDamageOfTask(s.getCheckOutTaskId())));
        s.setLateFee(lateFee != null ? lateFee : current.getLateFee());
        s.setOverstayFee(overstayFee != null ? overstayFee : current.getOverstayFee());
        s.setRentRefund(current.getRentRefund());
        s.setRentBasis(current.getRentBasis());
        s.setRefundMethod(current.getRefundMethod());
        s.setStaffNote(truncate(staffNote, 1000));
        s.setManagerNote(truncate(managerNote, 1000));
        s.setCreatedBy(actorId);
        fillClaimsAndTotals(s);
        return settlementRepository.save(s);
    }

    /** Sự cố lỗi khách của task nghiệm thu / kiểm tra lại đang có hiệu lực */
    private BigDecimal customerDamageOfTask(Integer taskId) {
        if (taskId == null) return BigDecimal.ZERO;
        return damageCaseRepository.findByTask_IdOrderByIdAsc(taskId).stream()
                .filter(d -> "CUSTOMER".equals(d.getLiableParty()))
                .map(d -> nz(d.getEstimatedCost()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Gọi từ CompensationClaimService.decide: FM chốt hồ sơ của hợp đồng đang tất toán */
    @Transactional
    public void onClaimDecided(CompensationClaim claim, Integer managerId) {
        CheckoutSettlement current = findOpen(claim.getContract().getId()).orElse(null);
        if (current == null || !List.of(CheckoutSettlement.WAITING_CLAIM, CheckoutSettlement.WAITING_CUSTOMER)
                .contains(current.getStatus())) {
            return;
        }
        CheckoutSettlement s = newRound(current, managerId, null, null, null, null,
                "Chốt hồ sơ bồi thường " + claim.getClaimCode() + ": " + claim.getStatus());
        log(managerId, "[SETTLEMENT_CLAIM] Tính lại quyết toán HĐ " + s.getContract().getContractCode()
                + " sau khi chốt hồ sơ " + claim.getClaimCode() + ": " + describeNet(s.getNetAmount()), s.getContract().getId());
        notifyCustomerSettlementReady(s, true);
    }

    // ================== 3. KHÁCH XÁC NHẬN / KHÔNG ĐỒNG Ý (PR-O20 → PR-O22) ==================

    @Transactional
    public Map<String, Object> confirm(Integer contractId, CurrentUser actor, String ip) {
        RentalContract contract = requireOwnContract(contractId, actor);
        CheckoutSettlement s = requireOpen(contract.getId());
        if (CheckoutSettlement.AWAITING_PAYMENT.equals(s.getStatus())) {
            return payResult(s, actor.id(), ip, "Vui lòng thanh toán " + vnd(s.getNetAmount().abs()) + " để kết thúc hợp đồng.");
        }
        requireWaitingCustomer(s);
        doConfirm(s, actor.id(), false);
        if (s.customerPays()) {
            return payResult(s, actor.id(), ip, "Đã ghi nhận đồng ý. Thanh toán " + vnd(s.getNetAmount().abs())
                    + " để kết thúc hợp đồng.");
        }
        return Map.of("status", s.getStatus(), "contractStatus", "TERMINATED",
                "message", "Hợp đồng đã kết thúc. Quản lý cơ sở sẽ hoàn " + vnd(s.getNetAmount()) + " trong 24 giờ làm việc.");
    }

    /** Khách bấm lại "Thanh toán" khi đang AWAITING_PAYMENT (link VNPAY mới) */
    @Transactional
    public Map<String, Object> pay(Integer contractId, CurrentUser actor, String ip) {
        RentalContract contract = requireOwnContract(contractId, actor);
        CheckoutSettlement s = requireOpen(contract.getId());
        if (!CheckoutSettlement.AWAITING_PAYMENT.equals(s.getStatus())) {
            throw invalid("Quyết toán chưa ở bước thanh toán (hiện tại: " + s.getStatus() + ")");
        }
        return payResult(s, actor.id(), ip, "Mở cổng VNPAY để thanh toán " + vnd(s.getNetAmount().abs()));
    }

    private Map<String, Object> payResult(CheckoutSettlement s, Integer customerId, String ip, String message) {
        Map<String, Object> link = vnpayService.createDebtPayment(s.getDebtTransactionId(), customerId, ip);
        return Map.of("status", s.getStatus(), "contractStatus", "SETTLEMENT_PENDING",
                "payUrl", link.get("payUrl"), "amount", s.getNetAmount().abs(), "message", message);
    }

    @Transactional
    public SettlementResponse dispute(Integer contractId, CurrentUser actor, SettlementActionRequest request) {
        RentalContract contract = requireOwnContract(contractId, actor);
        CheckoutSettlement s = requireOpen(contract.getId());
        requireWaitingCustomer(s);
        String reason = request != null && request.getReason() != null ? request.getReason().trim() : "";
        if (reason.length() < 10 || reason.length() > 500) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "DISPUTE_REASON_REQUIRED",
                    "Vui lòng nêu lý do không đồng ý (10–500 ký tự)");
        }
        s.setStatus(CheckoutSettlement.DISPUTED);
        s.setDisputeReason(reason);
        s.setDisputedAt(LocalDateTime.now());
        s.setUpdatedAt(LocalDateTime.now());
        settlementRepository.save(s);

        log(actor.id(), "[SETTLEMENT_DISPUTE] Khách không đồng ý quyết toán HĐ " + contract.getContractCode()
                + " vòng " + s.getRoundNo() + ": " + reason, contract.getId());
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(facilityIdOf(contract),
                    "Khách không đồng ý quyết toán — HĐ " + contract.getContractCode(),
                    contract.getCustomer().getFullName() + ": " + truncate(reason, 200),
                    "CHECKOUT", "/manager/settlements?highlight=" + s.getId());
        }
        return toResponse(s, true);
    }

    /** Ghi giao dịch + sinh task REFUND / dòng nợ. Dùng cho khách xác nhận và job tự xác nhận. */
    private void doConfirm(CheckoutSettlement s, Integer actorId, boolean auto) {
        RentalContract contract = s.getContract();
        Integer customerId = contract.getCustomer().getId();
        Integer reservationId = contract.getReservation() != null ? contract.getReservation().getId() : null;
        Allocation a = allocate(s);
        String tag = contract.getId() + "-" + s.getRoundNo();

        // a. Trừ cọc (PR-O9, PR-O11)
        insertTxn("DMG-OFF-" + tag, customerId, reservationId, contract.getId(), "DAMAGE_FEE", "DEPOSIT_OFFSET", a.damageOffset(), "SUCCESS");
        insertTxn("LATE-OFF-" + tag, customerId, reservationId, contract.getId(), "LATE_FEE", "DEPOSIT_OFFSET", a.lateOffset(), "SUCCESS");
        insertTxn("OS-OFF-" + tag, customerId, reservationId, contract.getId(), "OVERSTAY_FEE", "DEPOSIT_OFFSET", a.overstayOffset(), "SUCCESS");

        // b. Phí vượt cọc: cấn trừ vào hoàn tiền thuê, rồi vào tiền bồi thường; còn lại khách trả (PR-O21)
        BigDecimal beyond = a.feesBeyond();
        BigDecimal coverByRent = beyond.min(nz(s.getRentRefund()));
        BigDecimal coverByComp = beyond.subtract(coverByRent).min(nz(s.getCompensationAmount()));
        BigDecimal covered = coverByRent.add(coverByComp);
        BigDecimal damageCovered = a.damageBeyond().min(covered);
        BigDecimal overstayCovered = covered.subtract(damageCovered);
        insertTxn("DMG-SET-" + tag, customerId, reservationId, contract.getId(), "DAMAGE_FEE", "SETTLEMENT_OFFSET", damageCovered, "SUCCESS");
        insertTxn("OS-SET-" + tag, customerId, reservationId, contract.getId(), "OVERSTAY_FEE", "SETTLEMENT_OFFSET", overstayCovered, "SUCCESS");
        insertTxn("BT-SET-" + tag, customerId, reservationId, contract.getId(), "COMPENSATION", "SETTLEMENT_OFFSET", coverByComp, "SUCCESS");

        BigDecimal damageUnpaid = a.damageBeyond().subtract(damageCovered);
        BigDecimal unpaid = beyond.subtract(covered);
        BigDecimal compRemaining = nz(s.getCompensationAmount()).subtract(coverByComp);
        BigDecimal refundToCustomer = a.depositRefund().add(nz(s.getRentRefund()).subtract(coverByRent));

        // Hồ sơ bồi thường gắn vào bảng này
        List<CompensationClaim> approved = claimRepository.findForContract(contract.getId()).stream()
                .filter(c -> "APPROVED".equals(c.getStatus())).toList();
        approved.forEach(c -> c.setSettlementId(s.getId()));
        claimRepository.saveAll(approved);

        s.setCustomerConfirmedAt(LocalDateTime.now());
        s.setAutoConfirmed(auto);
        s.setUpdatedAt(LocalDateTime.now());

        if (unpaid.signum() > 0) {
            // c1. Âm → 1 dòng nợ PENDING, chờ khách trả rồi mới kết thúc (PR-O21)
            String debtType = damageUnpaid.signum() > 0 ? "DAMAGE_FEE" : "OVERSTAY_FEE";
            Integer debtId = insertTxn("SET-DEBT-" + tag, customerId, reservationId, contract.getId(), debtType, "VNPAY", unpaid, "PENDING");
            s.setDebtTransactionId(debtId);
            s.setStatus(CheckoutSettlement.AWAITING_PAYMENT);
            settlementRepository.save(s);
            if (compRemaining.signum() == 0) {
                approved.forEach(c -> claimService.markPaid(c, "SETTLEMENT_OFFSET", null, null, actorId));
            }
            log(actorId, (auto ? "[SETTLEMENT_AUTO_CONFIRM] " : "[SETTLEMENT_CONFIRM] ") + "Khách đồng ý quyết toán HĐ "
                    + contract.getContractCode() + ", cần thanh toán " + vnd(unpaid), contract.getId());
            return;
        }

        // c2. ≥ 0 → giao dịch hoàn PENDING + 1 task REFUND cho FM (PR-O12), hợp đồng kết thúc ngay
        String method = s.getRefundMethod() != null ? s.getRefundMethod() : "CASH";
        insertTxn("REF-OUT-" + tag, customerId, reservationId, contract.getId(), "REFUND", method, refundToCustomer, "PENDING");
        insertTxn("BT-REF-" + tag, customerId, reservationId, contract.getId(), "COMPENSATION", method, compRemaining, "PENDING");
        StaffTask refundTask = createRefundTask(s, refundToCustomer, compRemaining);
        s.setRefundTaskId(refundTask.getId());
        settlementRepository.save(s);
        if (compRemaining.signum() == 0) {
            approved.forEach(c -> claimService.markPaid(c, "SETTLEMENT_OFFSET", null, null, actorId));
        }
        log(actorId, (auto ? "[SETTLEMENT_AUTO_CONFIRM] " : "[SETTLEMENT_CONFIRM] ") + "Xác nhận quyết toán HĐ "
                + contract.getContractCode() + ", hoàn khách " + vnd(s.getNetAmount()), contract.getId());
        finalizeTerminated(s, actorId);
    }

    private StaffTask createRefundTask(CheckoutSettlement s, BigDecimal refund, BigDecimal compensation) {
        RentalContract contract = s.getContract();
        Integer facilityId = facilityIdOf(contract);
        Integer managerId = null;
        List<Integer> managers = jdbcTemplate.queryForList(
                "SELECT TOP 1 u.id FROM users u JOIN roles r ON u.role_id = r.id " +
                        "WHERE u.facility_id = ? AND r.name = 'FACILITY_MANAGER' AND u.status = 'ACTIVE' ORDER BY u.id ASC",
                Integer.class, facilityId);
        if (!managers.isEmpty()) managerId = managers.get(0);

        String bankInfo = staffTaskService.bankInfoOfContractCheckout(contract.getId());
        StringBuilder note = new StringBuilder("Hoàn tiền trả kho (quyết toán vòng ").append(s.getRoundNo()).append(") | HĐ: ")
                .append(contract.getContractCode()).append(" | Hoàn cọc + tiền thuê: ").append(vnd(refund));
        if (compensation.signum() > 0) {
            note.append(" | Bồi thường hàng: ").append(vnd(compensation));
        }
        note.append(" | TỔNG CHI: ").append(vnd(refund.add(compensation)));
        if (!bankInfo.isEmpty()) note.append(" | ").append(bankInfo);
        else note.append(" | Hoàn tiền: Nhận tiền mặt trực tiếp tại quầy");

        StaffTask task = new StaffTask();
        task.setFacilityId(facilityId);
        task.setContract(contract);
        task.setTaskType("REFUND");
        task.setStatus("OPEN");
        if (managerId != null) task.setStaff(userRepository.getReferenceById(managerId));
        task.setDueAt(staffTaskService.refundDeadline(LocalDateTime.now()));
        task.setNote(truncate(note.toString(), 1000));
        StaffTask saved = staffTaskRepository.save(task);
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(facilityId,
                    "Hoàn tiền trả kho — HĐ " + contract.getContractCode(),
                    "Khách đã xác nhận quyết toán. Cần chi " + vnd(refund.add(compensation)) + " cho khách "
                            + contract.getCustomer().getFullName() + ".",
                    "REFUND", "/manager/refunds?highlightTaskId=" + saved.getId());
        }
        return saved;
    }

    /** PR-O20 / PR-O21: kết thúc hợp đồng sau khi khách tất toán */
    private void finalizeTerminated(CheckoutSettlement s, Integer actorId) {
        RentalContract contract = s.getContract();
        contract.setStatus("TERMINATED");
        if (s.getRefundTaskId() == null) {
            contract.setDepositHeldAmount(BigDecimal.ZERO); // cọc đã cấn hết, không còn task hoàn để trigger đưa về 0
        }
        contractRepository.save(contract);
        if (contract.getReservation() != null) {
            var res = contract.getReservation();
            res.setStatus("COMPLETED");
            reservationRepository.save(res);
        }
        staffTaskService.closeOpenSupportTicketsAndTasks(contract.getId()); // PR-S8

        s.setStatus(CheckoutSettlement.COMPLETED);
        s.setUpdatedAt(LocalDateTime.now());
        settlementRepository.save(s);

        log(actorId, "[SETTLEMENT_DONE] Hợp đồng " + contract.getContractCode() + " đã tất toán và kết thúc", contract.getId());
        if (notificationService != null) {
            Integer reservationId = contract.getReservation() != null ? contract.getReservation().getId() : null;
            notificationService.notifyCustomer(contract.getCustomer().getId(),
                    "Hợp đồng " + contract.getContractCode() + " đã kết thúc",
                    s.customerPays()
                            ? "QueenKho đã nhận đủ " + vnd(s.getNetAmount().abs()) + ". Cảm ơn bạn đã sử dụng dịch vụ."
                            : "Bạn đã xác nhận quyết toán. Quản lý cơ sở sẽ hoàn " + vnd(s.getNetAmount()) + " trong 24 giờ làm việc.",
                    "CHECKOUT", reservationId != null ? "/kho-cua-toi/hop-dong/" + reservationId : "/kho-cua-toi");
        }
    }

    // ================== 4. PHẦN ÂM: VNPAY / TIỀN MẶT (PR-O21) ==================

    /** Gọi từ VnpayService sau IPN trả nợ thành công */
    @Transactional
    public void onDebtPaid(Integer paymentId) {
        if (paymentId == null) return;
        settlementRepository.findByDebtTransactionId(paymentId)
                .filter(s -> CheckoutSettlement.AWAITING_PAYMENT.equals(s.getStatus()))
                .ifPresent(s -> finalizeTerminated(s, s.getContract().getCustomer().getId()));
    }

    @Transactional
    public SettlementResponse recordCashPayment(Integer contractId, CurrentUser actor, SettlementCashPaymentRequest request) {
        RentalContract contract = requireFacilityContract(contractId, actor);
        CheckoutSettlement s = requireOpen(contract.getId());
        if (!CheckoutSettlement.AWAITING_PAYMENT.equals(s.getStatus())) {
            throw invalid("Khách chưa đồng ý quyết toán hoặc không có khoản phải thu (hiện tại: " + s.getStatus() + ")");
        }
        boolean hasEvidence = request != null && request.getEvidenceImageUrl() != null && !request.getEvidenceImageUrl().isBlank();
        if (request == null || (!Boolean.TRUE.equals(request.getCashReceiptConfirmed()) && !hasEvidence)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "PAYMENT_EVIDENCE_REQUIRED",
                    "Xác nhận khách đã ký nhận phiếu thu (hoặc tải ảnh phiếu thu)");
        }
        int updated = jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = 'CASH', paid_at = SYSDATETIME(), " +
                        "bank_transaction_code = ? WHERE id = ? AND status = 'PENDING'",
                "CASH-SET-" + s.getId(), s.getDebtTransactionId());
        if (updated == 0) {
            throw invalid("Khoản phải thu đã được thanh toán trước đó");
        }
        log(actor.id(), "[SETTLEMENT_CASH] " + actor.fullName() + " thu tiền mặt " + vnd(s.getNetAmount().abs())
                + " quyết toán HĐ " + contract.getContractCode()
                + (request.getNote() != null && !request.getNote().isBlank() ? " — " + request.getNote().trim() : ""), contract.getId());
        finalizeTerminated(s, actor.id());
        return toResponse(s, true);
    }

    // ================== 5. FM XỬ LÝ KHIẾU NẠI (PR-O22) ==================

    @Transactional
    public SettlementResponse adjust(Integer settlementId, CurrentUser actor, SettlementAdjustRequest request) {
        CheckoutSettlement current = requireDisputedForManager(settlementId, actor);
        String note = requireNote(request != null ? request.getNote() : null);
        StringBuilder changes = new StringBuilder();

        if (request.getDamages() != null) {
            List<DamageCase> damages = damageCaseRepository.findByTask_IdOrderByIdAsc(current.getCheckOutTaskId());
            for (SettlementAdjustRequest.DamageAdjust adj : request.getDamages()) {
                DamageCase dc = damages.stream().filter(d -> Objects.equals(d.getId(), adj.getDamageCaseId())).findFirst()
                        .orElseThrow(() -> new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                                "Sự cố #" + adj.getDamageCaseId() + " không thuộc biên bản đang xét"));
                BigDecimal oldCost = nz(dc.getEstimatedCost());
                BigDecimal newCost = adj.getEstimatedCost() != null ? adj.getEstimatedCost() : oldCost;
                String newParty = adj.getLiableParty() != null ? adj.getLiableParty().trim().toUpperCase() : dc.getLiableParty();
                if (newCost.signum() < 0 || newCost.compareTo(oldCost) > 0) {
                    throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                            "FM chỉ được giảm chi phí sự cố \"" + dc.getTitle() + "\" (0 – " + vnd(oldCost) + ")");
                }
                if (!List.of("CUSTOMER", "FACILITY").contains(newParty)
                        || ("FACILITY".equals(dc.getLiableParty()) && "CUSTOMER".equals(newParty))) {
                    throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                            "Chỉ được chuyển sự cố từ lỗi khách sang lỗi cơ sở (không tăng tiền khách phải chịu)");
                }
                if (newCost.compareTo(oldCost) != 0 || !newParty.equals(dc.getLiableParty())) {
                    changes.append(dc.getTitle()).append(": ").append(vnd(oldCost)).append(" ").append(dc.getLiableParty())
                            .append(" → ").append(vnd(newCost)).append(" ").append(newParty).append("; ");
                    dc.setEstimatedCost(newCost);
                    dc.setLiableParty(newParty);
                    damageCaseRepository.save(dc);
                }
            }
        }
        BigDecimal late = Boolean.TRUE.equals(request.getWaiveLateFee()) ? BigDecimal.ZERO : null;
        BigDecimal overstay = Boolean.TRUE.equals(request.getWaiveOverstayFee()) ? BigDecimal.ZERO : null;
        if (late != null && current.getLateFee().signum() > 0) changes.append("miễn phí trễ ").append(vnd(current.getLateFee())).append("; ");
        if (overstay != null && current.getOverstayFee().signum() > 0) changes.append("miễn phí chiếm dụng ").append(vnd(current.getOverstayFee())).append("; ");

        CheckoutSettlement s = newRound(current, actor.id(), null, late, overstay, null, note);
        log(actor.id(), "[SETTLEMENT_ADJUST] " + actor.fullName() + " sửa quyết toán HĐ " + s.getContract().getContractCode()
                + ": " + (changes.isEmpty() ? "không đổi số tiền" : changes) + " → " + describeNet(s.getNetAmount()), s.getContract().getId());
        notifyCustomerSettlementReady(s, true);
        return toResponse(s, true);
    }

    @Transactional
    public SettlementResponse keep(Integer settlementId, CurrentUser actor, SettlementActionRequest request) {
        CheckoutSettlement current = requireDisputedForManager(settlementId, actor);
        String note = requireNote(request != null ? request.getNote() : null);
        CheckoutSettlement s = newRound(current, actor.id(), null, null, null, null, note);
        log(actor.id(), "[SETTLEMENT_KEEP] " + actor.fullName() + " giữ nguyên quyết toán HĐ " + s.getContract().getContractCode()
                + ": " + note, s.getContract().getId());
        notifyCustomerSettlementReady(s, true);
        return toResponse(s, true);
    }

    @Transactional
    public SettlementResponse assignRecheck(Integer settlementId, CurrentUser actor, SettlementActionRequest request) {
        CheckoutSettlement s = requireDisputedForManager(settlementId, actor);
        String note = requireNote(request != null ? request.getNote() : null);
        RentalContract contract = s.getContract();
        Integer facilityId = facilityIdOf(contract);

        User staff = null;
        if (request.getStaffId() != null) {
            staff = userRepository.findById(request.getStaffId())
                    .filter(u -> u.getRole() != null && "STAFF".equals(u.getRole().getName())
                            && Objects.equals(u.getFacilityId(), facilityId) && "ACTIVE".equals(u.getStatus()))
                    .orElseThrow(() -> new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                            "Nhân viên không thuộc cơ sở hoặc không còn hoạt động"));
        }

        StaffTask task = new StaffTask();
        task.setFacilityId(facilityId);
        task.setContract(contract);
        task.setTaskType("CHECK_OUT");
        LocalDateTime now = LocalDateTime.now();
        if (staff != null) {
            task.setStaff(staff);
            task.setStatus("IN_PROGRESS");
            task.setClaimedAt(now);
        } else {
            task.setStatus("OPEN");
        }
        task.setDueAt(staffTaskService.computeDueAt(LocalDate.now().plusDays(1)));
        task.setNote(truncate(RECHECK_TAG + " Kiểm tra lại quyết toán HĐ " + contract.getContractCode()
                + " (vòng " + s.getRoundNo() + ") | Khách: " + s.getDisputeReason() + " | FM: " + note, 1000));
        StaffTask saved = staffTaskRepository.save(task);

        s.setStatus(CheckoutSettlement.RECHECKING);
        s.setManagerNote(truncate(note, 1000));
        s.setUpdatedAt(now);
        settlementRepository.save(s);

        log(actor.id(), "[SETTLEMENT_RECHECK] " + actor.fullName() + " giao kiểm tra lại quyết toán HĐ " + contract.getContractCode()
                + " (task #" + saved.getId() + (staff != null ? ", " + staff.getFullName() : "") + "): " + note, contract.getId());
        if (notificationService != null) {
            if (staff != null) {
                notificationService.notifyStaff(staff.getId(), "Kiểm tra lại ô trả kho — HĐ " + contract.getContractCode(),
                        "Khách khiếu nại quyết toán. " + truncate(note, 200), "TASK", "/staff/tasks/" + saved.getId());
            }
            notificationService.notifyCustomer(contract.getCustomer().getId(),
                    "Đang kiểm tra lại quyết toán — HĐ " + contract.getContractCode(),
                    "Quản lý cơ sở đã giao nhân viên kiểm tra lại ô theo phản hồi của bạn. Bạn sẽ nhận bảng quyết toán mới sau khi kiểm tra.",
                    "CHECKOUT", contractUrl(contract));
        }
        return toResponse(s, true);
    }

    /** Staff hoàn tất task [RECHECK]: lập lại danh sách sự cố → bảng quyết toán mới */
    @Transactional
    public void recordRecheck(StaffTask task, Integer staffId, CheckOutRequest request) {
        if (!"IN_PROGRESS".equals(task.getStatus()) || task.getStaff() == null || !Objects.equals(task.getStaff().getId(), staffId)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TASK_NOT_IN_PROGRESS",
                    "Bạn cần nhận task kiểm tra lại trước khi lập biên bản");
        }
        RentalContract contract = task.getContract();
        CheckoutSettlement current = requireOpen(contract.getId());
        if (!CheckoutSettlement.RECHECKING.equals(current.getStatus())) {
            throw invalid("Quyết toán không ở bước kiểm tra lại (hiện tại: " + current.getStatus() + ")");
        }
        String notes = request != null && request.getNotes() != null ? request.getNotes().trim() : "";
        if (notes.length() < 10) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Ghi kết quả kiểm tra lại (tối thiểu 10 ký tự) để khách và quản lý xem");
        }
        List<CheckOutRequest.DamageItemRequest> items = request.getDamageCases() != null ? request.getDamageCases() : List.of();
        for (CheckOutRequest.DamageItemRequest item : items) {
            if (item.getTitle() == null || item.getTitle().isBlank() || item.getTitle().trim().length() > 150) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM", "Mỗi sự cố cần tiêu đề (≤ 150 ký tự)");
            }
            if (item.getEstimatedCost() == null || item.getEstimatedCost().signum() < 0) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM", "Chi phí sự cố phải ≥ 0");
            }
            if (item.getLiableParty() == null || !List.of("CUSTOMER", "FACILITY").contains(item.getLiableParty())) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_DAMAGE_ITEM", "Chọn lỗi khách (CUSTOMER) hoặc lỗi cơ sở (FACILITY)");
            }
            if (item.getEvidenceImages() == null || item.getEvidenceImages().stream().noneMatch(i -> i != null && !i.isBlank())) {
                throw new StaffTaskException(HttpStatus.BAD_REQUEST, "EVIDENCE_IMAGE_REQUIRED",
                        "Sự cố \"" + item.getTitle().trim() + "\" cần ít nhất 1 ảnh bằng chứng (PR-O8)");
            }
        }
        LocalDateTime now = LocalDateTime.now();
        for (CheckOutRequest.DamageItemRequest item : items) {
            DamageCase dc = new DamageCase();
            dc.setContract(contract);
            dc.setTask(task);
            dc.setTitle(item.getTitle().trim());
            dc.setDescription(item.getDescription() != null && !item.getDescription().isBlank() ? item.getDescription().trim() : null);
            dc.setEstimatedCost(item.getEstimatedCost());
            dc.setLiableParty(item.getLiableParty());
            dc.setEvidenceImageUrls(staffTaskService.serializeImages(item.getEvidenceImages()));
            damageCaseRepository.save(dc);
        }
        task.setStatus("COMPLETED");
        task.setCompletedAt(now);
        task.setNote(truncate(task.getNote() + " | Kết quả: " + notes, 1000));
        staffTaskRepository.save(task);

        CheckoutSettlement s = newRound(current, staffId, task.getId(), null, null, notes, current.getManagerNote());
        log(staffId, "[SETTLEMENT_RECHECK_DONE] Kiểm tra lại HĐ " + contract.getContractCode() + ": " + items.size()
                + " sự cố → " + describeNet(s.getNetAmount()), contract.getId());
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(facilityIdOf(contract),
                    "Đã kiểm tra lại quyết toán — HĐ " + contract.getContractCode(),
                    "Nhân viên đã lập lại biên bản sự cố: " + describeNet(s.getNetAmount()),
                    "CHECKOUT", "/manager/settlements?highlight=" + s.getId());
        }
        notifyCustomerSettlementReady(s, true);
    }

    /** PR-O22: đang khiếu nại thì không đóng task bảo trì ô (giữ hiện trường để kiểm tra lại) */
    public void assertNotDisputed(Integer contractId) {
        if (contractId == null) return;
        findOpen(contractId).ifPresent(s -> {
            if (List.of(CheckoutSettlement.DISPUTED, CheckoutSettlement.RECHECKING).contains(s.getStatus())) {
                throw new StaffTaskException(HttpStatus.CONFLICT, "SETTLEMENT_DISPUTED",
                        "Khách đang khiếu nại quyết toán trả kho của ô này — chưa đóng bảo trì để giữ hiện trường kiểm tra lại");
            }
        });
    }

    /** Task CHECK_OUT là task kiểm tra lại quyết toán (không phải nghiệm thu bàn giao) */
    public static boolean isRecheckTask(StaffTask task) {
        return task != null && task.getNote() != null && task.getNote().startsWith(RECHECK_TAG);
    }

    // ================== 6. HOÀN TIỀN XONG → HỒ SƠ BỒI THƯỜNG PAID ==================

    /** Gọi từ StaffTaskService.completeRefundTask */
    @Transactional
    public void onRefundCompleted(StaffTask refundTask, String method, String evidence, String ft, Integer managerId) {
        Optional<CheckoutSettlement> found = settlementRepository.findByRefundTaskId(refundTask.getId());
        if (found.isEmpty()) return;
        CheckoutSettlement s = found.get();
        jdbcTemplate.update(
                "UPDATE payment_transactions SET status = 'SUCCESS', payment_method = ?, paid_at = SYSDATETIME(), bank_transaction_code = ? " +
                        "WHERE contract_id = ? AND payment_type = 'COMPENSATION' AND status = 'PENDING'",
                method, ft, s.getContract().getId());
        claimRepository.findForContract(s.getContract().getId()).stream()
                .filter(c -> "APPROVED".equals(c.getStatus()) && Objects.equals(c.getSettlementId(), s.getId()))
                .forEach(c -> claimService.markPaid(c, method, evidence, ft, managerId));
    }

    // ================== 7. JOB (PR-O23) ==================

    /** Chạy mỗi phút (StaffTaskOverdueJob): quyết toán dương chờ khách quá 3 ngày → tự xác nhận */
    public int autoConfirmDue() {
        List<CheckoutSettlement> due = settlementRepository.findAutoConfirmDue(LocalDateTime.now().minusDays(AUTO_CONFIRM_DAYS));
        int done = 0;
        for (CheckoutSettlement item : due) {
            Boolean ok = txTemplate.execute(status -> {
                CheckoutSettlement s = settlementRepository.findById(item.getId()).orElse(null);
                if (s == null || !CheckoutSettlement.WAITING_CUSTOMER.equals(s.getStatus()) || s.customerPays()) return false;
                doConfirm(s, systemUserId(), true);
                if (notificationService != null) {
                    notificationService.notifyCustomer(s.getContract().getCustomer().getId(),
                            "Tự động xác nhận quyết toán — HĐ " + s.getContract().getContractCode(),
                            "Sau " + AUTO_CONFIRM_DAYS + " ngày chưa có phản hồi, hệ thống đã xác nhận quyết toán. Quản lý cơ sở sẽ hoàn "
                                    + vnd(s.getNetAmount()) + ".",
                            "CHECKOUT", contractUrl(s.getContract()));
                }
                return true;
            });
            if (Boolean.TRUE.equals(ok)) done++;
        }
        return done;
    }

    /** Chạy 08:00 (RenewalReminderService): quyết toán âm chưa trả → nhắc ngày 1 / 3 / 7 */
    @Transactional(readOnly = true)
    public int remindUnpaid() {
        if (notificationService == null) return 0;
        LocalDate today = LocalDate.now();
        int sent = 0;
        for (CheckoutSettlement s : settlementRepository.findUnpaidNegative()) {
            long days = ChronoUnit.DAYS.between(s.getCreatedAt().toLocalDate(), today);
            if (!REMIND_DAYS.contains((int) days)) continue;
            RentalContract c = s.getContract();
            notificationService.notifyCustomer(c.getCustomer().getId(), "SETTLEMENT_REMIND_" + s.getId() + "_" + days,
                    "Nhắc thanh toán quyết toán trả kho — HĐ " + c.getContractCode(),
                    "Hợp đồng chỉ kết thúc khi bạn thanh toán " + vnd(s.getNetAmount().abs())
                            + ". Trong thời gian này bạn chưa thể đặt kho mới.",
                    "CHECKOUT", contractUrl(c));
            sent++;
        }
        return sent;
    }

    /** 🔸 Giả lập demo: quyết toán dương đã chờ khách đủ 3 ngày → chạy ngay bước tự xác nhận */
    @Transactional
    public Map<String, Object> simulateAutoConfirm(Integer contractId, CurrentUser actor) {
        if (!simulationEnabled) {
            throw new StaffTaskException(HttpStatus.NOT_FOUND, "SIMULATION_DISABLED", "Chức năng giả lập đang tắt");
        }
        RentalContract contract = contractRepository.findDetailById(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
        checkReadAccess(contract, actor);
        CheckoutSettlement s = requireOpen(contractId);
        if (!CheckoutSettlement.WAITING_CUSTOMER.equals(s.getStatus()) || s.customerPays()) {
            throw invalid("Chỉ giả lập được cho quyết toán dương đang chờ khách xác nhận");
        }
        jdbcTemplate.update("UPDATE checkout_settlements SET created_at = ? WHERE id = ?",
                LocalDateTime.now().minusDays(AUTO_CONFIRM_DAYS).minusMinutes(1), s.getId());
        doConfirm(s, actor.id(), true);
        log(actor.id(), "[SIMULATION] Giả lập quá " + AUTO_CONFIRM_DAYS + " ngày — tự xác nhận quyết toán HĐ " + contract.getContractCode(), contractId);
        return Map.of("message", "Đã tự xác nhận quyết toán, hợp đồng kết thúc", "contractStatus", "TERMINATED");
    }

    // ================== 8. XEM ==================

    @Transactional(readOnly = true)
    public SettlementResponse getForContract(Integer contractId, CurrentUser actor) {
        RentalContract contract = contractRepository.findDetailById(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
        checkReadAccess(contract, actor);
        CheckoutSettlement s = settlementRepository.findTopByContract_IdOrderByRoundNoDesc(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "SETTLEMENT_NOT_FOUND",
                        "Hợp đồng chưa có quyết toán trả kho"));
        return toResponse(s, true);
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> listForManager(CurrentUser actor, String group) {
        if (!"FACILITY_MANAGER".equals(actor.role()) || actor.facilityId() == null) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ quản lý cơ sở xem danh sách quyết toán");
        }
        List<String> statuses = switch (group == null ? "ACTION" : group.toUpperCase()) {
            case "CUSTOMER" -> List.of(CheckoutSettlement.WAITING_CUSTOMER, CheckoutSettlement.RECHECKING);
            case "PAYMENT" -> List.of(CheckoutSettlement.AWAITING_PAYMENT);
            case "DONE" -> List.of(CheckoutSettlement.COMPLETED);
            case "ALL" -> OPEN_STATUSES;
            default -> List.of(CheckoutSettlement.DISPUTED, CheckoutSettlement.WAITING_CLAIM);
        };
        return settlementRepository.findForFacility(actor.facilityId(), statuses).stream()
                .map(s -> toResponse(s, false)).toList();
    }

    SettlementResponse toResponse(CheckoutSettlement s, boolean withDetail) {
        RentalContract c = s.getContract();
        Allocation a = allocate(s);
        boolean waiting = CheckoutSettlement.WAITING_CUSTOMER.equals(s.getStatus());
        // D-22: cùng bố cục "Đã đóng − Giữ lại = Hoàn" với màn hẹn trả kho
        List<MoneyLine> lines = RefundBreakdown.lines(s.getDepositHeld(), RefundBreakdown.RentBasis.parse(s.getRentBasis()),
                s.getRentRefund(), s.getDamageFee(), a.lateOffset(), s.getOverstayFee(), s.getCompensationAmount());
        RefundBreakdown.Totals totals = RefundBreakdown.totals(lines);
        SettlementResponse.SettlementResponseBuilder b = SettlementResponse.builder()
                .lines(lines)
                .paidTotal(totals.paid())
                .keptTotal(totals.kept())
                .addedTotal(totals.added())
                .id(s.getId())
                .contractId(c.getId())
                .contractCode(c.getContractCode())
                .contractStatus(c.getStatus())
                .reservationId(c.getReservation() != null ? c.getReservation().getId() : null)
                .facilityId(facilityIdOf(c))
                .unitId(c.getStorageUnit() != null ? c.getStorageUnit().getId() : null)
                .customerId(c.getCustomer().getId())
                .customerName(c.getCustomer().getFullName())
                .customerPhone(c.getCustomer().getPhone())
                .roundNo(s.getRoundNo())
                .status(s.getStatus())
                .checkoutDate(s.getCheckoutDate())
                .checkOutTaskId(s.getCheckOutTaskId())
                .depositHeld(s.getDepositHeld())
                .damageFee(s.getDamageFee())
                .lateFee(a.lateOffset())
                .overstayFee(s.getOverstayFee())
                .rentRefund(s.getRentRefund())
                .compensationAmount(s.getCompensationAmount())
                .netAmount(s.getNetAmount())
                .direction(s.customerPays() ? "CUSTOMER_PAYS" : "REFUND_TO_CUSTOMER")
                .refundMethod(s.getRefundMethod())
                .breakdownNote(s.getBreakdownNote())
                .staffNote(s.getStaffNote())
                .managerNote(s.getManagerNote())
                .disputeReason(s.getDisputeReason())
                .disputedAt(s.getDisputedAt())
                .customerConfirmedAt(s.getCustomerConfirmedAt())
                .autoConfirmed(s.getAutoConfirmed())
                .createdAt(s.getCreatedAt())
                .autoConfirmAt(waiting && !s.customerPays() ? s.getCreatedAt().plusDays(AUTO_CONFIRM_DAYS) : null)
                .refundTaskId(s.getRefundTaskId())
                .debtTransactionId(s.getDebtTransactionId())
                .canConfirm(waiting)
                .canDispute(waiting)
                .canPay(CheckoutSettlement.AWAITING_PAYMENT.equals(s.getStatus()));
        if (CheckoutSettlement.RECHECKING.equals(s.getStatus())) {
            List<Integer> recheck = jdbcTemplate.queryForList(
                    "SELECT TOP 1 id FROM facility_tasks WHERE contract_id = ? AND task_type = 'CHECK_OUT' " +
                            "AND status IN ('OPEN', 'IN_PROGRESS', 'OVERDUE') AND note LIKE '[[]RECHECK]%' ORDER BY id DESC",
                    Integer.class, c.getId());
            b.recheckTaskId(recheck.isEmpty() ? null : recheck.get(0));
        }
        if (withDetail) {
            b.damages(s.getCheckOutTaskId() == null ? List.of()
                    : damageCaseRepository.findByTask_IdOrderByIdAsc(s.getCheckOutTaskId()).stream()
                    .map(d -> SettlementResponse.DamageLine.builder()
                            .id(d.getId()).title(d.getTitle()).description(d.getDescription())
                            .estimatedCost(d.getEstimatedCost()).liableParty(d.getLiableParty())
                            .evidenceImages(staffTaskService.parseImages(d.getEvidenceImageUrls()))
                            .build())
                    .toList());
            b.claims(claimRepository.findForContract(c.getId()).stream()
                    .filter(cl -> !"WITHDRAWN".equals(cl.getStatus()))
                    .map(cl -> SettlementResponse.ClaimLine.builder()
                            .id(cl.getId()).claimCode(cl.getClaimCode()).claimType(cl.getClaimType()).status(cl.getStatus())
                            .totalCompensation(cl.getTotalCompensation())
                            .includedInSettlement("APPROVED".equals(cl.getStatus()) || Objects.equals(cl.getSettlementId(), s.getId()))
                            .build())
                    .toList());
            List<SettlementResponse.RoundLine> history = new ArrayList<>();
            for (CheckoutSettlement r : settlementRepository.findByContract_IdOrderByRoundNoDesc(c.getId())) {
                if (Objects.equals(r.getId(), s.getId())) continue;
                history.add(SettlementResponse.RoundLine.builder()
                        .id(r.getId()).roundNo(r.getRoundNo()).status(r.getStatus())
                        .damageFee(r.getDamageFee()).netAmount(r.getNetAmount())
                        .staffNote(r.getStaffNote()).managerNote(r.getManagerNote()).disputeReason(r.getDisputeReason())
                        .createdAt(r.getCreatedAt())
                        .build());
            }
            b.history(history);
        }
        return b.build();
    }

    // ================== Kiểm tra quyền & trạng thái ==================

    public Optional<CheckoutSettlement> findOpen(Integer contractId) {
        return settlementRepository.findTopByContract_IdAndStatusInOrderByRoundNoDesc(contractId, OPEN_STATUSES);
    }

    private CheckoutSettlement requireOpen(Integer contractId) {
        return findOpen(contractId).orElseThrow(() -> new StaffTaskException(HttpStatus.CONFLICT, "SETTLEMENT_STATUS_INVALID",
                "Hợp đồng không có quyết toán trả kho đang chờ xử lý"));
    }

    private void requireWaitingCustomer(CheckoutSettlement s) {
        switch (s.getStatus()) {
            case CheckoutSettlement.WAITING_CUSTOMER -> { }
            case CheckoutSettlement.WAITING_CLAIM -> throw new StaffTaskException(HttpStatus.CONFLICT, "SETTLEMENT_NOT_READY",
                    "Quản lý cơ sở chưa chốt hồ sơ bồi thường — bảng quyết toán sẽ cập nhật sau khi chốt");
            case CheckoutSettlement.RECHECKING, CheckoutSettlement.DISPUTED -> throw new StaffTaskException(HttpStatus.CONFLICT,
                    "SETTLEMENT_NOT_READY", "Quyết toán đang được cơ sở xem lại theo phản hồi của bạn");
            default -> throw invalid("Quyết toán không ở bước chờ khách xác nhận (hiện tại: " + s.getStatus() + ")");
        }
    }

    private RentalContract requireOwnContract(Integer contractId, CurrentUser actor) {
        RentalContract contract = contractRepository.findDetailById(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
        if (!"CUSTOMER".equals(actor.role()) || !Objects.equals(contract.getCustomer().getId(), actor.id())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_CONTRACT",
                    "Chỉ khách thuê của hợp đồng mới xác nhận / phản hồi quyết toán");
        }
        return contract;
    }

    private RentalContract requireFacilityContract(Integer contractId, CurrentUser actor) {
        RentalContract contract = contractRepository.findDetailById(contractId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng"));
        if (!List.of("STAFF", "FACILITY_MANAGER").contains(actor.role()) || !Objects.equals(facilityIdOf(contract), actor.facilityId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hợp đồng không thuộc cơ sở của bạn");
        }
        return contract;
    }

    private void checkReadAccess(RentalContract contract, CurrentUser actor) {
        boolean ok = switch (actor.role()) {
            case "CUSTOMER" -> Objects.equals(contract.getCustomer().getId(), actor.id());
            case "STAFF", "FACILITY_MANAGER" -> Objects.equals(facilityIdOf(contract), actor.facilityId());
            case "BOM", "ADMIN" -> true;
            default -> false;
        };
        if (!ok) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_CONTRACT", "Bạn không có quyền xem quyết toán này");
        }
    }

    private CheckoutSettlement requireDisputedForManager(Integer settlementId, CurrentUser actor) {
        if (!"FACILITY_MANAGER".equals(actor.role())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ quản lý cơ sở xử lý khiếu nại quyết toán");
        }
        CheckoutSettlement s = settlementRepository.findById(settlementId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "SETTLEMENT_NOT_FOUND", "Không tìm thấy quyết toán"));
        if (!Objects.equals(facilityIdOf(s.getContract()), actor.facilityId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Quyết toán không thuộc cơ sở của bạn");
        }
        if (!CheckoutSettlement.DISPUTED.equals(s.getStatus())) {
            throw invalid("Chỉ xử lý được quyết toán khách đang không đồng ý (hiện tại: " + s.getStatus() + ")");
        }
        return s;
    }

    private static String requireNote(String note) {
        String n = note != null ? note.trim() : "";
        if (n.length() < 10 || n.length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "DISPUTE_REASON_REQUIRED",
                    "Ghi chú gửi khách bắt buộc (10–1000 ký tự)");
        }
        return n;
    }

    private static StaffTaskException invalid(String message) {
        return new StaffTaskException(HttpStatus.CONFLICT, "SETTLEMENT_STATUS_INVALID", message);
    }

    // ================== Tiện ích ==================

    private void notifyCustomerSettlementReady(CheckoutSettlement s, boolean updated) {
        if (notificationService == null || !CheckoutSettlement.WAITING_CUSTOMER.equals(s.getStatus())) return;
        RentalContract c = s.getContract();
        notificationService.notifyCustomer(c.getCustomer().getId(),
                (updated ? "Quyết toán trả kho đã cập nhật — HĐ " : "Đã nghiệm thu trả kho — HĐ ") + c.getContractCode(),
                "Vui lòng xem biên bản và xác nhận kết thúc hợp đồng. " + describeNet(s.getNetAmount())
                        + (s.customerPays() ? "" : ". Sau " + AUTO_CONFIRM_DAYS + " ngày không phản hồi hệ thống sẽ tự xác nhận."),
                "CHECKOUT", contractUrl(c));
    }

    private Integer insertTxn(String code, Integer userId, Integer reservationId, Integer contractId, String type,
                              String method, BigDecimal amount, String status) {
        if (amount == null || amount.signum() <= 0) return null;
        String txnCode = code + "-" + (System.currentTimeMillis() % 100000);
        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, " +
                        "payment_method, amount, status, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, " +
                        ("SUCCESS".equals(status) ? "SYSDATETIME()" : "NULL") + ")",
                txnCode, userId, reservationId, contractId, type, method, amount.setScale(0, RoundingMode.HALF_UP), status);
        return jdbcTemplate.queryForObject("SELECT id FROM payment_transactions WHERE transaction_code = ?", Integer.class, txnCode);
    }

    private String buildBreakdown(CheckoutSettlement s, Allocation a) {
        StringBuilder sb = new StringBuilder("Cọc ").append(vnd(s.getDepositHeld()));
        if (s.getDamageFee().signum() > 0) sb.append(" − Sự cố lỗi khách ").append(vnd(s.getDamageFee()));
        if (a.lateOffset().signum() > 0) sb.append(" − Phí trễ ").append(vnd(a.lateOffset()));
        if (s.getOverstayFee().signum() > 0) sb.append(" − Phí chiếm dụng ").append(vnd(s.getOverstayFee()));
        if (s.getRentRefund().signum() > 0) sb.append(" + Hoàn tiền thuê ").append(vnd(s.getRentRefund()));
        if (s.getCompensationAmount().signum() > 0) sb.append(" + Bồi thường hàng ").append(vnd(s.getCompensationAmount()));
        sb.append(" = ").append(s.getNetAmount().signum() < 0
                ? "khách cần trả thêm " + vnd(s.getNetAmount().abs())
                : "cơ sở hoàn khách " + vnd(s.getNetAmount()));
        return truncate(sb.toString(), 2000);
    }

    private static String describeNet(BigDecimal net) {
        return net.signum() < 0 ? "khách cần trả thêm " + vnd(net.abs()) : "cơ sở hoàn khách " + vnd(net);
    }

    private void log(Integer actorId, String action, Integer contractId) {
        activityLogService.log(actorId, truncate(action, 500), "rental_contracts", String.valueOf(contractId));
    }

    private Integer systemUserId() {
        List<Integer> ids = jdbcTemplate.queryForList(
                "SELECT TOP 1 id FROM users WHERE email = 'system@queenkho.local'", Integer.class);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private static Integer facilityIdOf(RentalContract c) {
        return c.getStorageUnit() != null && c.getStorageUnit().getFacility() != null ? c.getStorageUnit().getFacility().getId() : null;
    }

    private static String contractUrl(RentalContract c) {
        return c.getReservation() != null ? "/kho-cua-toi/hop-dong/" + c.getReservation().getId() : "/kho-cua-toi";
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static BigDecimal money(BigDecimal v) {
        return nz(v).setScale(0, RoundingMode.HALF_UP);
    }

    static String vnd(BigDecimal amount) {
        return String.format("%,d", nz(amount).setScale(0, RoundingMode.HALF_UP).longValue()).replace(',', '.') + "đ";
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }
}
