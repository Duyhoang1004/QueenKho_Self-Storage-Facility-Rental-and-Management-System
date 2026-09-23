TÀI LIỆU KHỞI TẠO DỰ ÁN: QUEENKHO SYSTEM
Tên dự án: QueenKho - Self-Storage Facility Rental and Management System
Kiến trúc mã nguồn: Monorepo (1 Git Repository duy nhất chứa cả frontend/ và backend/)
Công nghệ cốt lõi:
Frontend: ReactJS (Vite + JavaScript + ESLint), Tailwind CSS v3, React Router DOM, Axios.
Backend: Spring Boot 3.x, Java 17 LTS, Spring Data JPA, Maven.
Database: SQLServer / PostgreSQL (14 thực thể theo bản ERD chuẩn).
Repository: GitHub QueenKho
I. CẤU TRÚC THƯ MỤC CHUẨN (MONOREPO)cd
code
Text
QueenKho-System/
├── backend/                             # Mã nguồn Spring Boot (Java 17)
│   ├── src/main/java/com/queenkho/api/
│   │   ├── config/                      # CorsConfig.java, SecurityConfig
│   │   ├── controller/                  # REST API Endpoints
│   │   ├── dto/                         # Request / Response Data Transfer Objects
│   │   ├── entity/                      # 14 Entity DB (User, StorageUnit, Contract...)
│   │   ├── repository/                  # Spring Data JPA Interfaces
│   │   └── service/                     # Business Logic (Tính cọc, phạt, gán kho...)
│   ├── src/main/resources/
│   │   └── application.yml              # Kết nối Database, cổng 8080
│   └── pom.xml
│
├── frontend/                            # Mã nguồn ReactJS (Vite)
│   ├── public/                          # Favicon, static files
│   ├── src/
│   │   ├── assets/                      # Logo QueenKho, hình ảnh kho
│   │   ├── components/                  # Table, Modal, Button, StatusBadge dùng chung
│   │   ├── layouts/                     # CustomerLayout, AdminLayout (Sidebar Navy)
│   │   ├── pages/                       # Màn hình theo 5 Flow (Customer & Admin)
│   │   ├── services/                    # api.js (Axios gọi về http://localhost:8080)
│   │   ├── App.jsx                      # Định tuyến đường dẫn (React Router)
│   │   ├── index.css                    # Nhúng directives Tailwind CSS v3
│   │   └── main.jsx
│   ├── tailwind.config.js               # Mã màu QueenKho: #0B3D66, #F4F6F8...
│   ├── package.json
│   └── vite.config.js
│
└── README.md
II. HƯỚNG DẪN KHỞI TẠO TỪNG BƯỚC (STEP-BY-STEP)
BƯỚC 1: Tạo thư mục gốc dự án
Mở Terminal / PowerShell:
code
Bash
mkdir QueenKho-System
cd QueenKho-System
git init
BƯỚC 2: Cài đặt và cấu hình Backend (Spring Boot 3)
Cài đặt môi trường: Cài JDK 17 LTS (tải bản .msi từ Adoptium.net), tuyệt đối không dùng Java 8 vì Spring Boot 3 bắt buộc từ Java 17 [1.1.2, 1.2.3].
Khởi tạo code tại start.spring.io:
Project: Maven | Language: Java | Spring Boot: 3.x | Java: 17
Group: com.queenkho | Artifact: api
Dependencies: Spring Web, Spring Data JPA, MySQL Driver (hoặc PostgreSQL), Lombok, Validation.
Giải nén vào thư mục QueenKho-System/backend.
Cấu hình backend/src/main/resources/application.yml:
code
Yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/queenkho_db?useSSL=false&createDatabaseIfNotExist=true
    username: root
    password: your_password
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
server:
  port: 8080
Cấu hình CORS để cho phép React gọi API:
Tạo file backend/src/main/java/com/queenkho/api/config/CorsConfig.java:
code
Java
package com.queenkho.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:5173")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
BƯỚC 3: Cài đặt và cấu hình Frontend (ReactJS + Tailwind v3)
Khởi tạo Vite React:
Tại thư mục QueenKho-System, chạy:
code
Bash
npm create vite@latest frontend
Chọn framework: React
Chọn variant: JavaScript
Linter: ESLint
Cài đặt ngay: Yes
Cài đặt các gói phụ trợ cơ bản:
code
Bash
cd frontend
npm install react-router-dom axios
Cài đặt Tailwind CSS v3 (Thay đổi quan trọng so với v4):
(Lý do: Tailwind v4 đã bỏ lệnh npx tailwindcss init -p và bỏ file config truyền thống [1.1.2, 1.2.3]. Ta dùng v3 để ổn định và cấu hình bảng màu dễ dàng [1.1.2, 1.2.3]).
code
Bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
Cấu hình mã màu QueenKho trong frontend/tailwind.config.js:
code
JavaScript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0B3D66',    // Xanh Navy QueenKho (Sidebar, Nút chính)
          hover: '#0A335A',
        },
        page: '#F4F6F8',         // Nền trang xám mát
        surface: '#FFFFFF',      // Nền thẻ trắng nổi bật
      },
    },
  },
  plugins: [],
}
Khai báo Tailwind trong frontend/src/index.css:
Mở file src/index.css, xóa hết nội dung cũ và dán 3 dòng này:
code
CSS
@tailwind base;
@tailwind components;
@tailwind utilities;
Cấu hình Axios Base URL (frontend/src/services/api.js):
code
JavaScript
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080/api/v1',
    headers: {
        'Content-Type': 'application/json',
    }
});

export default api;
BƯỚC 4: Kết nối GitHub & Đẩy code lên nhánh TrongHieu
Từ thư mục frontend, chuyển về thư mục gốc dự án:
code
Bash
cd ..
Thực hiện liên kết Remote và đẩy toàn bộ code vừa khởi tạo lên nhánh cá nhân:
code
Bash
# 1. Thêm link Git nhóm
git remote add origin https://github.com/Duyhoang1004/QueenKho_Self-Storage-Facility-Rental-and-Management-System.git

# 2. Tạo hoặc đổi tên nhánh local thành TrongHieu
git branch -M TrongHieu

# 3. Gom toàn bộ file và commit
git add .
git commit -m "chore: Khởi tạo cấu trúc dự án Frontend React (Tailwind v3) và Backend Spring Boot"

# 4. Đẩy code lên nhánh TrongHieu (Dùng cờ -f để đồng bộ nhánh cá nhân lần đầu)
git push -u origin TrongHieu -f
III. NGUYÊN TẮC LÀM VIỆC NHÓM (TEAMWORK GUIDELINES)
Chia tách thư mục tuyệt đối: Thành viên làm Frontend chỉ chỉnh sửa trong frontend/, thành viên Backend chỉ chỉnh sửa trong backend/. Không chạm chéo file của nhau.
Quy trình gộp code (Pull Request):
Code xong tính năng trên nhánh cá nhân (ví dụ: TrongHieu).
Lên GitHub tạo Pull Request (PR) từ TrongHieu sang main (hoặc dev).
Phải có ít nhất 1 thành viên khác review và nhấn Approve mới được gộp code.
Chống Conflict: Mỗi sáng trước khi code tính năng mới, luôn chạy:
code
Bash
git checkout TrongHieu
git pull origin main