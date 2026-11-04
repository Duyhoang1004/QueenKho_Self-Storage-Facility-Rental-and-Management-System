package com.queenkho.api.repository;

import com.queenkho.api.entity.HandoverRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

// UC-18: lưu biên bản bàn giao
public interface HandoverRecordRepository extends JpaRepository<HandoverRecord, Integer> {

    // UC-18: biên bản mới nhất của 1 hợp đồng theo loại (CHECK_IN / CHECK_OUT)
    Optional<HandoverRecord> findFirstByContractIdAndRecordTypeOrderByIdDesc(Integer contractId, String recordType);

    // BR-121: khách xem lại mọi biên bản (nhận kho / trả kho) của hợp đồng mình, cũ trước
    List<HandoverRecord> findByContractIdOrderByIdAsc(Integer contractId);
}
