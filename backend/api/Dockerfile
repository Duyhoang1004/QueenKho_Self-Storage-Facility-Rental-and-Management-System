FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY .mvn/ .mvn
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
RUN ./mvnw -B -ntp dependency:go-offline
COPY src ./src
# Package the runtime independently of tests (run the test suite separately).
RUN ./mvnw -B -ntp package -Dmaven.test.skip=true

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
ENV TZ=Asia/Ho_Chi_Minh
RUN apk add --no-cache tzdata \
    && addgroup -S app && adduser -S app -G app \
    && mkdir uploads && chown app:app uploads
COPY --from=build /app/target/api-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/api/v1/facilities || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
