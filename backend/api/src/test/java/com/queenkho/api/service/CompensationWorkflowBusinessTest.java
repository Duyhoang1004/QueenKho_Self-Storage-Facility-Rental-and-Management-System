package com.queenkho.api.service;

import com.queenkho.api.dto.*;
import com.queenkho.api.entity.*;
import com.queenkho.api.exception.StaffTaskException;
import com.queenkho.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.queenkho.api.service.BusinessFixtures.*;

class CompensationWorkflowBusinessTest {
    final CompensationClaimRepository claims = mock(CompensationClaimRepository.class);
    final SupportRequestRepository tickets = mock(SupportRequestRepository.class);
    final RentalContractRepository contracts = mock(RentalContractRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final CompensationClaimService service = new CompensationClaimService();
    CompensationClaim claim;
    RentalContract contract;

    @BeforeEach void setup() {
        contract = contract("ACTIVE");
        claim = new CompensationClaim();
        claim.setId(40);
        claim.setClaimCode("BT-TEST");
        claim.setContract(contract);
        claim.setCustomer(contract.getCustomer());
        claim.setFacilityId(1);
        claim.setClaimType("GOODS_DAMAGE");
        claim.setStatus("INSPECTED");
        claim.setClaimedAmount(money("3000000"));
        SupportRequest ticket = new SupportRequest();
        ticket.setId(50);
        ticket.setContract(contract);
        ticket.setCustomer(contract.getCustomer());
        ticket.setStatus("IN_PROGRESS");
        claim.setSupportRequest(ticket);
        when(claims.findDetailById(40)).thenReturn(Optional.of(claim));
        when(claims.findByTicketId(50)).thenReturn(Optional.of(claim));
        when(users.findById(6)).thenReturn(Optional.of(user(6, "FACILITY_MANAGER", 1)));
        ReflectionTestUtils.setField(service, "claimRepository", claims);
        ReflectionTestUtils.setField(service, "supportRequestRepository", tickets);
        ReflectionTestUtils.setField(service, "rentalContractRepository", contracts);
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "activityLogService", mock(ActivityLogService.class));
        ReflectionTestUtils.setField(service, "insuranceProvider", mock(InsuranceProviderClient.class));
        ReflectionTestUtils.setField(service, "jdbcTemplate", jdbc);
    }

    CreateSupportRequestDto input() {
        CreateSupportRequestDto r = new CreateSupportRequestDto();
        r.setItemsDescription("Two damaged boxes, invoices attached");
        r.setClaimedAmount(money("3000000"));
        r.setIncidentDate(LocalDate.now());
        r.setEvidenceImages(List.of("https://example.invalid/evidence.jpg"));
        return r;
    }

    ClaimDecisionRequest decision(String liable, String resolution) {
        ClaimDecisionRequest r = new ClaimDecisionRequest();
        r.setLiableParty(liable);
        r.setAssessedValue(money("2000000"));
        r.setDamagePercent(50);
        r.setUnusableDays(3);
        r.setResolution(resolution);
        r.setNote("Inspection and customer evidence confirm this assessment");
        return r;
    }

    @ParameterizedTest @ValueSource(strings = {"0", "-1", "10000000001"})
    void claimMustHavePositiveBoundedAmount(String amount) {
        var r = input(); r.setClaimedAmount(money(amount));
        assertThrows(StaffTaskException.class, () -> service.validateClaimInput("GOODS_DAMAGE", r, contract));
    }

    @Test void futureIncidentCannotBeSubmitted() {
        var r = input(); r.setIncidentDate(LocalDate.now().plusDays(1));
        assertThrows(StaffTaskException.class, () -> service.validateClaimInput("GOODS_DAMAGE", r, contract));
    }

    @Test void incidentBeforeRentalCannotBeSubmitted() {
        var r = input(); r.setIncidentDate(contract.getStartDate().minusDays(1));
        assertThrows(StaffTaskException.class, () -> service.validateClaimInput("GOODS_DAMAGE", r, contract));
    }

    @Test void damageNeedsPhotoButLossMayLackPhoto() {
        var r = input(); r.setEvidenceImages(List.of());
        assertEquals("EVIDENCE_IMAGE_REQUIRED", assertThrows(StaffTaskException.class,
                () -> service.validateClaimInput("GOODS_DAMAGE", r, contract)).getCode());
        assertDoesNotThrow(() -> service.validateClaimInput("GOODS_LOSS", r, contract));
    }

    @Test void submittedClaimRequiresInspectionBeforeDecision() {
        claim.setStatus("SUBMITTED");
        assertEquals("CLAIM_STATUS_INVALID", assertThrows(StaffTaskException.class,
                () -> service.decide(40, 6, decision("FACILITY", "CONTINUE"))).getCode());
        verify(claims, never()).save(any());
    }

    @ParameterizedTest @ValueSource(strings = {"APPROVED", "PAID", "WITHDRAWN", "REJECTED"})
    void decisionCannotBeRepeatedForSettledOrWithdrawnClaim(String status) {
        claim.setStatus(status);
        assertThrows(StaffTaskException.class, () -> service.decide(40, 6, decision("FACILITY", "CONTINUE")));
        verifyNoInteractions(jdbc);
    }

    @Test void customerFaultRejectsClaimWithoutGrantingFreeTermination() {
        service.decide(40, 6, decision("CUSTOMER", "TERMINATE"));
        assertEquals("REJECTED", claim.getStatus());
        assertEquals("CONTINUE", claim.getResolution());
        assertEquals("RESOLVED", claim.getSupportRequest().getStatus());
        assertFalse(contract.getFaultTermination());
        assertEquals(0, claim.getTotalCompensation().signum());
    }

    @Test void facilityFaultApprovesButDoesNotMarkPaymentAsCompleted() {
        service.decide(40, 6, decision("FACILITY", "TERMINATE"));
        assertEquals("APPROVED", claim.getStatus());
        assertTrue(contract.getFaultTermination());
        assertEquals("IN_PROGRESS", claim.getSupportRequest().getStatus());
        assertNull(claim.getPaidAt());
        verifyNoInteractions(jdbc);
    }

    @ParameterizedTest @ValueSource(ints = {0, -1, 101})
    void damagePercentageMustBeBetweenOneAndHundred(int percent) {
        var r = decision("FACILITY", "CONTINUE"); r.setDamagePercent(percent);
        assertThrows(StaffTaskException.class, () -> service.decide(40, 6, r));
    }

    @Test void managerCannotAssessMoreThanCustomerClaims() {
        var r = decision("FACILITY", "CONTINUE"); r.setAssessedValue(money("3000001"));
        assertThrows(StaffTaskException.class, () -> service.decide(40, 6, r));
    }

    @Test void managerOfAnotherFacilityCannotDecideClaim() {
        when(users.findById(6)).thenReturn(Optional.of(user(6, "FACILITY_MANAGER", 2)));
        assertEquals("FORBIDDEN_FACILITY", assertThrows(StaffTaskException.class,
                () -> service.decide(40, 6, decision("FACILITY", "CONTINUE"))).getCode());
    }

    @Test void bomCanReadButCannotApproveOrPay() {
        when(users.findById(6)).thenReturn(Optional.of(user(6, "BOM", null)));
        assertDoesNotThrow(() -> service.detail(40, 6));
        assertThrows(StaffTaskException.class, () -> service.decide(40, 6, decision("FACILITY", "CONTINUE")));
        assertThrows(StaffTaskException.class, () -> service.pay(40, 6, new ClaimPaymentRequest()));
    }

    @ParameterizedTest @ValueSource(strings = {"SUBMITTED", "INSPECTED", "REJECTED", "PAID", "WITHDRAWN"})
    void onlyApprovedClaimsCanBePaid(String status) {
        claim.setStatus(status);
        assertEquals("CLAIM_STATUS_INVALID", assertThrows(StaffTaskException.class,
                () -> service.pay(40, 6, new ClaimPaymentRequest())).getCode());
        verifyNoInteractions(jdbc);
    }

    @Test void transferPayoutRequiresEvidenceBeforeWritingMoney() {
        claim.setStatus("APPROVED");
        ClaimPaymentRequest r = new ClaimPaymentRequest(); r.setPaymentMethod("BANK_TRANSFER");
        assertEquals("PAYMENT_EVIDENCE_REQUIRED", assertThrows(StaffTaskException.class,
                () -> service.pay(40, 6, r)).getCode());
        verifyNoInteractions(jdbc);
    }

    @ParameterizedTest @ValueSource(strings = {"APPROVED", "PAID"})
    void settledClaimsCannotBeReopenedThroughSupport(String status) {
        claim.setStatus(status);
        assertEquals("CLAIM_ALREADY_SETTLED", assertThrows(StaffTaskException.class,
                () -> service.reopenForTicket(50)).getCode());
    }

    @Test void rejectedClaimCanReturnToInspectionQueue() {
        claim.setStatus("REJECTED");
        service.reopenForTicket(50);
        assertEquals("SUBMITTED", claim.getStatus());
        assertNull(claim.getDecidedAt());
    }

    @Test void inspectionRequiresPhotoAndMeaningfulNotes() {
        claim.setStatus("SUBMITTED");
        assertThrows(StaffTaskException.class, () -> service.recordInspection(50,
                user(7, "STAFF", 1), "Detailed inspection", List.of(), "FACILITY"));
        assertThrows(StaffTaskException.class, () -> service.recordInspection(50,
                user(7, "STAFF", 1), "short", List.of("image.jpg"), "FACILITY"));
        assertEquals("INSPECTED", service.recordInspection(50, user(7, "STAFF", 1),
                "Detailed inspection report", List.of("image.jpg"), "FACILITY").getStatus());
    }
}
