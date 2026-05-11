# scripts\set-vault-env.ps1

# Always read fresh token from container logs (OpenBao v2 ignores VAULT_DEV_ROOT_TOKEN_ID)
$global:VAULT_TOKEN = (docker logs decisionmesh-openbao-1 2>&1 |
    Select-String "Root Token:" |
    ForEach-Object { ($_ -replace ".*Root Token:\s*", "").Trim() } |
    Select-Object -Last 1)

$global:BASE = "http://localhost:8200/v1/secret/data/decisionmesh"
$global:H = @{ "X-Vault-Token" = $global:VAULT_TOKEN; "Content-Type" = "application/json" }
$env:VAULT_TOKEN = $global:VAULT_TOKEN

Write-Host "Vault token: $global:VAULT_TOKEN"
Write-Host "Vault env ready."