package com.queenkho.api.controller;

import com.queenkho.api.dto.CustomerContractResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {

    @Autowired
    private RentalContractRepository rentalContractRepository;

    private CustomerContractResponse toDto(RentalContract rc) {
        var su = rc.getStorageUnit();
        var ut = su.getUnitType();
        return new CustomerContractResponse(
                rc.getId(),
                rc.getContractCode(),
                rc.getCustomer().getId(),
                rc.getCustomer().getFullName(),
                rc.getCustomer().getPhone(),
                su.getId(),
                ut.getName(),
                ut.getAreaSqm(),
                su.getFloor(),
                su.getZone(),
                su.getRoomNumber(),
                rc.getStatus(),
                rc.getStartDate(),
                rc.getEndDate(),
                rc.getBillingCycleMonths(),
                rc.getDepositHeldAmount(),
                rc.getReservation().getReservationCode(),
                rc.getAccessPinCode(),
                rc.getRfidCardCode()
        );
    }

    // GET /api/v1/contracts?managerId=3
    // GET /api/v1/contracts?facilityId=1
    // GET /api/v1/contracts?customerId=5  (customer xem HĐ của mình)
    // GET /api/v1/contracts?reservationId=1  (lấy HĐ theo đơn đặt chỗ)
    @GetMapping
    public ResponseEntity<?> getContracts(
            @RequestParam(required = false) Integer facilityId,
            @RequestParam(required = false) Integer managerId,
            @RequestParam(required = false) Integer customerId,
            @RequestParam(required = false) Integer reservationId) {
        try {
            if (reservationId != null) {
                return rentalContractRepository.findByReservationId(reservationId)
                        .map(rc -> ResponseEntity.ok((Object) toDto(rc)))
                        .orElse(ResponseEntity.notFound().build());
            }
            List<RentalContract> contracts;
            if (facilityId != null) {
                contracts = rentalContractRepository.findAllByFacilityId(facilityId);
            } else if (managerId != null) {
                contracts = rentalContractRepository.findAllByManagerId(managerId);
            } else if (customerId != null) {
                contracts = rentalContractRepository.findAllByCustomerId(customerId);
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Cần truyền facilityId, managerId, customerId hoặc reservationId"));
            }
            return ResponseEntity.ok(contracts.stream().map(this::toDto).toList());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/v1/contracts/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getContractDetail(@PathVariable Integer id) {
        return rentalContractRepository.findDetailById(id)
                .map(rc -> ResponseEntity.ok((Object) toDto(rc)))
                .orElse(ResponseEntity.notFound().build());
    }
}
