package com.queenkho.api.service;

import com.queenkho.api.dto.SimulateAccessRequest;
import com.queenkho.api.dto.UnitAccessLogResponse;
import com.queenkho.api.dto.UnitAccessSummaryResponse;
import com.queenkho.api.entity.RentalContract;
import com.queenkho.api.repository.RentalContractRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class UnitAccessService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private RentalContractRepository rentalContractRepository;

    /**
     * Lấy tóm tắt thiết bị khóa Smartlock và toàn bộ lịch sử ra vào của hợp đồng.
     */
    @Transactional(readOnly = true)
    public UnitAccessSummaryResponse getAccessSummary(Integer contractId) {
        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hợp đồng: " + contractId));

        String storageUnitId = contract.getStorageUnit() != null ? contract.getStorageUnit().getId() : "UNIT-" + contractId;
        String roomNumber = contract.getStorageUnit() != null ? contract.getStorageUnit().getRoomNumber() : storageUnitId;
        String deviceCode = "SMARTLOCK-" + (roomNumber != null ? roomNumber : storageUnitId);

        boolean isOverdue = "OVERDUE".equalsIgnoreCase(contract.getStatus());
        boolean isTerminated = "TERMINATED".equalsIgnoreCase(contract.getStatus()) || "LIQUIDATED".equalsIgnoreCase(contract.getStatus());
        boolean isPendingCheckIn = "PENDING_CHECK_IN".equalsIgnoreCase(contract.getStatus());

        boolean isAccessBlocked = isOverdue || isTerminated || isPendingCheckIn;
        String blockReason = null;
        if (isOverdue) {
            blockReason = "Hợp đồng đã quá hạn - Mã PIN và thẻ từ bị khóa tự động";
        } else if (isTerminated) {
            blockReason = "Hợp đồng đã chấm dứt - Quyền truy cập đã bị thu hồi";
        } else if (isPendingCheckIn) {
            blockReason = "Hợp đồng chưa check-in - Thiết bị chưa được kích hoạt";
        }

        List<UnitAccessLogResponse> logs = jdbcTemplate.query(
                "SELECT id, contract_id, storage_unit_id, access_method, credential_code, device_code, status, failure_reason, battery_percentage, accessed_at, notes " +
                "FROM unit_access_history WHERE contract_id = ? ORDER BY accessed_at DESC, id DESC",
                (rs, rowNum) -> UnitAccessLogResponse.builder()
                        .id(rs.getLong("id"))
                        .contractId(rs.getInt("contract_id"))
                        .storageUnitId(rs.getString("storage_unit_id"))
                        .accessMethod(rs.getString("access_method"))
                        .credentialCode(rs.getString("credential_code"))
                        .deviceCode(rs.getString("device_code"))
                        .status(rs.getString("status"))
                        .failureReason(rs.getString("failure_reason"))
                        .batteryPercentage(rs.getInt("battery_percentage"))
                        .accessedAt(rs.getTimestamp("accessed_at") != null ? rs.getTimestamp("accessed_at").toLocalDateTime() : null)
                        .notes(rs.getString("notes"))
                        .build(),
                contractId
        );

        return UnitAccessSummaryResponse.builder()
                .contractId(contract.getId())
                .contractCode(contract.getContractCode())
                .storageUnitId(storageUnitId)
                .roomNumber(roomNumber)
                .deviceCode(deviceCode)
                .deviceModel("SMARTLOCK PRO-X5")
                .batteryPercentage(95)
                .isDoorLocked(true)
                .isAccessBlocked(isAccessBlocked)
                .blockReason(blockReason)
                .currentPinCode(contract.getAccessPinCode())
                .currentRfidCode(contract.getRfidCardCode())
                .logs(logs)
                .build();
    }

    /**
     * Giả lập tín hiệu quẹt thẻ RFID hoặc nhập mã PIN từ thiết bị khóa tại cửa ô kho.
     */
    @Transactional
    public UnitAccessLogResponse simulateAccess(Integer contractId, SimulateAccessRequest request) {
        RentalContract contract = rentalContractRepository.findDetailById(contractId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hợp đồng: " + contractId));

        String storageUnitId = contract.getStorageUnit() != null ? contract.getStorageUnit().getId() : "UNIT-" + contractId;
        String roomNumber = contract.getStorageUnit() != null ? contract.getStorageUnit().getRoomNumber() : storageUnitId;
        String deviceCode = "SMARTLOCK-" + (roomNumber != null ? roomNumber : storageUnitId);

        String method = (request != null && "RFID".equalsIgnoreCase(request.getAccessMethod())) ? "RFID" : "PIN";
        boolean isInvalid = request != null && Boolean.TRUE.equals(request.getIsInvalid());

        boolean isOverdue = "OVERDUE".equalsIgnoreCase(contract.getStatus());
        boolean isTerminated = "TERMINATED".equalsIgnoreCase(contract.getStatus()) || "LIQUIDATED".equalsIgnoreCase(contract.getStatus());
        boolean isPendingCheckIn = "PENDING_CHECK_IN".equalsIgnoreCase(contract.getStatus());

        String status;
        String failureReason;
        String credentialCode;
        String notes;
        int batteryPercentage = 95;

        if (isInvalid) {
            status = "DENIED";
            if ("PIN".equals(method)) {
                credentialCode = "MÃ_KHÔNG_HỢP_LỆ";
                failureReason = "Mã PIN không khớp trong hệ thống";
                notes = "Chốt cửa vẫn khóa - Cảnh báo nhập sai mã PIN";
            } else {
                credentialCode = "THẺ_CHƯA_ĐĂNG_KÝ";
                failureReason = "Thẻ RFID không có quyền truy cập vào ô kho này";
                notes = "Chốt cửa vẫn khóa - Cảnh báo thẻ lạ không xác định";
            }
        } else {
            if (isOverdue) {
                status = "DENIED";
                if ("PIN".equals(method)) {
                    credentialCode = contract.getAccessPinCode() != null ? contract.getAccessPinCode() : "123456";
                    failureReason = "Hợp đồng đã quá hạn - Mã PIN đã bị khóa tự động";
                    notes = "Chốt cửa vẫn khóa - Khách hàng cần gia hạn hoặc xử lý quá hạn";
                } else {
                    credentialCode = contract.getRfidCardCode() != null ? contract.getRfidCardCode() : "RFID-CARD";
                    failureReason = "Hợp đồng đã quá hạn - Thẻ từ RFID đã bị vô hiệu hóa";
                    notes = "Chốt cửa vẫn khóa - Thẻ từ tạm ngừng hoạt động";
                }
            } else if (isTerminated) {
                status = "DENIED";
                credentialCode = "THU_HỒI";
                failureReason = "Hợp đồng đã kết thúc - Quyền truy cập đã bị chấm dứt";
                notes = "Chốt cửa vẫn khóa - Thiết bị khóa đã ngắt liên kết hợp đồng";
            } else if (isPendingCheckIn) {
                status = "DENIED";
                credentialCode = "CHƯA_KÍCH_HOẠT";
                failureReason = "Hợp đồng chưa làm thủ tục nhận kho (Check-in)";
                notes = "Chốt cửa vẫn khóa - Chưa bàn giao kho cho khách hàng";
            } else {
                status = "SUCCESS";
                failureReason = null;
                if ("PIN".equals(method)) {
                    credentialCode = contract.getAccessPinCode() != null ? contract.getAccessPinCode() : "123456";
                    notes = "Xác thực mã PIN thành công - Mở chốt cửa 5 giây";
                } else {
                    credentialCode = contract.getRfidCardCode() != null ? contract.getRfidCardCode() : "RFID-CARD";
                    notes = "Quẹt thẻ RFID hợp lệ - Mở chốt cửa 5 giây";
                }
            }
        }

        LocalDateTime now = LocalDateTime.now();
        KeyHolder keyHolder = new GeneratedKeyHolder();

        final String finalCredentialCode = credentialCode;
        final String finalStatus = status;
        final String finalFailureReason = failureReason;
        final String finalNotes = notes;

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO unit_access_history (contract_id, storage_unit_id, access_method, credential_code, device_code, status, failure_reason, battery_percentage, accessed_at, notes) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setInt(1, contractId);
            ps.setString(2, storageUnitId);
            ps.setString(3, method);
            ps.setString(4, finalCredentialCode);
            ps.setString(5, deviceCode);
            ps.setString(6, finalStatus);
            ps.setString(7, finalFailureReason);
            ps.setInt(8, batteryPercentage);
            ps.setTimestamp(9, Timestamp.valueOf(now));
            ps.setString(10, finalNotes);
            return ps;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        Long newId = generatedId != null ? generatedId.longValue() : null;

        return UnitAccessLogResponse.builder()
                .id(newId)
                .contractId(contractId)
                .storageUnitId(storageUnitId)
                .accessMethod(method)
                .credentialCode(credentialCode)
                .deviceCode(deviceCode)
                .status(status)
                .failureReason(failureReason)
                .batteryPercentage(batteryPercentage)
                .accessedAt(now)
                .notes(notes)
                .build();
    }
}
