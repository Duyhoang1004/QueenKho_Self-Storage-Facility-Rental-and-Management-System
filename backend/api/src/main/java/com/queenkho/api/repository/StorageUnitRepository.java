package com.queenkho.api.repository;

import com.queenkho.api.entity.StorageUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StorageUnitRepository extends JpaRepository<StorageUnit, String> {

       List<StorageUnit> findByFacility_IdAndUnitType_IdAndStatus(Integer facilityId, Integer unitTypeId, String status);

List<StorageUnit> findByFacility_IdAndStatus(Integer facilityId, String status);
    int countByFacility_IdAndStatus(Integer facilityId, String status);

    int countByFacility_IdAndUnitType_IdAndStatus(Integer facilityId, Integer unitTypeId, String status);

    @Query("SELECT su.unitType.id, COUNT(su) FROM StorageUnit su " +
           "WHERE su.facility.id = :facilityId AND su.status = :status " +
           "GROUP BY su.unitType.id")
    List<Object[]> countGroupedByUnitType(@Param("facilityId") Integer facilityId,
                                          @Param("status") String status);

    @Query("SELECT su.unitType.id, COUNT(su) FROM StorageUnit su " +
           "WHERE su.facility.id = :facilityId " +
           "GROUP BY su.unitType.id")
    List<Object[]> countAllGroupedByUnitType(@Param("facilityId") Integer facilityId);
}
