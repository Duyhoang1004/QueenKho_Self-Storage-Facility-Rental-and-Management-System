package com.queenkho.api.repository;

import com.queenkho.api.entity.GoodsCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// BR-131: loại hàng
public interface GoodsCategoryRepository extends JpaRepository<GoodsCategory, Integer> {

    List<GoodsCategory> findAllByOrderBySortOrderAscIdAsc();

    List<GoodsCategory> findByStatusOrderBySortOrderAscIdAsc(String status);

    boolean existsByCode(String code);
}
