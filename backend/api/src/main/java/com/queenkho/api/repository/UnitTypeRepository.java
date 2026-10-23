package com.queenkho.api.repository;

import com.queenkho.api.entity.UnitType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UnitTypeRepository extends JpaRepository<UnitType, Integer> {

    List<UnitType> findByStatus(String status);

    List<UnitType> findByStatusIgnoreCase(String status);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    Optional<UnitType> findByNameIgnoreCase(String name);
}
