# Sử dụng môi trường Node 18
FROM node:18-alpine
WORKDIR /app

# Copy file cấu hình và cài đặt thư viện
COPY package*.json ./
RUN npm install

# Copy toàn bộ code frontend vào hộp
COPY . .
EXPOSE 5173

# Lệnh khởi chạy frontend
CMD ["npm", "run", "dev", "--", "--host"]
