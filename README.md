# ZK-Login Proof of Concept (Mô Hình Upload File & Challenge-Response)

Dự án này chứng minh cơ chế đăng nhập không cần truyền mật khẩu thông qua mạng internet, sử dụng công nghệ Zero-Knowledge Proof (ZKP).

Điểm đặc biệt của dự án là việc tách biệt hoàn toàn môi trường tạo bằng chứng (Prover chạy trên máy người dùng) và môi trường xác minh (Verifier chạy trên Server).

Tất cả giao tiếp từ máy người dùng lên máy chủ đều thông qua việc tạo và upload các file tĩnh (.json), đảm bảo rằng mật khẩu của người dùng chưa bao giờ rời khỏi thiết bị của họ, và hệ thống chống lại được các cuộc tấn công phát lại (Replay Attack) thông qua việc sử dụng mã Challenge.

---

## 1. Yêu cầu hệ thống

- Node.js (phiên bản 18 hoặc 20 trở lên).
- Môi trường Linux, macOS, hoặc WSL2 (trên Windows) để có thể chạy các đoạn mã shell biên dịch mạch.

---

## 2. Hướng dẫn cài đặt

**Lưu ý:** Nếu không thay đổi logic mạch ZK, chỉ cần cài đặt các thư viện phụ thuộc của Node.js.
```bash
npm install
``` 

**TRƯỜNG HỢP MUỐN XÂY DỰNG MẠCH ZK MỚI:** Biên dịch mạch Circom và tạo các khóa mật mã học (quá trình Trusted Setup).

```bash
bash scripts/setup.sh
```

Sau khi chạy xong, hệ thống sẽ tạo ra các file cần thiết nằm trong thư mục `circuit/login_with_challenge_js/` và `keys/`.

---

## 3. Hướng dẫn sử dụng

Để thử nghiệm toàn bộ quy trình đăng nhập, cần khởi chạy cả Server và công cụ Client cục bộ.

### Khởi chạy Server

Mở một cửa sổ Terminal và khởi chạy Server:
```bash
node server/index.js
```
Truy cập vào trình duyệt theo địa chỉ `http://localhost:3000`. Bạn sẽ thấy giao diện đăng nhập và một mã Challenge Code.

### Sử dụng Client (Tạo bằng chứng offline)

Mở một cửa sổ Terminal thứ hai (đại diện cho máy của người dùng không kết nối trực tiếp tới server bằng mã code):
```bash
node client/cli.js
```

Quá trình thử nghiệm gồm 2 giai đoạn:

**Giai đoạn 1: Đăng ký**
1. Trong cửa sổ CLI, chọn chức năng Đăng ký (phím 1).
2. Nhập Username và Password.
3. Công cụ sẽ tự động tính toán và sinh ra một file có tên `register_data.json` ngay tại thư mục hiện tại.
4. Trên trình duyệt Web, tại phần Đăng ký, ấn nút upload và chọn file `register_data.json` vừa được tạo ra, sau đó ấn Submit.

**Giai đoạn 2: Đăng nhập**
1. Nhìn mã Challenge Code đang hiển thị trên trình duyệt Web.
2. Trong cửa sổ CLI, chọn chức năng Đăng nhập (phím 2).
3. Nhập Username, Password, và gõ mã Challenge Code vừa thấy.
4. Công cụ sẽ mất vài giây để sinh ra bằng chứng toán học và lưu vào file `login_proof.json`.
5. Trên trình duyệt Web, tại phần Đăng nhập, ta upload file `login_proof.json` và ấn Login.
6. Server sẽ xác minh tính hợp lệ của bằng chứng và cho phép đăng nhập.

Ghi chú: Sau khi đăng nhập thành công, mã Challenge trên Web sẽ tự động thay đổi. Nếu ta cố tình upload lại file `login_proof.json` cũ lên một lần nữa, Server sẽ báo lỗi để ngăn chặn Replay Attack.
