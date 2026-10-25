package com.queenkho.api.service;

import com.queenkho.api.dto.RentalPolicyRequest;
import com.queenkho.api.dto.RentalPolicyResponse;
import com.queenkho.api.entity.Facility;
import com.queenkho.api.entity.RentalPolicy;
import com.queenkho.api.entity.User;
import com.queenkho.api.repository.FacilityRepository;
import com.queenkho.api.repository.RentalPolicyRepository;
import com.queenkho.api.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class RentalPolicyService {
    private static final int LATE_FEE_CAP_PERCENT = 50;
    private static final int LIQUIDATION_DAYS = 30;
    private final RentalPolicyRepository policies;
    private final FacilityRepository facilities;
    private final UserRepository users;
    private final SessionTokenService sessions;
    private final ActivityLogService logs;
    private final EntityManager entityManager;

    public RentalPolicyService(RentalPolicyRepository policies, FacilityRepository facilities,
                               UserRepository users, SessionTokenService sessions,
                               ActivityLogService logs, EntityManager entityManager) {
        this.policies = policies;
        this.facilities = facilities;
        this.users = users;
        this.sessions = sessions;
        this.logs = logs;
        this.entityManager = entityManager;
    }

    private User actor(String authorization, boolean write, Integer facilityId) {
        Integer userId = sessions.requireUser(authorization);
        User user = users.findById(userId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại"));
        String role = user.getRole().getName();
        boolean allowed = "BOM".equals(role) || (!write && "FACILITY_MANAGER".equals(role)
            && facilityId != null && facilityId.equals(user.getFacilityId()));
        if (!"ACTIVE".equals(user.getStatus()) || !allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập chính sách này");
        }
        return user;
    }

    private void requireFacility(Integer facilityId) {
        if (!facilities.existsById(facilityId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cơ sở");
        }
    }

    private RentalPolicyResponse response(RentalPolicy p) {
        return new RentalPolicyResponse(p.getId(), p.getFacility().getId(), p.getVersion(), p.isActive(),
            p.getDepositMonthMultiplier(), p.getCancelFeePercent(), p.getCancelFreeHours(),
            p.getLateFeePercentPerDay(), p.getLateFeeMaxPercent(), p.getLiquidationDays(),
            p.getCreatedAt(), p.getCreatedBy() == null ? "Hệ thống" : p.getCreatedBy().getFullName());
    }

    @Transactional(readOnly = true)
    public List<RentalPolicyResponse> listCurrent(String authorization) {
        actor(authorization, false, null);
        return policies.findByActiveTrueOrderByFacility_IdAsc().stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public RentalPolicyResponse current(Integer facilityId, String authorization) {
        actor(authorization, false, facilityId);
        requireFacility(facilityId);
        return policies.findByFacility_IdAndActiveTrue(facilityId)
            .map(this::response).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cơ sở chưa có chính sách"));
    }

    @Transactional(readOnly = true)
    public List<RentalPolicyResponse> history(Integer facilityId, String authorization) {
        actor(authorization, false, facilityId);
        requireFacility(facilityId);
        return policies.findByFacility_IdOrderByVersionDesc(facilityId).stream().map(this::response).toList();
    }

    @Transactional
    public RentalPolicyResponse createVersion(Integer facilityId, RentalPolicyRequest request, String authorization) {
        User user = actor(authorization, true, facilityId);
        if (request.lateFeePercentPerDay() > LATE_FEE_CAP_PERCENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phí trễ mỗi ngày không được vượt mức trần 50% tiền cọc");
        }
        Facility facility = facilities.findByIdForPolicyUpdate(facilityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cơ sở"));
        int nextVersion = policies.findFirstByFacility_IdOrderByVersionDesc(facilityId)
            .map(p -> p.getVersion() + 1).orElse(1);
        policies.findByFacility_IdAndActiveTrue(facilityId).ifPresent(current -> {
            current.setActive(false);
            policies.saveAndFlush(current);
        });
        RentalPolicy policy = new RentalPolicy();
        policy.setFacility(facility);
        String policyName = "Chính sách " + facility.getName();
        policy.setPolicyName(policyName.substring(0, Math.min(150, policyName.length())));
        policy.setVersion(nextVersion);
        policy.setActive(true);
        policy.setDepositMonthMultiplier(request.depositMonthMultiplier());
        policy.setCancelFeePercent(request.cancelFeePercent());
        policy.setCancelFreeHours(request.cancelFreeHours());
        policy.setLateFeePercentPerDay(request.lateFeePercentPerDay());
        policy.setLateFeeMaxPercent(LATE_FEE_CAP_PERCENT);
        policy.setLiquidationDays(LIQUIDATION_DAYS);
        policy.setCreatedBy(user);
        policies.saveAndFlush(policy);
        entityManager.refresh(policy);
        logs.log(user.getId(), "[RENTAL_POLICY_CREATE] Cơ sở " + facilityId + ", phiên bản " + nextVersion,
            "rental_policy", String.valueOf(policy.getId()));
        return response(policy);
    }

    @Transactional
    public RentalPolicyResponse activate(Integer facilityId, Integer policyId, String authorization) {
        User user = actor(authorization, true, facilityId);
        facilities.findByIdForPolicyUpdate(facilityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cơ sở"));
        RentalPolicy old = policies.findByIdAndFacility_Id(policyId, facilityId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phiên bản chính sách"));
        if (old.isActive()) return response(old);
        policies.findByFacility_IdAndActiveTrue(facilityId).ifPresent(current -> {
            current.setActive(false);
            policies.saveAndFlush(current);
        });
        old.setActive(true);
        policies.saveAndFlush(old);
        logs.log(user.getId(), "[RENTAL_POLICY_ACTIVATE] Áp dụng lại phiên bản " + old.getVersion(),
            "rental_policy", String.valueOf(old.getId()));
        return response(old);
    }
}
