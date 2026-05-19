$env:NODE_OPTIONS = "--experimental-vm-modules"
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "D:\Proyectos OpenCode\Factura" -PassThru -NoNewWindow
Start-Sleep -Seconds 5
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/qr-login" -TimeoutSec 5
    Write-Host "Response: $($response | ConvertTo-Json)"
} catch {
    Write-Host "Error: $_"
}
Start-Sleep -Seconds 3
Stop-Process $proc.Id -Force -ErrorAction SilentlyContinue