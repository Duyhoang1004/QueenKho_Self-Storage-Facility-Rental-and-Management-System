package com.queenkho.api.repository;

import com.queenkho.api.entity.Facility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FacilityRepository extends JpaRepository<Facility, Integer> {

    List<Facility> findByStatus(String status);

    @Query("SELECT f FROM Facility f WHERE f.status = 'ACTIVE' " +
           "AND (:keyword IS NULL OR f.name LIKE CONCAT('%', :keyword, '%') " +
           "OR f.district LIKE CONCAT('%', :keyword, '%') " +
           "OR f.address LIKE CONCAT('%', :keyword, '%')) " +
           "AND (:city IS NULL OR f.city = :city)")
    Page<Facility> search(@Param("keyword") String keyword,
                          @Param("city") String city,
                          Pageable pageable);

    @Query("SELECT DISTINCT f.city FROM Facility f WHERE f.status = 'ACTIVE' ORDER BY f.city")
    List<String> findDistinctCities();
}
