# Sử dụng môi trường Java 17
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app

# Copy công cụ Maven và cấu hình
COPY .mvn/ .mvn
COPY mvnw pom.xml ./
# Tải trước thư viện về để chạy cho lẹ
RUN ./mvnw dependency:go-offline

# Copy code backend vào hộp
COPY src ./src
EXPOSE 8080

# Lệnh khởi chạy backend
CMD ["./mvnw", "spring-boot:run"]
