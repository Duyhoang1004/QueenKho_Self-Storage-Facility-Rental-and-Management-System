package com.queenkho.api.repository;

import com.queenkho.api.entity.DamageCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// UC-24: Lưu và truy vấn các sự cố hư hỏng khi nghiệm thu trả kho
public interface DamageCaseRepository extends JpaRepository<DamageCase, Integer> {

    List<DamageCase> findByTask_IdOrderByIdAsc(Integer taskId);

    List<DamageCase> findByContract_IdOrderByIdAsc(Integer contractId);
}
