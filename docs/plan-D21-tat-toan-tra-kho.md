# Plan code D-21 — Trả kho = tất toán, khách xác nhận kết thúc hợp đồng

> ✅ **Đã code 19/11/2026** (chưa commit). Khác plan: Staff kiểm tra lại dùng chung `POST /staff-tasks/{id}/check-out`; thêm `SETTLEMENT_MANAGE` trong `AccessPolicy`; nhãn trạng thái tách ra `frontend/src/utils/settlementStatus.js`.

> Rule: `docs/business-rules.md` — D-21, PR-O17 → PR-O24 (UC-22 / UC-23), PR-O9, PR-O11, PR-Q12, PR-S8, BR-126, BR-128, L-43, L-44.
> Nhánh đề xuất: `feature/d21-tat-toan-tra-kho` (bạn tự tạo). Theo quy trình: **bạn gõ BE**, mình review → mình làm FE → test.

---

## 1. Trạng thái

### 1.1 Hợp đồng
```
TERMINATION_PENDING ──(Staff nghiệm thu)──▶ SETTLEMENT_PENDING ──(khách xác nhận ≥ 0 / tự xác nhận 3 ngày / trả xong phần âm)──▶ TERMINATED
```
Đơn đặt chỗ giữ `TERMINATION_PENDING` tới khi hợp đồng `TERMINATED` → `COMPLETED`.

### 1.2 Bảng quyết toán `checkout_settlements.status`
```
                      ┌──────────── FM chốt hồ sơ bồi thường ────────────┐
                      │                                                  ▼
(nghiệm thu) ──▶ WAITING_CLAIM                                   WAITING_CUSTOMER ──(xác nhận, ≥ 0)──────────▶ COMPLETED
     │      (còn hồ sơ INSPECTED)                                   │  ▲      │  └──(đồng ý, < 0)──▶ AWAITING_PAYMENT ──(trả đủ)──▶ COMPLETED
     └──────────(không còn hồ sơ chờ)──────────────────────────────▶│  │      └──(quá 3 ngày, ≥ 0)───────────────────────────────▶ COMPLETED
                                                                    │  │
                                                    "Không đồng ý"  ▼  │ FM sửa tiền / giữ nguyên → bảng MỚI
                                                                 DISPUTED ──(FM giao Staff)──▶ RECHECKING ──(Staff lập lại sự cố)──▶ bảng MỚI
```
- Bảng cũ khi có bảng mới → `SUPERSEDED`. Mỗi hợp đồng **chỉ 1 bảng** khác `SUPERSEDED` / `COMPLETED` cùng lúc.
- `round_no` tăng mỗi lần sinh bảng mới.

---

## 2. Màn hình & nút

| Vai trò | Màn | Thay đổi |
|---|---|---|
| Khách | Modal hẹn trả kho (`ContractOptionsModal.jsx`) | Khối cảnh báo: danh sách ticket / hồ sơ bồi thường đang mở (PR-O24). Không chặn nút gửi. |
| Khách | Trang hợp đồng (`CustomerContractPage.jsx`) | Trạng thái `SETTLEMENT_PENDING` "Chờ xác nhận kết thúc": biên bản trả kho + ảnh, **bảng quyết toán** từng dòng, lịch sử các vòng (ghi chú FM / Staff, lý do khách). Nút: **Xác nhận kết thúc hợp đồng** (≥ 0) · **Đồng ý & thanh toán X đ** (< 0 → VNPAY) · **Thanh toán X đ** (`AWAITING_PAYMENT`) · **Không đồng ý** (modal lý do). `WAITING_CLAIM` / `RECHECKING` / `DISPUTED`: banner chờ, ẩn nút. |
| Khách | `MyReservationsPage`, `ContractDetailView`, `HomePage` | Nhãn trạng thái mới. |
| Staff | Chi tiết task `CHECK_OUT` (`StaffTaskDetailPage.jsx`) | Khối "Yêu cầu hỗ trợ / hồ sơ bồi thường của hợp đồng" — còn ticket `OPEN`/`IN_PROGRESS` hoặc hồ sơ `SUBMITTED` thì **khoá nút nghiệm thu** + link sang task tương ứng (PR-O17). Sau nghiệm thu: hiện "Chờ khách xác nhận" + bảng quyết toán; nếu âm: nút **Đã thu tiền mặt** (tick khách ký nhận). Task `[RECHECK]`: chế độ **Kiểm tra lại** — chỉ form danh sách sự cố + ghi chú, không checklist. |
| FM | **Mới** `/manager/settlements` — `ManagerSettlementsPage.jsx` (menu "Quyết toán trả kho") | Tab: Chờ FM (`DISPUTED`, `WAITING_CLAIM`) · Chờ khách · Chờ thanh toán · Đã xong. Chi tiết: biên bản, ảnh, bảng, lý do khách. Nút: **Sửa số tiền** (sửa từng sự cố / bên chịu lỗi, giảm phí trễ / chiếm dụng, ghi chú bắt buộc) · **Giữ nguyên** (ghi chú) · **Giao lại nhân viên** (chọn Staff tuỳ chọn, ghi chú) · **Đã thu tiền mặt**. |
| FM | `ClaimsPage.jsx` | Hồ sơ có `settlementId` → ẩn nút "Chi trả", hiện "Chi trả qua quyết toán trả kho" + link. |
| FM | `ManagerTaskBoardPage.jsx` | Nhãn task `CHECK_OUT` `[RECHECK]` = "Kiểm tra lại (khiếu nại)". Đóng task bảo trì khi đang khiếu nại → hiện lỗi `SETTLEMENT_DISPUTED`. |
| FM | `CustomerContractsPage.jsx`, `unitDisplayState.js` | Nhãn trạng thái mới. |
| Demo | Nút giả lập trên trang hợp đồng | "⚡ Quá 3 ngày — tự xác nhận" (lùi `created_at` của bảng 3 ngày rồi chạy job). |

---

## 3. SQL (làm trước — `ddl-auto: validate`)

File mới `sql_script/Update_tat_toan_tra_kho.sql` (idempotent `IF NOT EXISTS`), sau đó gộp vào `QueenKho.sql`, `QueenKho_full.sql`, `QueenKho_TongHop.sql`:

1. `CREATE TABLE checkout_settlements` — cột như mục 5 business-rules; `CK_settlements_status`; FK `contract_id`, `check_out_task_id`, `refund_task_id` → `facility_tasks`, `debt_transaction_id` → `payment_transactions`, `created_by` → `users`; index `(contract_id, status)`.
2. `ALTER TABLE compensation_claims ADD settlement_id INT NULL` + FK.
3. Sửa comment `rental_contracts.status` thêm `SETTLEMENT_PENDING`; comment `payment_method` thêm `SETTLEMENT_OFFSET`.
4. *(L-44, nên làm cùng)* Trigger `trg_facility_tasks_refund_sync` bước 1: chỉ đổi `TERMINATED` khi `c.status IN ('TERMINATION_PENDING','SETTLEMENT_PENDING','TERMINATED')` — không đụng `LIQUIDATED`.

⚠️ Sau khi merge nhắc cả nhóm chạy lại script.

---

## 4. Backend

### 4.1 Lớp mới
| Lớp | Nội dung |
|---|---|
| `entity/CheckoutSettlement` | map bảng mới; `@ManyToOne` contract, checkOutTask, refundTask, createdBy. |
| `repository/CheckoutSettlementRepository` | `findTopByContract_IdAndStatusNotInOrderByRoundNoDesc`, `findByContract_IdOrderByRoundNoDesc`, `findByStatusAndCreatedAtBefore` (job), `findByFacility…` (màn FM, query JPQL theo `contract.storageUnit.facility.id`). |
| `dto/SettlementResponse` | id, contractId/code, roundNo, status, các khoản tiền, `netAmount`, `direction` (`REFUND_TO_CUSTOMER` / `CUSTOMER_PAYS`), damages[] (title, cost, liableParty, ảnh), claims[] (code, amount), notes, disputeReason, history[] (các vòng trước), `canConfirm/canDispute/canPay`. |
| `dto/SettlementDisputeRequest` | `reason` (10–500). |
| `dto/SettlementAdjustRequest` | `damages[] {damageCaseId, estimatedCost, liableParty}`, `waiveLateFee`, `waiveOverstayFee`, `note` (10–1000). Chỉ được **giảm**. |
| `dto/SettlementDecisionRequest` | `note` (giữ nguyên) / `note` + `staffId?` (giao lại). |
| `dto/SettlementRecheckRequest` | `damages[]` (dùng lại `CheckOutRequest.DamageItemRequest`), `notes`. Staff kiểm tra lại được **tăng hoặc giảm**. |
| `dto/SettlementCashPaymentRequest` | `cashReceiptConfirmed`, `evidenceImageUrl?`, `note?`. |
| `dto/SettlementConfirmResponse` | `status`, `contractStatus`, `payUrl?`, `message`. |
| `service/CheckoutSettlementService` | **Toàn bộ nghiệp vụ tất toán** (xem 4.2). |
| `controller/CheckoutSettlementController` | API mục 5. |

### 4.2 `CheckoutSettlementService` — hàm chính (`@Transactional`)
| Hàm | Rule | Việc |
|---|---|---|
| `createInitial(contract, checkOutTask, checkoutDate)` | PR-O18, PR-O19 | Gọi `StaffTaskService.calculateCheckoutRefund(...)` (đã có) lấy cọc / phí / hoàn thuê; cộng bồi thường `APPROVED` chưa có `settlement_id`; status `WAITING_CLAIM` nếu còn hồ sơ `INSPECTED`, ngược lại `WAITING_CUSTOMER`; báo + email khách. |
| `recalculate(contract, reason, actor, overrides)` | PR-O19, PR-O22 | Bảng hiện tại → `SUPERSEDED`; tạo bảng `round_no + 1` (giữ `checkout_date` gốc). Dùng chung cho: FM chốt hồ sơ, FM sửa tiền, FM giữ nguyên, Staff kiểm tra lại. |
| `getForCustomer / getForStaff / listForManager / getForManager` | PR-90 | Kiểm tra chủ hợp đồng / cùng cơ sở. |
| `confirm(contractId, customerId)` | PR-O20, PR-O21 | Phải `WAITING_CUSTOMER`. ≥ 0 → ghi `DEPOSIT_OFFSET`, tạo task `REFUND` (gộp bồi thường, gắn `claim.settlement_id`), `finalizeTerminated`. < 0 → ghi `DEPOSIT_OFFSET`, cấn trừ bồi thường (`COMPENSATION`/`SETTLEMENT_OFFSET`, claim `PAID` + đòi bảo hiểm), tạo 1 dòng nợ `PENDING`, status `AWAITING_PAYMENT`, trả `payUrl` từ `VnpayService.createDebtPayment`. |
| `dispute(contractId, customerId, reason)` | PR-O22 | `WAITING_CUSTOMER` → `DISPUTED`; báo FM; log `[SETTLEMENT_DISPUTE]`. |
| `adjust / keep / assignRecheck(settlementId, managerId, req)` | PR-O22 | Chỉ khi `DISPUTED`. `assignRecheck` tạo task `CHECK_OUT` note `[RECHECK] …`, hạn 21:00 hôm sau, status `RECHECKING`. |
| `recordRecheck(taskId, staffId, req)` | PR-O22 | Task `[RECHECK]` `IN_PROGRESS` của Staff; lưu `damage_cases` mới gắn task này; task `COMPLETED`; `recalculate`. |
| `onClaimDecided(claim)` | PR-O19 | Gọi từ `CompensationClaimService.decide`: hợp đồng `SETTLEMENT_PENDING` + bảng `WAITING_CLAIM` → `recalculate`. |
| `onRefundCompleted(refundTask, method, evidence, ft)` | PR-O20, BR-128 | Gọi từ `StaffTaskService.completeRefundTask`: hồ sơ có `settlement_id` của bảng → `PAID` (tách hàm `markPaid` từ `CompensationClaimService.pay`). |
| `onDebtPaid(transactionId)` | PR-O21 | Gọi từ `VnpayService` sau IPN nợ thành công: bảng `AWAITING_PAYMENT` có `debt_transaction_id` này → `finalizeTerminated`. |
| `recordCashPayment(contractId, actor, req)` | PR-O21 | Staff / FM cùng cơ sở; dòng nợ → `CASH` `SUCCESS`; `finalizeTerminated`. |
| `autoConfirmDue()` | PR-O23 | Bảng `WAITING_CUSTOMER`, `net_amount ≥ 0`, `created_at` ≤ now − 3 ngày → như `confirm` với `auto_confirmed = 1`. |
| `remindUnpaid()` | PR-O23 | Bảng âm chưa xong, đúng mốc 1 / 3 / 7 ngày → thông báo + email. |
| `finalizeTerminated(contract, settlement)` *(private)* | PR-O20, PR-O21, PR-S8 | Hợp đồng `TERMINATED`, đơn `COMPLETED`, `closeOpenSupportTicketsAndTasks`, bảng `COMPLETED` + `customer_confirmed_at`, log, báo FM. |

### 4.3 Sửa lớp cũ
| Lớp | Sửa |
|---|---|
| `StaffTaskService.checkOut` | **Trước** UPDATE task: kiểm tra PR-O17 (409 `OPEN_TICKETS_PENDING` / `CLAIM_INSPECTION_PENDING`). Nếu hợp đồng `SETTLEMENT_PENDING` + task `[RECHECK]` → chuyển sang `recordRecheck`. Giữ bước 4–6 (biên bản, sự cố, ô, PIN). **Bỏ** đoạn `TERMINATED` / `COMPLETED`, ghi giao dịch 8a–8d, tạo task `REFUND` 8e → chuyển vào `CheckoutSettlementService`. Thay bằng: hợp đồng `SETTLEMENT_PENDING`, đóng ticket `RESOLVED`, `settlementService.createInitial(...)`. Thông báo khách đổi nội dung. |
| `StaffTaskService` (helper) | Tách 8a–8e thành hàm dùng lại được: `writeDepositOffsets(...)`, `createSettlementRefundTask(...)`. Thêm `closeResolvedTickets(contractId)`. |
| `StaffTaskService.completeRefundTask` | Sau khi hoàn tất → `settlementService.onRefundCompleted(...)`. |
| `StaffTaskService.completeMaintenanceTask` (+ `closeOpenMaintenanceForUnit`) | Hợp đồng của ô có bảng `DISPUTED` / `RECHECKING` → 409 `SETTLEMENT_DISPUTED`. |
| `CompensationClaimService.decide` | Cuối hàm → `settlementService.onClaimDecided(claim)`. |
| `CompensationClaimService.pay` | Hợp đồng `SETTLEMENT_PENDING` hoặc `claim.settlementId != null` → 409 `CLAIM_IN_SETTLEMENT`. Tách phần ghi `PAID` + bảo hiểm thành `markPaid(claim, method, evidence, ft, actorId, txnMethod)`. |
| `VnpayService` (IPN nhánh `isDebt`, ~dòng 310–370) | Thành công → `settlementService.onDebtPaid(id)`. |
| `ReservationService` (~dòng 479, PR-Q12) | Thêm điều kiện: hợp đồng `SETTLEMENT_PENDING` có bảng `net_amount < 0` chưa `COMPLETED`. |
| `ContractViewService` + `CustomerContractResponse` | Thêm `settlement` (SettlementResponse rút gọn) khi `SETTLEMENT_PENDING`; sửa cờ `settled` (dòng ~211) cho trạng thái mới. |
| `StaffTaskOverdueJob` (mỗi phút) | Gọi `settlementService.autoConfirmDue()`. Task `[RECHECK]` quá hạn: cho FM gia hạn như PR-S4 (thêm vào điều kiện `extend`). |
| `RenewalReminderService.scheduledRun` (08:00) | Gọi `settlementService.remindUnpaid()`. |
| `DemoSimulationService` / `DemoSimulationController` | `settlementAutoConfirmNow(contractId)`. `checkoutToday` giữ nguyên. |
| `security/AccessPolicy` | Khai báo mọi API mục 5 (thiếu → 403 `API_NOT_DECLARED`, `AccessPolicyTest` fail). |
| `SupportRequestService` | Không đổi (PR-51 đã loại `SETTLEMENT_PENDING`). Chỉ kiểm tra lại. |
| Các chỗ liệt kê trạng thái đang thuê (`RenewalPolicyService`, `UnitSensorService`, `UnitTransferService`, `UnitScheduleService`, `FloorPlanService`, `AdminUserService` PR-A5…) | Rà từng chỗ: `SETTLEMENT_PENDING` **không** tính là đang chiếm ô, **có** tính là "khách còn việc dở" ở PR-A5 (không khoá tài khoản khi chưa tất toán). |

---

## 5. API mới (cập nhật `docs/api-contract.md`)
| Method | Path | Ai | Rule |
|---|---|---|---|
| GET | `/api/v1/contracts/{id}/settlement` | Khách (của mình), Staff / FM (cơ sở mình) | PR-O19 |
| POST | `/api/v1/contracts/{id}/settlement/confirm` | Khách | PR-O20, PR-O21 |
| POST | `/api/v1/contracts/{id}/settlement/dispute` | Khách | PR-O22 |
| POST | `/api/v1/contracts/{id}/settlement/pay` | Khách — tạo lại link VNPAY khi `AWAITING_PAYMENT` | PR-O21 |
| POST | `/api/v1/contracts/{id}/settlement/cash-payment` | Staff / FM | PR-O21 |
| GET | `/api/v1/settlements?status=` | FM | PR-O22 |
| POST | `/api/v1/settlements/{id}/adjust` | FM | PR-O22 |
| POST | `/api/v1/settlements/{id}/keep` | FM | PR-O22 |
| POST | `/api/v1/settlements/{id}/recheck` | FM | PR-O22 |
| POST | `/api/v1/staff-tasks/{id}/check-out` (task `[RECHECK]`) | Staff | PR-O22 — *đã code: dùng chung endpoint nghiệm thu, không thêm endpoint mới* |
| POST | `/api/v1/dev/simulation/contracts/{id}/settlement-auto-confirm` | Demo | PR-O23 |

`POST /staff-tasks/{id}/check-out` giữ nguyên request, **response** thêm `settlement`; hợp đồng trả về `SETTLEMENT_PENDING`.

---

## 6. Frontend (mình làm sau khi BE xong)
- `services/settlementService.js` (mới): get / confirm / dispute / pay / cashPayment / list / adjust / keep / recheck / staffRecheck.
- `components/SettlementPanel.jsx` (mới, dùng chung khách / Staff / FM): bảng quyết toán + biên bản + lịch sử vòng.
- Sửa: `CustomerContractPage.jsx`, `ContractOptionsModal.jsx`, `StaffTaskDetailPage.jsx`, `ClaimsPage.jsx`, `ManagerTaskBoardPage.jsx`, nhãn trạng thái ở `MyReservationsPage.jsx`, `ContractDetailView.jsx`, `CustomerContractsPage.jsx`, `unitDisplayState.js`, `HomePage.jsx`.
- Trang mới `pages/manager/ManagerSettlementsPage.jsx` + route trong `App.jsx` (ManagerLayout) + `menuItems`.
- Kiểm tra: `npm run lint`, `npm run build`, chạy thử trên trình duyệt.

---

## 7. Kiểm thử
**Unit / integration (thêm `CheckoutSettlementServiceTest`)**: công thức PR-O19 (dương / âm / = 0, có bồi thường, trả sớm, fault_termination); PR-O17 chặn 2 trường hợp; `confirm` dương tạo đúng 1 task `REFUND`; âm tạo đúng 1 dòng nợ + cấn trừ bồi thường; `onDebtPaid` → `TERMINATED`; dispute → adjust (chỉ giảm) → bảng mới; recheck tăng phí; auto-confirm chỉ bảng dương; `CLAIM_IN_SETTLEMENT`; `AccessPolicyTest` vẫn xanh.

**Kịch bản tay (mình viết script chi tiết ở bước 9)**:
1. Trả đúng hạn, không sự cố → khách xác nhận → task `REFUND` → FM hoàn tất.
2. Có ticket khoá `IN_PROGRESS` → Staff bị chặn → xử lý ticket → nghiệm thu được.
3. Hàng hư `SUBMITTED` → bị chặn → kiểm tra hiện trường → nghiệm thu → `WAITING_CLAIM` → FM chốt `APPROVED` → khách thấy tiền bồi thường cộng vào → xác nhận → FM hoàn tất → hồ sơ `PAID`.
4. Sự cố vượt cọc → âm → VNPAY → `TERMINATED`; lần khác: tiền mặt tại quầy.
5. Khách "Không đồng ý" → FM giao lại Staff → Staff giảm phí → khách xác nhận.
6. Khách không vào: dương → nút ⚡ tự xác nhận; âm → bị chặn đặt kho mới.

---

## 8. Thứ tự làm
1. SQL + chạy trên DB local.
2. Entity, repository, DTO.
3. `CheckoutSettlementService` (createInitial, recalculate, get, confirm, finalizeTerminated) + sửa `StaffTaskService.checkOut` → test luồng 1.
4. Nợ âm: confirm âm, `onDebtPaid`, cash → luồng 4.
5. Khiếu nại: dispute, adjust, keep, assignRecheck, recordRecheck, chặn bảo trì → luồng 5.
6. Bồi thường: PR-O17 chặn, `onClaimDecided`, `onRefundCompleted`, `CLAIM_IN_SETTLEMENT` → luồng 2, 3.
7. Job tự xác nhận + nhắc nợ + giả lập → luồng 6.
8. AccessPolicy, ReservationService PR-Q12, rà trạng thái; `./mvnw -q compile` + test.
9. FE (mình) → test tay → `api-contract.md` → đánh dấu ✅ trong business-rules (bỏ ⬜, đóng L-43, L-44).

## 9. Ảnh hưởng dữ liệu cũ
- Hợp đồng đã `TERMINATED` trước khi deploy: không đổi; nợ cũ vẫn trả ở UC-20 như trước.
- Hợp đồng đang `TERMINATION_PENDING`: nghiệm thu sau deploy đi luồng mới.
- Task `REFUND` của trả kho cũ còn mở: trigger vẫn xử lý như cũ (hợp đồng đã `TERMINATED`).
