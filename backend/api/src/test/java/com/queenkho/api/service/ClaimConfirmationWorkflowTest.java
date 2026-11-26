package com.queenkho.api.service;

import com.queenkho.api.dto.ClaimPaymentRequest;
import com.queenkho.api.dto.CompensationClaimResponse;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.queenkho.api.service.BusinessFixtures.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClaimConfirmationWorkflowTest {

    final CompensationClaimRepository claims = mock(CompensationClaimRepository.class);
    final SupportRequestRepository tickets = mock(SupportRequestRepository.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final ActivityLogService activityLogService = mock(ActivityLogService.class);
    final ClaimConfirmationService confirmations = mock(ClaimConfirmationService.class);
    final SupportRequestService supportRequestService = mock(SupportRequestService.class);
    final CompensationClaimService service = new CompensationClaimService();

    CompensationClaim claim;
    RentalContract contract;
    SupportRequest ticket;
    Integer customerId;

    @BeforeEach
    void setup() {
        contract = contract("ACTIVE");
        customerId = contract.getCustomer().getId();
        ticket = new SupportRequest();
        ticket.setId(50);
        ticket.setTicketCode("SR-50");
        ticket.setContract(contract);
        ticket.setCustomer(contract.getCustomer());
        ticket.setStatus("IN_PROGRESS");

        claim = new CompensationClaim();
        claim.setId(40);
        claim.setClaimCode("BT-TEST40");
        claim.setContract(contract);
        claim.setCustomer(contract.getCustomer());
        claim.setFacilityId(1);
        claim.setClaimType("GOODS_DAMAGE");
        claim.setStatus("INSPECTED");
        claim.setClaimedAmount(money("3000000"));
        claim.setTotalCompensation(money("1500000"));
        claim.setSupportRequest(ticket);

        when(claims.findDetailById(40)).thenReturn(Optional.of(claim));
        when(claims.findByTicketId(50)).thenReturn(Optional.of(claim));
        when(users.findById(6)).thenReturn(Optional.of(user(6, "FACILITY_MANAGER", 1)));
        when(confirmations.getState(40)).thenReturn(ClaimConfirmationService.State.empty());

        ReflectionTestUtils.setField(service, "claimRepository", claims);
        ReflectionTestUtils.setField(service, "supportRequestRepository", tickets);
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "activityLogService", activityLogService);
        ReflectionTestUtils.setField(service, "insuranceProvider", mock(InsuranceProviderClient.class));
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
        ReflectionTestUtils.setField(service, "claimConfirmationService", confirmations);
        ReflectionTestUtils.setField(service, "supportRequestService", supportRequestService);
    }

    @Test
    void idea3CustomerCanConfirmOrDisputeInspectionWithinRoundLimit() {
        when(confirmations.getState(40)).thenReturn(new ClaimConfirmationService.State(
                ClaimConfirmationService.STATUS_PENDING_CUSTOMER, null, null, 1,
                null, null, null, 0, null, null, false, null, null, 0));

        service.confirmInspection(40, customerId);
        verify(activityLogService).log(eq(customerId), startsWith("[CLAIM_INSPECT_CONFIRMED]"), eq("compensation_claims"), eq("40"));

        service.disputeInspection(40, customerId, "Staff ghi thieu 3 thung hang bi uot");
        assertEquals("SUBMITTED", claim.getStatus());
        verify(activityLogService).log(eq(customerId), contains("Staff ghi thieu 3 thung hang bi uot"), eq("compensation_claims"), eq("40"));
        verify(supportRequestService).reopenInspectionTaskForClaim(ticket, "Staff ghi thieu 3 thung hang bi uot");

        claim.setStatus("INSPECTED");
        when(confirmations.getState(40)).thenReturn(new ClaimConfirmationService.State(
                ClaimConfirmationService.STATUS_PENDING_CUSTOMER, null, null, 2,
                null, null, null, 0, null, null, false, null, null, 0));
        assertEquals("MAX_ROUND_REACHED", assertThrows(StaffTaskException.class,
                () -> service.disputeInspection(40, customerId, "Van chua dong y bien ban")).getCode());
    }

    @Test
    void idea2CustomerCanAgreeOrRequestReappraisalOfDecision() {
        claim.setStatus("APPROVED");
        contract.setFaultTermination(true);
        when(confirmations.getState(40)).thenReturn(new ClaimConfirmationService.State(
                ClaimConfirmationService.STATUS_CONFIRMED, null, null, 1,
                ClaimConfirmationService.STATUS_PENDING_CUSTOMER, null, null, 1,
                null, null, false, null, null, 0));

        service.confirmDecision(40, customerId);
        verify(activityLogService).log(eq(customerId), startsWith("[CLAIM_DECISION_CONFIRMED]"), eq("compensation_claims"), eq("40"));

        service.disputeDecision(40, customerId, "Muc tham dinh thap hon hoa don goc da nop");
        assertEquals("INSPECTED", claim.getStatus());
        assertFalse(contract.getFaultTermination());
        verify(activityLogService).log(eq(customerId), contains("Muc tham dinh thap hon hoa don goc da nop"), eq("compensation_claims"), eq("40"));

        claim.setStatus("APPROVED");
        when(confirmations.getState(40)).thenReturn(new ClaimConfirmationService.State(
                ClaimConfirmationService.STATUS_CONFIRMED, null, null, 1,
                ClaimConfirmationService.STATUS_PENDING_CUSTOMER, null, null, 2,
                null, null, false, null, null, 0));
        assertEquals("MAX_ROUND_REACHED", assertThrows(StaffTaskException.class,
                () -> service.disputeDecision(40, customerId, "Khong dong y tiep lan 2")).getCode());
    }

    @Test
    void idea1CustomerCanConfirmOrDisputeReceiptAndFmCanResolveWithoutDoublePayment() {
        claim.setStatus("PAID");
        ticket.setStatus("RESOLVED");
        when(confirmations.getState(40)).thenReturn(new ClaimConfirmationService.State(
                ClaimConfirmationService.STATUS_CONFIRMED, null, null, 1,
                ClaimConfirmationService.STATUS_CONFIRMED, null, null, 1,
                ClaimConfirmationService.RECEIPT_WAITING, null, false, null, null, 1));

        service.confirmReceipt(40, customerId);
        assertEquals("CLOSED", ticket.getStatus());
        verify(activityLogService).log(eq(customerId), startsWith("[CLAIM_RECEIPT_CONFIRMED]"), eq("compensation_claims"), eq("40"));

        ticket.setStatus("RESOLVED");
        service.disputeReceipt(40, customerId, "Chua thay tien chuyen vao tai khoan VCB");
        assertEquals("IN_PROGRESS", ticket.getStatus());
        verify(activityLogService).log(eq(customerId), contains("Chua thay tien chuyen vao tai khoan VCB"), eq("compensation_claims"), eq("40"));

        when(confirmations.getState(40)).thenReturn(new ClaimConfirmationService.State(
                ClaimConfirmationService.STATUS_CONFIRMED, null, null, 1,
                ClaimConfirmationService.STATUS_CONFIRMED, null, null, 1,
                ClaimConfirmationService.RECEIPT_DISPUTED, null, false, "Chua thay tien", LocalDateTime.now(), 1));
        claim.setPayoutAccountNumber("0123456789");
        ClaimPaymentRequest req = new ClaimPaymentRequest();
        req.setPaymentMethod("BANK_TRANSFER");
        req.setEvidenceImageUrl("https://example.invalid/new-unc.jpg");
        req.setBankTransactionCode("FT999999");
        req.setResolutionNote("Da gui lai lenh chuyen khoan");

        CompensationClaimResponse res = service.pay(40, 6, req);
        assertEquals("RESOLVED", ticket.getStatus());
        assertEquals("FT999999", res.getBankTransactionCode());
        verify(jdbc, never()).update(contains("'COMPENSATION'"), any(Object[].class));
        verify(activityLogService).log(eq(6), startsWith("[CLAIM_DISPUTE_RESOLVED]"), eq("compensation_claims"), eq("40"));
    }

    @Test
    void deriveFromLogsReconstructsFull3StageState() {
        Timestamp t1 = Timestamp.valueOf(LocalDateTime.now().minusHours(5));
        Timestamp t2 = Timestamp.valueOf(LocalDateTime.now().minusHours(4));
        Timestamp t3 = Timestamp.valueOf(LocalDateTime.now().minusHours(3));
        Timestamp t4 = Timestamp.valueOf(LocalDateTime.now().minusHours(2));
        Timestamp t5 = Timestamp.valueOf(LocalDateTime.now().minusHours(1));
        Timestamp t6 = Timestamp.valueOf(LocalDateTime.now());

        List<Map<String, Object>> rows = List.of(
                Map.of("action", "[CLAIM_INSPECT] Staff kiem tra [GIA_STAFF_UOC_TINH:80000000]: uot", "created_at", t1),
                Map.of("action", "[CLAIM_INSPECT_DISPUTED] Khach bao sai: thieu hang", "created_at", t2),
                Map.of("action", "[CLAIM_INSPECT] Staff kiem tra lai [GIA_STAFF_UOC_TINH:120000000]: bo sung", "created_at", t3),
                Map.of("action", "[CLAIM_INSPECT_CONFIRMED] Khach xac nhan", "created_at", t4),
                Map.of("action", "[CLAIM_DECIDE] FM chot: FACILITY, CONTINUE", "created_at", t5),
                Map.of("action", "[CLAIM_PAY] FM chi tra (BANK_TRANSFER)", "created_at", t6)
        );
        ClaimConfirmationService.State s = ClaimConfirmationService.deriveFromLogs(rows);
        assertEquals(ClaimConfirmationService.STATUS_CONFIRMED, s.inspectionConfirmStatus());
        assertEquals(2, s.inspectionRound());
        assertEquals(0, new java.math.BigDecimal("120000000").compareTo(s.staffAssessedValue()));
        assertEquals(ClaimConfirmationService.STATUS_BYPASSED, s.decisionConfirmStatus());
        assertEquals(1, s.decisionRound());
        assertEquals(ClaimConfirmationService.RECEIPT_WAITING, s.receiptStatus());
        assertEquals(1, s.receiptRound());
    }
}
