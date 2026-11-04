package com.queenkho.api.repository;

import com.queenkho.api.entity.UnitTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// BR-122: lịch sử chuyển ô của hợp đồng
public interface UnitTransferRepository extends JpaRepository<UnitTransfer, Integer> {

    List<UnitTransfer> findByContractIdOrderByIdDesc(Integer contractId);
}
