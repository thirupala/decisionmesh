# scripts\start-local.ps1

Write-Host "Starting Docker..." -ForegroundColor Cyan
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env up -d

Write-Host "Waiting for OpenBao..." -ForegroundColor Cyan
Start-Sleep 5

Write-Host "Seeding secrets..." -ForegroundColor Cyan
. .\scripts\set-valut-env.ps1
.\scripts\init-openbao.ps1

Write-Host "Building..." -ForegroundColor Cyan
mvn clean install -DskipTests

Write-Host "Starting Quarkus..." -ForegroundColor Cyan
$env:MAVEN_OPTS = "--add-opens java.base/java.lang=ALL-UNNAMED"
mvn quarkus:dev -pl decisionmesh-bootstrap