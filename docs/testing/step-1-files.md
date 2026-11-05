# Danh sách file của bước 1 — chỉ test

Đây là danh sách dự kiến để bạn duyệt. Chưa stage, commit hoặc push.

## File mới

- `backend/api/src/test/java/com/queenkho/api/integration/ApiAuthorizationSmokeTest.java`
- `backend/api/src/test/java/com/queenkho/api/integration/IsolatedRentalFlowTest.java`
- `backend/api/src/test/java/com/queenkho/api/integration/SqlRefundTriggerBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/security/OwnershipBoundaryBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/AdminAccountBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/AuthBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/BookingBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/BusinessFixtures.java`
- `backend/api/src/test/java/com/queenkho/api/service/BusinessRegressionTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/CheckoutBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/CompensationWorkflowBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/MoneyBoundaryBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/OnlineCheckInBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/SessionBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/StorageUnitBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/SupportBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/UnitTransferBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/VnpayCallbackBusinessTest.java`
- `backend/api/src/test/java/com/queenkho/api/service/VoucherBusinessTest.java`
- `docs/testing/business-tests.md`
- `frontend/tests/image-evidence.test.mjs`
- `frontend/tests/receipt.test.mjs`
- `scripts/test-business.ps1`
- `docs/testing/step-1-files.md`

## File sửa

- `frontend/package.json`: thêm lệnh `npm test`, không thay dependency.

## Không đưa vào commit bước 1

- `target/`, log kết quả chạy và uploads.
- `.vscode/`, tài liệu/diagram/security có sẵn của bạn.
- `docs/review-2026-11-05/` và `docs/note-cap-nhat-pull-05-11-2026.md` của các lần rà soát trước.
- Service/controller/repository, SQL sản phẩm và Docker: chưa sửa.

## LOC

Số dòng vật lý được tính trong đúng các file ở trên, gồm code, import, comment và dòng trống. File mới được tính toàn bộ là dòng thêm; không dùng git add để lấy thống kê.

Tổng: **+2559 / -0 dòng** trong **25 file**; test/config/runner **+2381**, tài liệu **+178**.
