package com.queenkho.api.repository;

import com.queenkho.api.entity.FacilityFloor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

// UC-06: mặt bằng tầng
public interface FacilityFloorRepository extends JpaRepository<FacilityFloor, Integer> {

    List<FacilityFloor> findByFacility_IdOrderBySortOrderAscIdAsc(Integer facilityId);

    Optional<FacilityFloor> findByFacility_IdAndNameIgnoreCase(Integer facilityId, String name);
}
