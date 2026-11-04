package com.queenkho.api.service;

import com.queenkho.api.dto.ClaimDecisionRequest;
import com.queenkho.api.dto.ClaimPaymentRequest;
import com.queenkho.api.dto.CompensationClaimResponse;
import com.queenkho.api.dto.CompensationQuoteResponse;
import com.queenkho.api.dto.CreateSupportRequestDto;
import com.queenkho.api.entity.CompensationClaim;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.Reservation;
import com.queenkho.api.entity.SupportRequest;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.CompensationClaimRepository;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.SupportRequestRepository;
import com.queenkho.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * BR-126 → BR-128 (04/11/2026, góp ý giảng viên): bồi thường hàng của khách bị hư / mất trong thời gian thuê.
 * Luồng đi qua ticket hỗ trợ (UC-26 / UC-27):
 *  1. Khách gửi ticket GOODS_DAMAGE / GOODS_LOSS kèm danh sách hàng, số tiền đề nghị, ảnh → hồ sơ SUBMITTED.
 *  2. Staff nhận task hỗ trợ, mở ô cùng khách, chụp ảnh + ghi nguyên nhân sơ bộ → INSPECTED (ticket vẫn đang xử lý).
 *  3. FM đối chiếu ảnh nhận kho (BR-121), cảm biến (BR-129) → chốt lỗi + số tiền → APPROVED / REJECTED.
 *  4. FM chi trả có bằng chứng → PAID (giao dịch COMPENSATION); gói có bảo hiểm → gửi hồ sơ đòi bên bảo hiểm.
 */
@Service
public class CompensationClaimService {

    public static final List<String> CLAIM_ISSUE_TYPES = List.of("GOODS_DAMAGE", "GOODS_LOSS");
    static final List<String> LIABLE_PARTIES = List.of("CUSTOMER", "FACILITY", "FORCE_MAJEURE");
    static final List<String> CAUSES = List.of("CUSTOMER", "FACILITY", "FORCE_MAJEURE", "UNKNOWN");
    static final List<String> RESOLUTIONS = List.of("CONTINUE", "TERMINATE");
    static final BigDecimal MAX_CLAIM = BigDecimal.valueOf(10_000_000_000L);
    static final int MAX_UNUSABLE_DAYS = 90;
    private static final String IMG_DELIMITER = "\n|||\n";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private CompensationClaimRepository claimRepository;

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired
    private InsuranceProviderClient insuranceProvider;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public static boolean isClaimIssue(String issueType) {
        return issueType != null && CLAIM_ISSUE_TYPES.contains(issueType.trim().toUpperCase());
    }

    // ================== 1. KHÁCH GỬI HỒ SƠ (gọi từ SupportRequestService.createTicket) ==================

    /** Kiểm tra dữ liệu hồ sơ trước khi lưu ticket (lỗi → không tạo ticket) */
    public void validateClaimInput(String issueType, CreateSupportRequestDto request, RentalContract contract) {
        String items = request.getItemsDescription() != null ? request.getItemsDescription().trim() : "";
        if (items.length() < 10 || items.length() > 2000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_CLAIM",
                    "Danh sách hàng bị ảnh hưởng (tên, số lượng, giá trị) bắt buộc, từ 10 đến 2000 ký tự");
        }
        BigDecimal claimed = request.getClaimedAmount();
        if (claimed == null || claimed.signum() <= 0 || claimed.compareTo(MAX_CLAIM) > 0) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_CLAIM", "Số tiền đề nghị bồi thường phải lớn hơn 0");
        }
        LocalDate incident = request.getIncidentDate();
        if (incident == null || incident.isAfter(LocalDate.now())
                || (contract.getStartDate() != null && incident.isBefore(contract.getStartDate()))) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_CLAIM",
                    "Ngày phát hiện sự cố phải trong thời gian thuê và không ở tương lai");
        }
        if ("GOODS_DAMAGE".equals(issueType) && cleanImages(request.getEvidenceImages()).isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "EVIDENCE_IMAGE_REQUIRED",
                    "Hàng bị hư hỏng cần ít nhất 1 ảnh chụp hàng / hoá đơn");
        }
        if (cleanImages(request.getEvidenceImages()).size() > 10) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_CLAIM", "Tối đa 10 ảnh");
        }
        if (contract.getStorageUnit() == null || contract.getStorageUnit().getFacility() == null) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID", "Hợp đồng chưa gắn ô kho");
        }
    }

    @Transactional
    public CompensationClaim createForTicket(SupportRequest ticket, RentalContract contract, CreateSupportRequestDto request) {
        CompensationClaim claim = new CompensationClaim();
        claim.setClaimCode(generateClaimCode());
        claim.setSupportRequest(ticket);
        claim.setContract(contract);
        claim.setCustomer(ticket.getCustomer());
        claim.setFacilityId(contract.getStorageUnit().getFacility().getId());
        claim.setClaimType(ticket.getIssueType());
        claim.setIncidentDate(request.getIncidentDate());
        claim.setItemsDescription(request.getItemsDescription().trim());
        claim.setClaimedAmount(request.getClaimedAmount().setScale(0, RoundingMode.HALF_UP));
        claim.setCustomerImages(joinImages(cleanImages(request.getEvidenceImages())));
        claim.setStatus("SUBMITTED");
        CompensationClaim saved = claimRepository.save(claim);
        activityLogService.log(ticket.getCustomer().getId(),
                "[CLAIM_CREATE] Hồ sơ bồi thường " + saved.getClaimCode() + " (" + typeLabel(saved.getClaimType())
                        + ") HĐ " + contract.getContractCode() + ", đề nghị " + saved.getClaimedAmount().toPlainString() + "đ",
                "compensation_claims", String.valueOf(saved.getId()));
        return saved;
    }

    /** Khách huỷ ticket còn OPEN → rút hồ sơ */
    @Transactional
    public void withdrawForTicket(Integer ticketId) {
        claimRepository.findByTicketId(ticketId).ifPresent(c -> {
            if (List.of("SUBMITTED", "INSPECTED").contains(c.getStatus())) {
                c.setStatus("WITHDRAWN");
                claimRepository.save(c);
            }
        });
    }

    /** Khách báo "Chưa xong" (khiếu nại) — chỉ hồ sơ bị từ chối mới được kiểm tra lại; đã chi trả thì không mở lại */
    @Transactional
    public void reopenForTicket(Integer ticketId) {
        claimRepository.findByTicketId(ticketId).ifPresent(c -> {
            if ("PAID".equals(c.getStatus()) || "APPROVED".equals(c.getStatus())) {
                throw new StaffTaskException(HttpStatus.CONFLICT, "CLAIM_ALREADY_SETTLED",
                        "Hồ sơ bồi thường " + c.getClaimCode() + " đã được chấp nhận, không mở lại. Vui lòng liên hệ hotline cơ sở nếu cần.");
            }
            if ("REJECTED".equals(c.getStatus())) {
                c.setStatus("SUBMITTED");
                c.setLiableParty(null);
                c.setDecidedAt(null);
                c.setDecidedBy(null);
                claimRepository.save(c);
            }
        });
    }

    // ================== 2. STAFF KIỂM TRA HIỆN TRƯỜNG (gọi từ StaffTaskService.resolveSupportTask) ==================

    @Transactional
    public CompensationClaim recordInspection(Integer ticketId, User staff, String note, List<String> images, String cause) {
        CompensationClaim claim = claimRepository.findByTicketId(ticketId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CLAIM_NOT_FOUND", "Không tìm thấy hồ sơ bồi thường của ticket"));
        if (!"SUBMITTED".equals(claim.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CLAIM_STATUS_INVALID",
                    "Hồ sơ " + claim.getClaimCode() + " không ở trạng thái chờ kiểm tra");
        }
        List<String> photos = cleanImages(images);
        if (photos.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "EVIDENCE_IMAGE_REQUIRED",
                    "Biên bản kiểm tra bắt buộc ít nhất 1 ảnh hiện trường (ô, hàng hư, dấu vết thấm / cạy...)");
        }
        if (photos.size() > 10) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Tối đa 10 ảnh");
        }
        String normCause = cause != null ? cause.trim().toUpperCase() : "";
        if (!CAUSES.contains(normCause)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Chọn nguyên nhân sơ bộ: CUSTOMER / FACILITY / FORCE_MAJEURE / UNKNOWN");
        }
        if (note == null || note.trim().length() < 10) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Biên bản kiểm tra tối thiểu 10 ký tự");
        }
        claim.setInspectedBy(staff);
        claim.setInspectedAt(LocalDateTime.now());
        claim.setInspectionNote(note.trim());
        claim.setInspectionImages(joinImages(photos));
        claim.setPreliminaryCause(normCause);
        claim.setStatus("INSPECTED");
        claimRepository.save(claim);

        activityLogService.log(staff.getId(),
                "[CLAIM_INSPECT] " + staff.getFullName() + " kiểm tra hồ sơ " + claim.getClaimCode() + ", nguyên nhân sơ bộ "
                        + normCause + ": " + truncate(note.trim(), 300),
                "compensation_claims", String.valueOf(claim.getId()));
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(claim.getFacilityId(),
                    "Hồ sơ bồi thường " + claim.getClaimCode() + " chờ quyết định",
                    staff.getFullName() + " đã kiểm tra hiện trường (nguyên nhân sơ bộ: " + causeLabel(normCause)
                            + "). Vui lòng thẩm định và chốt mức bồi thường.",
                    "SUPPORT", "/manager/claims/" + claim.getId());
            notificationService.notifyCustomer(claim.getCustomer().getId(),
                    "Đã kiểm tra hiện trường hồ sơ " + claim.getClaimCode(),
                    "Nhân viên cơ sở đã kiểm tra ô và hàng của bạn. Quản lý cơ sở sẽ thẩm định và báo kết quả bồi thường.",
                    "SUPPORT", "/ho-tro");
        }
        return claim;
    }

    // ================== 3. FM THẨM ĐỊNH & CHỐT ==================

    /**
     * BR-127: bảng tính bồi thường (hàm thuần — dùng chung cho xem trước và lúc chốt).
     *  - Thiệt hại hàng = giá trị thẩm định × % hư hại (mất hàng = 100%).
     *  - Trần = min(giá trị khai báo lúc đặt, trần gói); không khai báo → 5 triệu.
     *  - Lỗi cơ sở (FACILITY): tiền hàng (≤ trần) + phạt vi phạm 1 tháng giá thuê + hoàn tiền thuê những ngày ô không dùng được.
     *  - Bất khả kháng (FORCE_MAJEURE): chỉ gói có bảo hiểm mới được bồi thường tiền hàng (≤ trần); + hoàn tiền thuê ngày không dùng được; không phạt.
     *  - Lỗi khách (CUSTOMER): 0.
     *  Không đền "gấp đôi giá trị hàng" (dễ trục lợi) — phần "đền thêm" là khoản phạt vi phạm 1 tháng tiền thuê.
     */
    public static CompensationQuoteResponse compute(String liableParty, String claimType, BigDecimal assessedValue,
                                                    Integer damagePercent, Integer unusableDays, InsurancePlan plan,
                                                    BigDecimal declaredValue, BigDecimal monthlyPrice) {
        BigDecimal assessed = assessedValue != null ? assessedValue.max(BigDecimal.ZERO) : BigDecimal.ZERO;
        int percent = "GOODS_LOSS".equals(claimType) ? 100 : Math.max(0, Math.min(100, damagePercent != null ? damagePercent : 0));
        int days = Math.max(0, unusableDays != null ? unusableDays : 0);
        BigDecimal price = monthlyPrice != null ? monthlyPrice : BigDecimal.ZERO;

        BigDecimal goodsLoss = assessed.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        BigDecimal cap = plan.coverageCap(declaredValue).setScale(0, RoundingMode.HALF_UP);
        BigDecimal dailyRent = LateFeeService.dailyRate(price);

        BigDecimal goods = BigDecimal.ZERO;
        BigDecimal penalty = BigDecimal.ZERO;
        BigDecimal rentRefund = BigDecimal.ZERO;
        String explanation;
        switch (liableParty == null ? "" : liableParty) {
            case "FACILITY" -> {
                goods = goodsLoss.min(cap);
                penalty = price.setScale(0, RoundingMode.HALF_UP);
                rentRefund = dailyRent.multiply(BigDecimal.valueOf(days));
                explanation = "Lỗi cơ sở: bồi thường tiền hàng (tối đa trần gói " + plan.label() + ") + phạt vi phạm 1 tháng tiền thuê"
                        + (days > 0 ? " + hoàn tiền thuê " + days + " ngày ô không dùng được" : "") + ".";
            }
            case "FORCE_MAJEURE" -> {
                goods = plan.insured() ? goodsLoss.min(cap) : BigDecimal.ZERO;
                rentRefund = dailyRent.multiply(BigDecimal.valueOf(days));
                explanation = plan.insured()
                        ? "Bất khả kháng, gói " + plan.label() + " có bảo hiểm: bồi thường tiền hàng tối đa trần gói (cơ sở chi trước, đòi lại bên bảo hiểm), không phạt vi phạm."
                        : "Bất khả kháng, gói Cơ bản không có bảo hiểm: không bồi thường tiền hàng, chỉ hoàn tiền thuê những ngày ô không dùng được.";
            }
            default -> explanation = "Lỗi do khách (đóng gói, hàng tự hư, hàng cấm...): không bồi thường.";
        }
        BigDecimal total = goods.add(penalty).add(rentRefund);
        boolean claimable = plan.insured() && goods.signum() > 0 && !"CUSTOMER".equals(liableParty);
        return new CompensationQuoteResponse(liableParty, goodsLoss, cap, goods, penalty, rentRefund, total, claimable, explanation);
    }

    @Transactional(readOnly = true)
    public CompensationQuoteResponse quote(Integer claimId, Integer userId, ClaimDecisionRequest request) {
        CompensationClaim claim = findForManager(claimId, userId, false);
        validateDecision(claim, request, false);
        return computeFor(claim, request);
    }

    @Transactional
    public CompensationClaimResponse decide(Integer claimId, Integer managerId, ClaimDecisionRequest request) {
        CompensationClaim claim = findForManager(claimId, managerId, true);
        if (!"INSPECTED".equals(claim.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CLAIM_STATUS_INVALID",
                    "Chỉ chốt được hồ sơ đã kiểm tra hiện trường (hiện tại: " + claim.getStatus() + ")");
        }
        validateDecision(claim, request, true);
        CompensationQuoteResponse q = computeFor(claim, request);
        User manager = userRepository.findById(managerId).orElseThrow();
        String liable = request.getLiableParty().trim().toUpperCase();
        String resolution = request.getResolution() != null ? request.getResolution().trim().toUpperCase() : "CONTINUE";
        LocalDateTime now = LocalDateTime.now();

        claim.setLiableParty(liable);
        claim.setAssessedValue(request.getAssessedValue().setScale(0, RoundingMode.HALF_UP));
        claim.setDamagePercent("GOODS_LOSS".equals(claim.getClaimType()) ? 100 : request.getDamagePercent());
        claim.setUnusableDays(request.getUnusableDays() != null ? request.getUnusableDays() : 0);
        claim.setCoverageCap(q.coverageCap());
        claim.setGoodsCompensation(q.goodsCompensation());
        claim.setPenaltyAmount(q.penaltyAmount());
        claim.setRentRefundAmount(q.rentRefundAmount());
        claim.setTotalCompensation(q.totalCompensation());
        claim.setResolution("CUSTOMER".equals(liable) ? "CONTINUE" : resolution);
        claim.setDecisionNote(request.getNote().trim());
        claim.setDecidedBy(manager);
        claim.setDecidedAt(now);
        boolean rejected = "CUSTOMER".equals(liable) || q.totalCompensation().signum() == 0;
        claim.setStatus(rejected ? "REJECTED" : "APPROVED");
        claimRepository.save(claim);

        // BR-127: chấm dứt do lỗi cơ sở / bất khả kháng → trả kho không phí phá HĐ, hoàn tiền thuê theo ngày còn lại
        RentalContract contract = claim.getContract();
        if (!rejected && "TERMINATE".equals(claim.getResolution())) {
            contract.setFaultTermination(true);
            rentalContractRepository.save(contract);
        }

        SupportRequest ticket = claim.getSupportRequest();
        if (rejected) {
            resolveTicket(ticket, "Hồ sơ " + claim.getClaimCode() + " không được bồi thường: " + claim.getDecisionNote(), now);
        }

        activityLogService.log(managerId,
                "[CLAIM_DECIDE] " + manager.getFullName() + " chốt hồ sơ " + claim.getClaimCode() + ": " + liable
                        + ", bồi thường " + q.totalCompensation().toPlainString() + "đ" + (rejected ? " (từ chối)" : "")
                        + ", " + claim.getResolution(),
                "compensation_claims", String.valueOf(claim.getId()));
        if (notificationService != null) {
            String body = rejected
                    ? "Kết quả thẩm định: " + causeLabel(liable) + ". " + claim.getDecisionNote()
                      + " Nếu không đồng ý, bạn có thể bấm \"Chưa xong\" trong yêu cầu hỗ trợ để được kiểm tra lại."
                    : "Bạn được bồi thường " + formatVnd(q.totalCompensation()) + " (hàng " + formatVnd(q.goodsCompensation())
                      + (q.penaltyAmount().signum() > 0 ? ", phạt vi phạm " + formatVnd(q.penaltyAmount()) : "")
                      + (q.rentRefundAmount().signum() > 0 ? ", hoàn tiền thuê " + formatVnd(q.rentRefundAmount()) : "")
                      + "). " + ("TERMINATE".equals(claim.getResolution())
                        ? "Bạn được chấm dứt hợp đồng không mất phí phá hợp đồng — hãy hẹn trả kho, tiền thuê còn lại hoàn theo ngày."
                        : "Cơ sở sẽ chuyển tiền và có thể chuyển bạn sang ô khác cùng loại miễn phí.");
            notificationService.notifyCustomer(claim.getCustomer().getId(),
                    (rejected ? "Hồ sơ bồi thường " + claim.getClaimCode() + " không được chấp nhận"
                            : "Hồ sơ bồi thường " + claim.getClaimCode() + " được chấp nhận"),
                    body, "SUPPORT", "/ho-tro");
        }
        return toResponse(claim);
    }

    // ================== 4. CHI TRẢ & ĐÒI BẢO HIỂM ==================

    @Transactional
    public CompensationClaimResponse pay(Integer claimId, Integer managerId, ClaimPaymentRequest request) {
        CompensationClaim claim = findForManager(claimId, managerId, true);
        if (!"APPROVED".equals(claim.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CLAIM_STATUS_INVALID",
                    "Chỉ chi trả hồ sơ đã được chấp nhận (hiện tại: " + claim.getStatus() + ")");
        }
        String method = request != null && request.getPaymentMethod() != null ? request.getPaymentMethod().trim().toUpperCase() : "";
        if (!List.of("BANK_TRANSFER", "CASH").contains(method)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Chọn hình thức chi trả: BANK_TRANSFER hoặc CASH");
        }
        String evidence = request.getEvidenceImageUrl() != null && !request.getEvidenceImageUrl().isBlank()
                ? request.getEvidenceImageUrl().trim() : null;
        // Như PR-O15: chuyển khoản bắt buộc ảnh ủy nhiệm chi; tiền mặt bắt buộc khách ký nhận
        if ("BANK_TRANSFER".equals(method) && evidence == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "PAYMENT_EVIDENCE_REQUIRED",
                    "Chuyển khoản bắt buộc ảnh / link ủy nhiệm chi");
        }
        if ("CASH".equals(method) && !Boolean.TRUE.equals(request.getCashReceiptConfirmed()) && evidence == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "PAYMENT_EVIDENCE_REQUIRED",
                    "Tiền mặt bắt buộc xác nhận khách đã ký nhận (hoặc ảnh biên nhận)");
        }
        String ft = request.getBankTransactionCode() != null && !request.getBankTransactionCode().isBlank()
                ? request.getBankTransactionCode().trim() : null;
        User manager = userRepository.findById(managerId).orElseThrow();
        LocalDateTime now = LocalDateTime.now();
        RentalContract contract = claim.getContract();

        jdbcTemplate.update(
                "INSERT INTO payment_transactions (transaction_code, user_id, reservation_id, contract_id, payment_type, " +
                        "payment_method, amount, status, paid_at, bank_transaction_code) VALUES (?, ?, ?, ?, 'COMPENSATION', ?, ?, 'SUCCESS', SYSDATETIME(), ?)",
                "BT-PAY-" + claim.getId() + "-" + (System.currentTimeMillis() % 100000),
                claim.getCustomer().getId(),
                contract.getReservation() != null ? contract.getReservation().getId() : null,
                contract.getId(), method, claim.getTotalCompensation(), ft);

        claim.setPaymentMethod(method);
        claim.setPaymentEvidence(evidence);
        claim.setBankTransactionCode(ft);
        claim.setPaidBy(manager);
        claim.setPaidAt(now);
        claim.setStatus("PAID");

        // BR-128: gói có bảo hiểm → cơ sở đã chi trước, gửi hồ sơ đòi lại phần tiền hàng
        InsurancePlan plan = planOf(contract);
        if (plan.insured() && claim.getGoodsCompensation() != null && claim.getGoodsCompensation().signum() > 0) {
            var result = insuranceProvider.submitClaim(claim.getClaimCode(), plan.name(), claim.getGoodsCompensation(),
                    typeLabel(claim.getClaimType()) + " — " + truncate(claim.getItemsDescription(), 200));
            claim.setInsuranceStatus(result.status());
            claim.setInsuranceRef(result.ref());
            claim.setInsuranceAmount(result.amount());
            claim.setInsuranceUpdatedAt(now);
        } else {
            claim.setInsuranceStatus("NOT_APPLICABLE");
        }
        claimRepository.save(claim);

        resolveTicket(claim.getSupportRequest(), "Đã bồi thường " + formatVnd(claim.getTotalCompensation())
                + " cho hồ sơ " + claim.getClaimCode() + ". " + claim.getDecisionNote(), now);

        activityLogService.log(managerId,
                "[CLAIM_PAY] " + manager.getFullName() + " chi trả " + claim.getTotalCompensation().toPlainString() + "đ hồ sơ "
                        + claim.getClaimCode() + " (" + method + ")"
                        + (claim.getInsuranceRef() != null ? ", gửi bảo hiểm " + claim.getInsuranceRef() : ""),
                "compensation_claims", String.valueOf(claim.getId()));
        if (notificationService != null) {
            notificationService.notifyCustomer(claim.getCustomer().getId(),
                    "Đã chi trả bồi thường hồ sơ " + claim.getClaimCode(),
                    "QueenKho đã chi trả " + formatVnd(claim.getTotalCompensation())
                            + ("BANK_TRANSFER".equals(method) ? " qua chuyển khoản" : " tiền mặt tại quầy")
                            + ". Vui lòng xác nhận trong mục Hỗ trợ.",
                    "REFUND", "/ho-tro");
        }
        return toResponse(claim);
    }

    /** 🔸 Giả lập phản hồi của bên bảo hiểm: duyệt và chuyển tiền hàng cho cơ sở */
    @Transactional
    public CompensationClaimResponse simulateInsurancePayout(Integer claimId, Integer actorId) {
        CompensationClaim claim = claimRepository.findDetailById(claimId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CLAIM_NOT_FOUND", "Không tìm thấy hồ sơ bồi thường"));
        if (!"SUBMITTED".equals(claim.getInsuranceStatus()) || claim.getInsuranceRef() == null) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "SIMULATION_NOT_APPLICABLE",
                    "Hồ sơ chưa gửi bảo hiểm hoặc bảo hiểm đã xử lý xong");
        }
        var result = insuranceProvider.settleClaim(claim.getInsuranceRef(), claim.getGoodsCompensation());
        claim.setInsuranceStatus(result.status());
        claim.setInsuranceAmount(result.amount());
        claim.setInsuranceUpdatedAt(LocalDateTime.now());
        claimRepository.save(claim);
        activityLogService.log(actorId, "[SIMULATION] Bảo hiểm chi trả " + result.amount().toPlainString() + "đ cho hồ sơ "
                + claim.getClaimCode() + " (" + claim.getInsuranceRef() + ")", "compensation_claims", String.valueOf(claim.getId()));
        if (notificationService != null) {
            notificationService.notifyFacilityManagers(claim.getFacilityId(),
                    "Bảo hiểm đã chi trả hồ sơ " + claim.getClaimCode(),
                    result.message(), "REFUND", "/manager/claims/" + claim.getId());
        }
        return toResponse(claim);
    }

    // ================== ĐỌC ==================

    /** FM: hồ sơ của cơ sở mình · BOM: toàn chuỗi (lọc facilityId) */
    @Transactional(readOnly = true)
    public List<CompensationClaimResponse> list(Integer userId, Integer facilityId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        Integer target = "BOM".equals(roleOf(user)) ? facilityId : user.getFacilityId();
        if (!"BOM".equals(roleOf(user)) && target == null) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Tài khoản chưa gán cơ sở");
        }
        return claimRepository.findForFacility(target).stream()
                .map(c -> toResponse(claimRepository.findDetailById(c.getId()).orElse(c)))
                .toList();
    }

    @Transactional(readOnly = true)
    public CompensationClaimResponse detail(Integer claimId, Integer userId) {
        return toResponse(findForManager(claimId, userId, false));
    }

    /** Khách xem hồ sơ trong ticket của mình (batch theo danh sách ticket) */
    @Transactional(readOnly = true)
    public Map<Integer, CompensationClaimResponse> byTicketIds(Collection<Integer> ticketIds) {
        if (ticketIds == null || ticketIds.isEmpty()) return Collections.emptyMap();
        Map<Integer, CompensationClaimResponse> result = new HashMap<>();
        for (CompensationClaim c : claimRepository.findByTicketIds(ticketIds)) {
            CompensationClaim full = claimRepository.findDetailById(c.getId()).orElse(c);
            result.put(full.getSupportRequest().getId(), toResponse(full));
        }
        return result;
    }

    // ================== Helpers ==================

    private CompensationClaim findForManager(Integer claimId, Integer userId, boolean write) {
        CompensationClaim claim = claimRepository.findDetailById(claimId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CLAIM_NOT_FOUND", "Không tìm thấy hồ sơ bồi thường"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản"));
        String role = roleOf(user);
        if ("BOM".equals(role) && !write) {
            return claim;
        }
        if (!"FACILITY_MANAGER".equals(role)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_ROLE", "Chỉ Quản lý cơ sở được xử lý hồ sơ bồi thường");
        }
        if (!Objects.equals(user.getFacilityId(), claim.getFacilityId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_FACILITY", "Hồ sơ không thuộc cơ sở của bạn");
        }
        return claim;
    }

    private void validateDecision(CompensationClaim claim, ClaimDecisionRequest request, boolean full) {
        if (request == null || request.getLiableParty() == null
                || !LIABLE_PARTIES.contains(request.getLiableParty().trim().toUpperCase())) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Chọn bên chịu lỗi: CUSTOMER / FACILITY / FORCE_MAJEURE");
        }
        BigDecimal assessed = request.getAssessedValue();
        if (assessed == null || assessed.signum() < 0 || assessed.compareTo(claim.getClaimedAmount()) > 0) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Giá trị thẩm định từ 0 đến số khách đề nghị (" + claim.getClaimedAmount().toPlainString() + "đ)");
        }
        if ("GOODS_DAMAGE".equals(claim.getClaimType())
                && (request.getDamagePercent() == null || request.getDamagePercent() < 1 || request.getDamagePercent() > 100)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mức hư hại từ 1 đến 100%");
        }
        if (request.getUnusableDays() != null && (request.getUnusableDays() < 0 || request.getUnusableDays() > MAX_UNUSABLE_DAYS)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Số ngày ô không dùng được từ 0 đến " + MAX_UNUSABLE_DAYS);
        }
        if (!full) return;
        String resolution = request.getResolution() != null ? request.getResolution().trim().toUpperCase() : "CONTINUE";
        if (!RESOLUTIONS.contains(resolution)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Hướng xử lý: CONTINUE hoặc TERMINATE");
        }
        if ("TERMINATE".equals(resolution)
                && !List.of("ACTIVE", "OVERDUE", "TERMINATION_PENDING").contains(claim.getContract().getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Hợp đồng không còn hiệu lực nên không chọn chấm dứt được");
        }
        if (request.getNote() == null || request.getNote().trim().length() < 10 || request.getNote().trim().length() > 1000) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Ghi chú kết luận (gửi cho khách) từ 10 đến 1000 ký tự");
        }
    }

    private CompensationQuoteResponse computeFor(CompensationClaim claim, ClaimDecisionRequest request) {
        RentalContract contract = claim.getContract();
        Reservation r = contract.getReservation();
        BigDecimal price = contract.getStorageUnit().getUnitType().getBasePriceMonthly();
        return compute(request.getLiableParty().trim().toUpperCase(), claim.getClaimType(), request.getAssessedValue(),
                request.getDamagePercent(), request.getUnusableDays(), planOf(contract),
                r != null ? r.getDeclaredGoodsValue() : null, price);
    }

    private void resolveTicket(SupportRequest ticket, String note, LocalDateTime now) {
        if (ticket == null || "CLOSED".equals(ticket.getStatus())) return;
        ticket.setStatus("RESOLVED");
        ticket.setResolutionNote(truncate(note, 1000));
        ticket.setResolvedAt(now);
        supportRequestRepository.save(ticket);
    }

    static InsurancePlan planOf(RentalContract contract) {
        return InsurancePlan.of(contract.getReservation() != null ? contract.getReservation().getInsurancePlan() : null);
    }

    public CompensationClaimResponse toResponse(CompensationClaim c) {
        RentalContract contract = c.getContract();
        Reservation r = contract != null ? contract.getReservation() : null;
        InsurancePlan plan = contract != null ? planOf(contract) : InsurancePlan.BASIC;
        var su = contract != null ? contract.getStorageUnit() : null;
        SupportRequest ticket = c.getSupportRequest();
        User customer = c.getCustomer();
        return CompensationClaimResponse.builder()
                .id(c.getId())
                .claimCode(c.getClaimCode())
                .claimType(c.getClaimType())
                .status(c.getStatus())
                .createdAt(c.getCreatedAt())
                .incidentDate(c.getIncidentDate())
                .itemsDescription(c.getItemsDescription())
                .claimedAmount(c.getClaimedAmount())
                .customerImages(splitImages(c.getCustomerImages()))
                .ticketId(ticket != null ? ticket.getId() : null)
                .ticketCode(ticket != null ? ticket.getTicketCode() : null)
                .ticketStatus(ticket != null ? ticket.getStatus() : null)
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .reservationId(r != null ? r.getId() : null)
                .storageUnitId(su != null ? su.getId() : null)
                .unitTypeName(su != null && su.getUnitType() != null ? su.getUnitType().getName() : null)
                .monthlyPrice(su != null && su.getUnitType() != null ? su.getUnitType().getBasePriceMonthly() : null)
                .facilityId(c.getFacilityId())
                .facilityName(su != null && su.getFacility() != null ? su.getFacility().getName() : null)
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .insurancePlan(plan.name())
                .insurancePlanLabel(plan.label())
                .insured(plan.insured())
                .declaredGoodsValue(r != null ? r.getDeclaredGoodsValue() : null)
                .planCoverageLimit(plan.coverageLimit())
                .inspectedByName(c.getInspectedBy() != null ? c.getInspectedBy().getFullName() : null)
                .inspectedAt(c.getInspectedAt())
                .inspectionNote(c.getInspectionNote())
                .inspectionImages(splitImages(c.getInspectionImages()))
                .preliminaryCause(c.getPreliminaryCause())
                .liableParty(c.getLiableParty())
                .assessedValue(c.getAssessedValue())
                .damagePercent(c.getDamagePercent())
                .unusableDays(c.getUnusableDays())
                .coverageCap(c.getCoverageCap() != null ? c.getCoverageCap() : plan.coverageCap(r != null ? r.getDeclaredGoodsValue() : null))
                .goodsCompensation(c.getGoodsCompensation())
                .penaltyAmount(c.getPenaltyAmount())
                .rentRefundAmount(c.getRentRefundAmount())
                .totalCompensation(c.getTotalCompensation())
                .resolution(c.getResolution())
                .decisionNote(c.getDecisionNote())
                .decidedByName(c.getDecidedBy() != null ? c.getDecidedBy().getFullName() : null)
                .decidedAt(c.getDecidedAt())
                .paymentMethod(c.getPaymentMethod())
                .paymentEvidence(c.getPaymentEvidence())
                .bankTransactionCode(c.getBankTransactionCode())
                .paidByName(c.getPaidBy() != null ? c.getPaidBy().getFullName() : null)
                .paidAt(c.getPaidAt())
                .insuranceStatus(c.getInsuranceStatus())
                .insuranceRef(c.getInsuranceRef())
                .insuranceAmount(c.getInsuranceAmount())
                .insuranceUpdatedAt(c.getInsuranceUpdatedAt())
                .build();
    }

    private String generateClaimCode() {
        for (int i = 0; i < 30; i++) {
            String code = "BT-" + (100000 + RANDOM.nextInt(900000));
            if (!claimRepository.existsByClaimCode(code)) return code;
        }
        return "BT-" + (System.currentTimeMillis() % 1000000);
    }

    static List<String> cleanImages(List<String> images) {
        if (images == null) return Collections.emptyList();
        return images.stream().filter(s -> s != null && !s.isBlank()).map(String::trim).toList();
    }

    private static String joinImages(List<String> images) {
        return images.isEmpty() ? null : String.join(IMG_DELIMITER, images);
    }

    private static List<String> splitImages(String raw) {
        if (raw == null || raw.isBlank()) return Collections.emptyList();
        return Arrays.stream(raw.split("\\R?\\|\\|\\|\\R?")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String roleOf(User user) {
        return user.getRole() != null ? user.getRole().getName() : "";
    }

    static String typeLabel(String type) {
        return "GOODS_LOSS".equals(type) ? "Mất hàng" : "Hàng bị hư hỏng";
    }

    static String causeLabel(String cause) {
        return switch (cause == null ? "" : cause) {
            case "CUSTOMER" -> "lỗi do khách";
            case "FACILITY" -> "lỗi do cơ sở";
            case "FORCE_MAJEURE" -> "bất khả kháng";
            default -> "chưa xác định";
        };
    }

    private static String formatVnd(BigDecimal amount) {
        return String.format("%,d", amount.setScale(0, RoundingMode.HALF_UP).longValue()).replace(',', '.') + "đ";
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }
}
