package com.queenkho.api.repository;

import com.queenkho.api.entity.StorageUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StorageUnitRepository extends JpaRepository<StorageUnit, String> {

    int countByFacility_Id(Integer facilityId);
    int countByFacility_IdAndStatus(Integer facilityId, String status);
    List<StorageUnit> findByFacility_IdAndStatus(Integer facilityId, String status);

    int countByFacility_IdAndUnitType_IdAndStatus(Integer facilityId, Integer unitTypeId, String status);
    List<StorageUnit> findByFacility_IdAndUnitType_IdAndStatus(Integer facilityId, Integer unitTypeId, String status);

    List<StorageUnit> findByFacility_Id(Integer facilityId);

    // UC-05: Đếm số ô kho thuộc 1 loại kho trên toàn hệ thống (PR-M4: xóa loại kho)
    int countByUnitType_Id(Integer unitTypeId);

    // UC-05: Gom nhóm số lượng ô kho theo loại kho toàn hệ thống
    @Query("SELECT su.unitType.id, COUNT(su) FROM StorageUnit su GROUP BY su.unitType.id")
    List<Object[]> countAllGroupedByUnitTypeSystemWide();

    // UC-05: Gom nhóm theo (loại kho, trạng thái ô kho) toàn hệ thống
    @Query("SELECT su.unitType.id, su.status, COUNT(su) FROM StorageUnit su GROUP BY su.unitType.id, su.status")
    List<Object[]> countStatusGroupedByUnitTypeSystemWide();

    @Query("SELECT su.unitType.id, COUNT(su) FROM StorageUnit su " +
           "WHERE su.facility.id = :facilityId AND su.status = :status " +
           "GROUP BY su.unitType.id")
    List<Object[]> countGroupedByUnitType(@Param("facilityId") Integer facilityId,
                                          @Param("status") String status);

    @Query("SELECT su.unitType.id, COUNT(su) FROM StorageUnit su " +
           "WHERE su.facility.id = :facilityId " +
           "GROUP BY su.unitType.id")
    List<Object[]> countAllGroupedByUnitType(@Param("facilityId") Integer facilityId);

    @Query("SELECT DISTINCT su.floor FROM StorageUnit su WHERE su.facility.id = :facilityId AND su.floor IS NOT NULL ORDER BY su.floor")
    List<String> findDistinctFloorsByFacilityId(@Param("facilityId") Integer facilityId);
}
