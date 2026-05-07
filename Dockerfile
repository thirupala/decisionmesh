FROM eclipse-temurin:25-jdk

WORKDIR /app

COPY decisionmesh-bootstrap/target/quarkus-app/lib/ /app/lib/
COPY decisionmesh-bootstrap/target/quarkus-app/*.jar /app/
COPY decisionmesh-bootstrap/target/quarkus-app/app/ /app/app/
COPY decisionmesh-bootstrap/target/quarkus-app/quarkus/ /app/quarkus/

EXPOSE 8080

CMD ["java", "-jar", "/app/quarkus-run.jar"]