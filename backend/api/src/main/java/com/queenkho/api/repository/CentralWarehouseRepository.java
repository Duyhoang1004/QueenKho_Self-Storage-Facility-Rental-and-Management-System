package com.queenkho.api.repository;

import com.queenkho.api.entity.CentralWarehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// BR-134: kho tổng
public interface CentralWarehouseRepository extends JpaRepository<CentralWarehouse, Integer> {

    List<CentralWarehouse> findAllByOrderByIdAsc();

    List<CentralWarehouse> findByStatusOrderByIdAsc(String status);
}
