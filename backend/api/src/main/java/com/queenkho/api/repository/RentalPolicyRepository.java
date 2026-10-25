package com.queenkho.api.repository;

import com.queenkho.api.entity.RentalPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RentalPolicyRepository extends JpaRepository<RentalPolicy, Integer> {
    List<RentalPolicy> findByActiveTrueOrderByFacility_IdAsc();
    List<RentalPolicy> findByFacility_IdOrderByVersionDesc(Integer facilityId);
    Optional<RentalPolicy> findFirstByFacility_IdOrderByVersionDesc(Integer facilityId);
    Optional<RentalPolicy> findByFacility_IdAndActiveTrue(Integer facilityId);
    Optional<RentalPolicy> findByIdAndFacility_Id(Integer id, Integer facilityId);
}
