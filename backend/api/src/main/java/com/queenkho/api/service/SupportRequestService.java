package com.queenkho.api.service;

import com.queenkho.api.dto.CreateSupportRequestDto;
import com.queenkho.api.dto.ReopenSupportRequestDto;
import com.queenkho.api.dto.SupportEligibleContractDto;
import com.queenkho.api.dto.SupportRequestResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.entity.StaffTask;
import com.queenkho.api.entity.SupportRequest;
import com.queenkho.api.entity.StorageUnit;
import com.queenkho.api.entity.User;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.RentalContractRepository;
import com.queenkho.api.repository.StaffTaskRepository;
import com.queenkho.api.repository.SupportRequestRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class SupportRequestService {

    public static final List<String> ELIGIBLE_CONTRACT_STATUSES = List.of("ACTIVE", "OVERDUE", "TERMINATION_PENDING");
    public static final List<String> OPEN_TICKET_STATUSES = List.of("OPEN", "IN_PROGRESS", "RESOLVED");
    public static final List<String> OPEN_TASK_STATUSES = List.of("OPEN", "IN_PROGRESS", "OVERDUE");
    public static final List<String> VALID_ISSUE_TYPES = List.of(
            "LOCK_ISSUE", "SECURITY", "FACILITY_DAMAGE", "CLEANING", "OTHER"
    );
    public static final Set<String> URGENT_ISSUE_TYPES = Set.of("LOCK_ISSUE", "SECURITY");

    private static final int MAX_OPEN_TICKETS_PER_CONTRACT = 3;
    private static final int DESCRIPTION_MIN_LENGTH = 10;
    private static final int DESCRIPTION_MAX_LENGTH = 1000;
    private static final int REOPEN_REASON_MAX_LENGTH = 500;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @Autowired
    private SupportRequestRepository supportRequestRepository;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    @Autowired
    private StaffTaskRepository staffTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StaffTaskService staffTaskService;

    @Autowired
    private ActivityLogService activityLogService;

    @PersistenceContext
    private EntityManager entityManager;

    public static boolean isUrgentIssue(String issueType) {
        return issueType != null && URGENT_ISSUE_TYPES.contains(issueType.trim().toUpperCase());
    }

    public static String getIssueTypeLabel(String issueType) {
        if (issueType == null) return "Khác";
        return switch (issueType.trim().toUpperCase()) {
            case "LOCK_ISSUE" -> "Sự cố khóa / Mã PIN";
            case "SECURITY" -> "An ninh / Cảnh báo khẩn";
            case "FACILITY_DAMAGE" -> "Hư hỏng cơ sở vật chất";
            case "CLEANING" -> "Vệ sinh kho bãi";
            case "OTHER" -> "Yêu cầu hỗ trợ khác";
            default -> issueType;
        };
    }

    // ──────────────────────────────────────────────────────
    // UC-26: Lấy danh sách hợp đồng đủ điều kiện gửi hỗ trợ (PR-51, PR-S2)
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<SupportEligibleContractDto> getEligibleContracts(Integer customerId) {
        validateCustomer(customerId);
        List<RentalContract> contracts = rentalContractRepository.findAllByCustomerId(customerId);
        List<SupportRequest> customerTickets = supportRequestRepository.findByCustomerIdWithDetails(customerId);

        Map<Integer, List<String>> openIssuesByContract = new HashMap<>();
        for (SupportRequest sr : customerTickets) {
            if (sr.getContract() != null && OPEN_TICKET_STATUSES.contains(sr.getStatus())) {
                openIssuesByContract
                        .computeIfAbsent(sr.getContract().getId(), k -> new ArrayList<>())
                        .add(sr.getIssueType());
            }
        }

        List<SupportEligibleContractDto> result = new ArrayList<>();
        for (RentalContract c : contracts) {
            if (!ELIGIBLE_CONTRACT_STATUSES.contains(c.getStatus())) {
                continue;
            }
            StorageUnit su = c.getStorageUnit();
            List<String> openTypes = openIssuesByContract.getOrDefault(c.getId(), Collections.emptyList());
            result.add(SupportEligibleContractDto.builder()
                    .contractId(c.getId())
                    .contractCode(c.getContractCode())
                    .status(c.getStatus())
                    .startDate(c.getStartDate())
                    .endDate(c.getEndDate())
                    .storageUnitId(su != null ? su.getId() : null)
                    .unitTypeName(su != null && su.getUnitType() != null ? su.getUnitType().getName() : null)
                    .facilityId(su != null && su.getFacility() != null ? su.getFacility().getId() : null)
                    .facilityName(su != null && su.getFacility() != null ? su.getFacility().getName() : null)
                    .openTicketCount(openTypes.size())
                    .openIssueTypes(openTypes)
                    .build());
        }
        return result;
    }

    // ──────────────────────────────────────────────────────
    // UC-26 / PR-S9: Danh sách ticket hỗ trợ của khách hàng
    // ──────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<SupportRequestResponse> getCustomerTickets(Integer customerId, String statusFilter, Integer contractIdFilter) {
        validateCustomer(customerId);
        List<SupportRequest> tickets = supportRequestRepository.findByCustomerIdWithDetails(customerId);

        String normStatus = (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter))
                ? statusFilter.trim().toUpperCase()
                : null;

        List<SupportRequest> filtered = tickets.stream()
                .filter(t -> normStatus == null || normStatus.equalsIgnoreCase(t.getStatus()))
                .filter(t -> contractIdFilter == null || (t.getContract() != null && contractIdFilter.equals(t.getContract().getId())))
                .toList();

        if (filtered.isEmpty()) {
            return Collections.emptyList();
        }

        List<Integer> ticketIds = filtered.stream().map(SupportRequest::getId).toList();
        List<StaffTask> tasks = staffTaskRepository.findBySupportRequestIdInWithStaff(ticketIds);
        Map<Integer, StaffTask> latestTaskByTicketId = new HashMap<>();
        for (StaffTask t : tasks) {
            if (t.getSupportRequestId() != null && !latestTaskByTicketId.containsKey(t.getSupportRequestId())) {
                latestTaskByTicketId.put(t.getSupportRequestId(), t);
            }
        }

        return filtered.stream()
                .map(sr -> toResponse(sr, latestTaskByTicketId.get(sr.getId())))
                .toList();
    }

    // ──────────────────────────────────────────────────────
    // UC-26 / PR-51, PR-S1, PR-S2, PR-34: Tạo ticket hỗ trợ mới + sinh task SUPPORT
    // ──────────────────────────────────────────────────────
    @Transactional
    public SupportRequestResponse createTicket(Integer customerId, CreateSupportRequestDto request) {
        User customer = validateCustomer(customerId);

        if (request == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin yêu cầu hỗ trợ");
        }
        if (request.getContractId() == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Vui lòng chọn hợp đồng cần hỗ trợ (PR-51)");
        }

        String issueType = request.getIssueType() != null ? request.getIssueType().trim().toUpperCase() : "";
        if (!VALID_ISSUE_TYPES.contains(issueType)) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Loại yêu cầu hỗ trợ không hợp lệ. Chỉ chấp nhận: LOCK_ISSUE, SECURITY, FACILITY_DAMAGE, CLEANING, OTHER");
        }

        String desc = request.getDescription() != null ? request.getDescription().trim() : "";
        if (desc.length() < DESCRIPTION_MIN_LENGTH || desc.length() > DESCRIPTION_MAX_LENGTH) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Mô tả sự cố phải từ " + DESCRIPTION_MIN_LENGTH + " đến " + DESCRIPTION_MAX_LENGTH + " ký tự (PR-S1)");
        }

        RentalContract contract = rentalContractRepository.findDetailById(request.getContractId())
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND",
                        "Không tìm thấy hợp đồng #" + request.getContractId()));

        if (contract.getCustomer() == null || !contract.getCustomer().getId().equals(customer.getId())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_CONTRACT",
                    "Hợp đồng này không thuộc quyền sở hữu của bạn (PR-51)");
        }

        if (!ELIGIBLE_CONTRACT_STATUSES.contains(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Chỉ hợp đồng đang hoạt động (ACTIVE), quá hạn (OVERDUE) hoặc chờ trả kho (TERMINATION_PENDING) mới được gửi yêu cầu hỗ trợ (PR-51)");
        }

        // PR-S2: Mỗi hợp đồng tối đa 1 ticket mở / loại, tối đa 3 ticket mở
        if (supportRequestRepository.existsByContract_IdAndIssueTypeAndStatusIn(
                contract.getId(), issueType, OPEN_TICKET_STATUSES)) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "DUPLICATE_ISSUE_TYPE",
                    "Hợp đồng " + contract.getContractCode() + " đang có 1 yêu cầu \"" + getIssueTypeLabel(issueType)
                            + "\" chưa đóng. Mỗi hợp đồng chỉ được mở 1 ticket cho mỗi loại sự cố (PR-S2).");
        }

        long openCount = supportRequestRepository.countByContract_IdAndStatusIn(contract.getId(), OPEN_TICKET_STATUSES);
        if (openCount >= MAX_OPEN_TICKETS_PER_CONTRACT) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "MAX_OPEN_TICKETS_REACHED",
                    "Hợp đồng " + contract.getContractCode() + " đã có " + openCount + "/" + MAX_OPEN_TICKETS_PER_CONTRACT
                            + " yêu cầu hỗ trợ đang mở. Vui lòng chờ xử lý hoặc đóng bớt ticket trước khi tạo mới (PR-S2).");
        }

        String ticketCode = generateUniqueTicketCode();
        SupportRequest ticket = SupportRequest.builder()
                .ticketCode(ticketCode)
                .contract(contract)
                .customer(customer)
                .issueType(issueType)
                .description(desc)
                .status("OPEN")
                .build();

        SupportRequest saved = supportRequestRepository.save(ticket);
        entityManager.flush();
        entityManager.refresh(saved);

        // PR-34: Sinh task SUPPORT tại cơ sở của hợp đồng, hạn theo BR-61
        StaffTask task = createSupportTaskForTicket(contract, saved, null);

        // PR-A9, PR-A10: Ghi nhật ký
        activityLogService.log(
                customer.getId(),
                "[SUPPORT_CREATE] Khách " + customer.getFullName() + " tạo ticket " + saved.getTicketCode()
                        + " (" + issueType + (isUrgentIssue(issueType) ? " - KHẨN" : "") + ") cho HĐ " + contract.getContractCode(),
                "support_requests",
                String.valueOf(saved.getId())
        );

        return toResponse(saved, task);
    }

    // ──────────────────────────────────────────────────────
    // UC-26 / PR-S3: Khách hủy ticket còn OPEN → CLOSED, task CANCELLED
    // ──────────────────────────────────────────────────────
    @Transactional
    public SupportRequestResponse cancelTicket(Integer ticketId, Integer customerId) {
        User customer = validateCustomer(customerId);
        SupportRequest ticket = getOwnedTicket(ticketId, customer.getId());

        if (!"OPEN".equals(ticket.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "TICKET_NOT_CANCELLABLE",
                    "Chỉ có thể hủy yêu cầu khi còn ở trạng thái Chờ tiếp nhận (OPEN). Hiện tại: " + ticket.getStatus());
        }

        LocalDateTime now = LocalDateTime.now();
        ticket.setStatus("CLOSED");
        ticket.setClosedAt(now);
        supportRequestRepository.save(ticket);

        // Hủy các task SUPPORT đang mở của ticket này
        List<StaffTask> openTasks = staffTaskRepository.findBySupportRequestIdAndStatusIn(ticket.getId(), OPEN_TASK_STATUSES);
        for (StaffTask t : openTasks) {
            t.setStatus("CANCELLED");
        }
        staffTaskRepository.saveAll(openTasks);

        activityLogService.log(
                customer.getId(),
                "[SUPPORT_CANCEL] Khách " + customer.getFullName() + " hủy ticket hỗ trợ " + ticket.getTicketCode(),
                "support_requests",
                String.valueOf(ticket.getId())
        );

        StaffTask latestTask = openTasks.isEmpty() ? null : openTasks.get(0);
        return toResponse(ticket, latestTask);
    }

    // ──────────────────────────────────────────────────────
    // UC-26 / PR-52: Khách xác nhận "Đã ổn" khi ticket RESOLVED → CLOSED
    // ──────────────────────────────────────────────────────
    @Transactional
    public SupportRequestResponse confirmResolvedTicket(Integer ticketId, Integer customerId) {
        User customer = validateCustomer(customerId);
        SupportRequest ticket = getOwnedTicket(ticketId, customer.getId());

        if (!"RESOLVED".equals(ticket.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "INVALID_TICKET_STATUS",
                    "Chỉ yêu cầu đã xử lý xong (RESOLVED) mới có thể xác nhận hoàn tất.");
        }

        ticket.setStatus("CLOSED");
        ticket.setClosedAt(LocalDateTime.now());
        supportRequestRepository.save(ticket);

        activityLogService.log(
                customer.getId(),
                "[SUPPORT_CLOSE] Khách " + customer.getFullName() + " xác nhận đã ổn và đóng ticket " + ticket.getTicketCode(),
                "support_requests",
                String.valueOf(ticket.getId())
        );

        List<StaffTask> tasks = staffTaskRepository.findBySupportRequestIdInWithStaff(List.of(ticket.getId()));
        StaffTask latestTask = tasks.isEmpty() ? null : tasks.get(0);
        return toResponse(ticket, latestTask);
    }

    // ──────────────────────────────────────────────────────
    // UC-26 / PR-52: Khách báo "Chưa xong" (bắt buộc lý do) → OPEN + sinh task SUPPORT mới
    // ──────────────────────────────────────────────────────
    @Transactional
    public SupportRequestResponse reopenTicket(Integer ticketId, Integer customerId, ReopenSupportRequestDto request) {
        User customer = validateCustomer(customerId);
        SupportRequest ticket = getOwnedTicket(ticketId, customer.getId());

        if (!"RESOLVED".equals(ticket.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "INVALID_TICKET_STATUS",
                    "Chỉ yêu cầu ở trạng thái Đã xử lý (RESOLVED) mới có thể yêu cầu xử lý lại.");
        }

        String reason = (request != null && request.getReason() != null) ? request.getReason().trim() : "";
        if (reason.isEmpty()) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Vui lòng nhập lý do chưa ổn để nhân viên tiếp tục hỗ trợ (PR-52).");
        }
        if (reason.length() > REOPEN_REASON_MAX_LENGTH) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Lý do phản hồi tối đa " + REOPEN_REASON_MAX_LENGTH + " ký tự.");
        }

        RentalContract contract = ticket.getContract();
        if (contract == null || !ELIGIBLE_CONTRACT_STATUSES.contains(contract.getStatus())) {
            throw new StaffTaskException(HttpStatus.CONFLICT, "CONTRACT_STATUS_INVALID",
                    "Hợp đồng đã kết thúc hoặc thanh lý nên không thể mở lại yêu cầu hỗ trợ.");
        }

        String timestamp = LocalDateTime.now().format(TS_FMT);
        String oldDesc = ticket.getDescription() != null ? ticket.getDescription() : "";
        String updatedDesc = oldDesc + "\n\n[Khách báo chưa xong - " + timestamp + "]: " + reason;

        ticket.setDescription(updatedDesc);
        ticket.setStatus("OPEN");
        ticket.setResolvedAt(null);
        ticket.setClosedAt(null);
        supportRequestRepository.save(ticket);

        // Hủy task cũ nếu còn sót mở, rồi sinh task SUPPORT mới
        List<StaffTask> openTasks = staffTaskRepository.findBySupportRequestIdAndStatusIn(ticket.getId(), OPEN_TASK_STATUSES);
        for (StaffTask t : openTasks) {
            t.setStatus("CANCELLED");
        }
        staffTaskRepository.saveAll(openTasks);

        StaffTask newTask = createSupportTaskForTicket(contract, ticket, reason);

        activityLogService.log(
                customer.getId(),
                "[SUPPORT_REOPEN] Khách " + customer.getFullName() + " báo chưa xong ticket " + ticket.getTicketCode() + ": " + reason,
                "support_requests",
                String.valueOf(ticket.getId())
        );

        return toResponse(ticket, newTask);
    }

    // ──────────────────────────────────────────────────────
    // PR-52: Job tự động đóng ticket RESOLVED sau 3 ngày khách không phản hồi
    // ──────────────────────────────────────────────────────
    @Transactional
    public int autoCloseResolvedTickets() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(3);
        List<SupportRequest> expiredResolved = supportRequestRepository.findByStatusAndResolvedAtBefore("RESOLVED", cutoff);
        if (expiredResolved.isEmpty()) {
            return 0;
        }

        Integer systemUserId = userRepository.findByEmail(ActivityLogService.SYSTEM_EMAIL)
                .map(User::getId)
                .orElse(null);

        LocalDateTime now = LocalDateTime.now();
        for (SupportRequest ticket : expiredResolved) {
            ticket.setStatus("CLOSED");
            ticket.setClosedAt(now);
            supportRequestRepository.save(ticket);

            Integer logActor = systemUserId != null
                    ? systemUserId
                    : (ticket.getCustomer() != null ? ticket.getCustomer().getId() : 1);
            activityLogService.log(
                    logActor,
                    "[SUPPORT_AUTO_CLOSE] Hệ thống tự đóng ticket " + ticket.getTicketCode() + " sau 3 ngày khách không phản hồi",
                    "support_requests",
                    String.valueOf(ticket.getId())
            );
        }
        return expiredResolved.size();
    }

    // ──────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────
    private StaffTask createSupportTaskForTicket(RentalContract contract, SupportRequest ticket, String reopenReason) {
        Integer facilityId = contract.getStorageUnit() != null && contract.getStorageUnit().getFacility() != null
                ? contract.getStorageUnit().getFacility().getId()
                : 1;

        boolean urgent = isUrgentIssue(ticket.getIssueType());
        String prefix = urgent ? "[KHẨN] " : "";
        StringBuilder noteBuilder = new StringBuilder();
        noteBuilder.append(prefix)
                .append("[").append(ticket.getTicketCode()).append("] ")
                .append(getIssueTypeLabel(ticket.getIssueType())).append(": ");

        if (reopenReason != null && !reopenReason.isBlank()) {
            noteBuilder.append("[Yêu cầu xử lý lại] ").append(reopenReason.trim());
        } else if (ticket.getDescription() != null) {
            noteBuilder.append(ticket.getDescription().trim());
        }

        String taskNote = noteBuilder.toString();
        if (taskNote.length() > 1000) {
            taskNote = taskNote.substring(0, 997) + "...";
        }

        StaffTask task = new StaffTask();
        task.setFacilityId(facilityId);
        task.setContract(contract);
        task.setSupportRequestId(ticket.getId());
        task.setTaskType("SUPPORT");
        task.setStatus("OPEN");
        task.setDueAt(staffTaskService.computeDueAt(LocalDate.now()));
        task.setNote(taskNote);
        return staffTaskRepository.save(task);
    }

    private User validateCustomer(Integer customerId) {
        if (customerId == null) {
            throw new StaffTaskException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Thiếu thông tin khách hàng (customerId)");
        }
        User user = userRepository.findById(customerId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy tài khoản khách hàng"));
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED", "Tài khoản đang bị khóa hoặc vô hiệu hóa");
        }
        return user;
    }

    private SupportRequest getOwnedTicket(Integer ticketId, Integer customerId) {
        SupportRequest ticket = supportRequestRepository.findDetailById(ticketId)
                .orElseThrow(() -> new StaffTaskException(HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND",
                        "Không tìm thấy yêu cầu hỗ trợ #" + ticketId));
        if (ticket.getCustomer() == null || !ticket.getCustomer().getId().equals(customerId)) {
            throw new StaffTaskException(HttpStatus.FORBIDDEN, "FORBIDDEN_TICKET",
                    "Yêu cầu hỗ trợ này không thuộc tài khoản của bạn");
        }
        return ticket;
    }

    private String generateUniqueTicketCode() {
        for (int i = 0; i < 30; i++) {
            int num = 100000 + RANDOM.nextInt(900000);
            String code = "SR-" + num;
            if (!supportRequestRepository.existsByTicketCode(code)) {
                return code;
            }
        }
        return "SR-" + (System.currentTimeMillis() % 1000000);
    }

    public SupportRequestResponse toResponse(SupportRequest sr, StaffTask latestTask) {
        RentalContract contract = sr.getContract();
        StorageUnit su = contract != null ? contract.getStorageUnit() : null;
        User customer = sr.getCustomer();
        User staff = latestTask != null ? latestTask.getStaff() : null;

        return SupportRequestResponse.builder()
                .id(sr.getId())
                .ticketCode(sr.getTicketCode())
                .issueType(sr.getIssueType())
                .urgent(isUrgentIssue(sr.getIssueType()))
                .description(sr.getDescription())
                .status(sr.getStatus())
                .resolutionNote(sr.getResolutionNote())
                .createdAt(sr.getCreatedAt())
                .resolvedAt(sr.getResolvedAt())
                .closedAt(sr.getClosedAt())
                .contractId(contract != null ? contract.getId() : null)
                .contractCode(contract != null ? contract.getContractCode() : null)
                .contractStatus(contract != null ? contract.getStatus() : null)
                .contractStartDate(contract != null ? contract.getStartDate() : null)
                .contractEndDate(contract != null ? contract.getEndDate() : null)
                .storageUnitId(su != null ? su.getId() : null)
                .unitTypeName(su != null && su.getUnitType() != null ? su.getUnitType().getName() : null)
                .facilityId(su != null && su.getFacility() != null ? su.getFacility().getId() : null)
                .facilityName(su != null && su.getFacility() != null ? su.getFacility().getName() : null)
                .customerId(customer != null ? customer.getId() : null)
                .customerName(customer != null ? customer.getFullName() : null)
                .customerPhone(customer != null ? customer.getPhone() : null)
                .latestTaskId(latestTask != null ? latestTask.getId() : null)
                .latestTaskStatus(latestTask != null ? latestTask.getStatus() : null)
                .latestTaskDueAt(latestTask != null ? latestTask.getDueAt() : null)
                .assignedStaffId(staff != null ? staff.getId() : null)
                .assignedStaffName(staff != null ? staff.getFullName() : null)
                .build();
    }
}
