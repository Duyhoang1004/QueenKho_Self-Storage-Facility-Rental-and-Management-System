# UC-11: Thanh toán qua VNPAY (Sandbox)

Tài liệu này cung cấp các thông tin dùng để kiểm thử (test) tính năng thanh toán bằng VNPAY trên môi trường Sandbox.

## 1. Thông tin thẻ Test (Ngân hàng NCB)

Để thanh toán thành công trong lúc chạy test nội bộ, bạn vui lòng chọn phương thức thanh toán qua **Thẻ ATM nội địa**, chọn ngân hàng **NCB** và điền chính xác các thông tin dưới đây:

- **Ngân hàng:** NCB
- **Số thẻ:** `9704198526191432198`
- **Tên chủ thẻ:** `NGUYEN VAN A`
- **Ngày phát hành:** `07/15`
- **Mật khẩu OTP:** `123456`

## 2. Các kịch bản có thể kiểm thử
- **Thanh toán thành công:** Nhập đúng thông tin thẻ và OTP. Đơn hàng sẽ chuyển sang trạng thái Đã thanh toán (DEPOSIT_PAID).
- **Hủy thanh toán:** Tại màn hình nhập thẻ hoặc quét QR của VNPAY, bấm nút "Hủy" hoặc quay lại. Giao dịch sẽ ghi nhận là Thất bại.
- **Quá hạn thanh toán (10 phút):** Treo màn hình thanh toán hơn 10 phút, phiên giao dịch sẽ hết hạn.
