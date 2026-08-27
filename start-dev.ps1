# Work Ahead — нэг даралтаар бүх системийг асаах/унтраах
# Асаах:   powershell -ExecutionPolicy Bypass -File start-dev.ps1
# Унтраах: powershell -ExecutionPolicy Bypass -File start-dev.ps1 -Stop
param([switch]$Stop)

$ErrorActionPreference = 'SilentlyContinue'
$root    = $PSScriptRoot
$pgBin   = "$env:TEMP\opencode\pgsql\bin"
$pgData  = "$env:TEMP\opencode\pgdata"

function Test-Port($port) {
  (Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue)
}

if ($Stop) {
  foreach ($port in 5173, 4000) {
    Get-NetTCPConnection -LocalPort $port -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  }
  & "$pgBin\pg_ctl.exe" -D $pgData stop
  Write-Host "Бүх сервис унтрав." -ForegroundColor Yellow
  exit
}

# 1) PostgreSQL
if (Test-Port 5432) { Write-Host "PostgreSQL      : ажиллаж байна" -ForegroundColor Gray }
else {
  Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList "-D $pgData -l $env:TEMP\opencode\pg.log start" -WindowStyle Hidden
  Start-Sleep 3
  Write-Host "PostgreSQL      : аслаа" -ForegroundColor Green
}

# 2) API сервер (:4000)
if (Test-Port 4000) { Write-Host "API (:4000)     : ажиллаж байна" -ForegroundColor Gray }
else {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c node src/index.js > %TEMP%\opencode\server.log 2>&1" -WorkingDirectory "$root\server" -WindowStyle Hidden
  Start-Sleep 2
  Write-Host "API (:4000)     : аслаа" -ForegroundColor Green
}

# 3) Vite client (:5173, утаснаас харагдамаар --host)
if (Test-Port 5173) { Write-Host "Client (:5173)  : ажиллаж байна" -ForegroundColor Gray }
else {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev -- --host > %TEMP%\opencode\vite.log 2>&1" -WorkingDirectory "$root\client" -WindowStyle Hidden
  Start-Sleep 5
  Write-Host "Client (:5173)  : аслаа" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Компьютер дээр : http://localhost:5173" -ForegroundColor Cyan
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'VMware|Loopback' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } |
  Select-Object -First 1).IPAddress
if ($ip) { Write-Host "  Утаснаас       : http://${ip}:5173 (ижил Wi-Fi дээр)" -ForegroundColor Cyan }
Write-Host ""
Write-Host "  Оюутан: student@workahead.mn / student123"
Write-Host "  Админ : admin@workahead.mn / admin123"
