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
    private static final int LIQUIDATION_DAYS = 15; // PR-Q8 (27/10/2026): bản cũ 30 ngày
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
            p.getCreatedAt(), p.getCreatedBy() == null ? "Hệ thống" : p.getCreatedBy().getFullName(),
            p.getBookingDiscount3m(), p.getBookingDiscount6m(), p.getBookingDiscount12m(),
            p.getRenewalDiscount3m(), p.getRenewalDiscount6m(), p.getRenewalDiscount12m(),
            p.isAllowLateFeeWaiver(), p.getOverstayPercent(), p.getHeldGoodsFeePercent());
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
        RentalPolicy current = policies.findByFacility_IdAndActiveTrue(facilityId).orElse(null);
        if (current != null) {
            current.setActive(false);
            policies.saveAndFlush(current);
        }
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
        // Flow 4: ưu đãi theo gói + quyền miễn phí trễ — không gửi thì kế thừa bản đang hiệu lực
        policy.setBookingDiscount3m(pick(request.bookingDiscount3m(), current == null ? null : current.getBookingDiscount3m(), 5));
        policy.setBookingDiscount6m(pick(request.bookingDiscount6m(), current == null ? null : current.getBookingDiscount6m(), 10));
        policy.setBookingDiscount12m(pick(request.bookingDiscount12m(), current == null ? null : current.getBookingDiscount12m(), 15));
        policy.setRenewalDiscount3m(pick(request.renewalDiscount3m(), current == null ? null : current.getRenewalDiscount3m(), 0));
        policy.setRenewalDiscount6m(pick(request.renewalDiscount6m(), current == null ? null : current.getRenewalDiscount6m(), 5));
        policy.setRenewalDiscount12m(pick(request.renewalDiscount12m(), current == null ? null : current.getRenewalDiscount12m(), 10));
        policy.setAllowLateFeeWaiver(request.allowLateFeeWaiver() != null ? request.allowLateFeeWaiver()
            : current == null || current.isAllowLateFeeWaiver());
        // PR-Q14 / PR-Q15: % phí chiếm dụng và phí lưu giữ hàng — không gửi thì kế thừa bản đang hiệu lực
        policy.setOverstayPercent(pick(request.overstayPercent(), current == null ? null : current.getOverstayPercent(),
            LateFeeService.DEFAULT_OVERSTAY_PERCENT));
        policy.setHeldGoodsFeePercent(pick(request.heldGoodsFeePercent(), current == null ? null : current.getHeldGoodsFeePercent(),
            LateFeeService.DEFAULT_HELD_GOODS_FEE_PERCENT));
        policy.setCreatedBy(user);
        policies.saveAndFlush(policy);
        entityManager.refresh(policy);
        logs.log(user.getId(), "[RENTAL_POLICY_CREATE] Cơ sở " + facilityId + ", phiên bản " + nextVersion,
            "rental_policy", String.valueOf(policy.getId()));
        return response(policy);
    }

    private static Integer pick(Integer requested, Integer inherited, int fallback) {
        if (requested != null) {
            return requested;
        }
        return inherited != null ? inherited : fallback;
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
