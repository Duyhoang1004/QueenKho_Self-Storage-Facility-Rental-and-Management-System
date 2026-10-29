package com.queenkho.api.repository;

import com.queenkho.api.entity.FloorFixture;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// UC-06: lối đi / cửa / thang trên mặt bằng
public interface FloorFixtureRepository extends JpaRepository<FloorFixture, Integer> {

    List<FloorFixture> findByFloor_IdOrderByIdAsc(Integer floorId);

    List<FloorFixture> findByFloor_IdIn(List<Integer> floorIds);

    @Modifying
    @Query("DELETE FROM FloorFixture f WHERE f.floor.id = :floorId")
    void deleteAllByFloorId(@Param("floorId") Integer floorId);
}
