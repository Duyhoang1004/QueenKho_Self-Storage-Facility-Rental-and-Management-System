package com.queenkho.api.controller;

import com.queenkho.api.dto.RentalPolicyRequest;
import com.queenkho.api.dto.RentalPolicyResponse;
import com.queenkho.api.service.RentalPolicyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rental-policies")
public class RentalPolicyController {
    private final RentalPolicyService service;

    public RentalPolicyController(RentalPolicyService service) {
        this.service = service;
    }

    @GetMapping
    public List<RentalPolicyResponse> listCurrent(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return service.listCurrent(authorization);
    }

    @GetMapping("/facilities/{facilityId}")
    public RentalPolicyResponse current(@PathVariable Integer facilityId,
                                         @RequestHeader(value = "Authorization", required = false) String authorization) {
        return service.current(facilityId, authorization);
    }

    @GetMapping("/facilities/{facilityId}/history")
    public List<RentalPolicyResponse> history(@PathVariable Integer facilityId,
                                               @RequestHeader(value = "Authorization", required = false) String authorization) {
        return service.history(facilityId, authorization);
    }

    @PostMapping("/facilities/{facilityId}")
    public ResponseEntity<RentalPolicyResponse> create(@PathVariable Integer facilityId,
            @Valid @RequestBody RentalPolicyRequest request, @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createVersion(facilityId, request, authorization));
    }

    @PostMapping("/facilities/{facilityId}/activate/{policyId}")
    public ResponseEntity<RentalPolicyResponse> activate(@PathVariable Integer facilityId,
            @PathVariable Integer policyId, @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(service.activate(facilityId, policyId, authorization));
    }
}
