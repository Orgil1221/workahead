# Work Ahead — нэг даралтаар бүх системийг асаах/унтраах
# Асаах:   powershell -ExecutionPolicy Bypass -File start-dev.ps1
# Унтраах: powershell -ExecutionPolicy Bypass -File start-dev.ps1 -Stop
param([switch]$Stop)

# UTF-8 консоль (Монгол үсэг ??? болохоос сэргийлэх)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try { chcp 65001 | Out-Null } catch {}

$ErrorActionPreference = 'Continue'
$root   = $PSScriptRoot
$pgBin  = "$env:TEMP\opencode\pgsql\bin"
$pgData = "$env:TEMP\opencode\pgdata"
$logDir = "$env:TEMP\opencode"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Port {
  param([int]$port)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $ar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    $ok = $ar.AsyncWaitHandle.WaitOne(400)
    if (-not $ok) { $client.Close(); return $false }
    $client.EndConnect($ar)
    $connected = $client.Connected
    $client.Close()
    return $connected
  } catch { return $false }
}

function Wait-Port {
  param([int]$port, [int]$timeoutSec = 15)
  for ($i = 0; $i -lt $timeoutSec * 2; $i++) {
    if (Test-Port $port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Stop-Port {
  param([int]$port)
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $conns) { return $false }
  $killed = $false
  foreach ($c in $conns) {
    try {
      $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "  :$port PID $($proc.Id) ($($proc.ProcessName)) зогсоож байна..." -ForegroundColor DarkYellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        $killed = $true
      }
    } catch {}
  }
  Start-Sleep -Milliseconds 800
  # дахин шалгах — үлдсэн бол дахин оролдох
  $remain = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($remain) { Start-Sleep -Milliseconds 500 }
  return $killed
}

if ($Stop) {
  Write-Host "Унтрааж байна..." -ForegroundColor Yellow
  $did = $false
  if (Stop-Port 5173) { Write-Host "Client (:5173)  : зогслоо" -ForegroundColor Yellow; $did = $true } else { Write-Host "Client (:5173)  : аль хэдийн зогссон" -ForegroundColor Gray }
  if (Stop-Port 4000) { Write-Host "API (:4000)     : зогслоо" -ForegroundColor Yellow; $did = $true } else { Write-Host "API (:4000)     : аль хэдийн зогссон" -ForegroundColor Gray }

  # PostgreSQL зогсоох
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"
  if (Test-Path $pgCtl) {
    if (Test-Port 5432) {
      Write-Host "PostgreSQL      : зогсоож байна..." -ForegroundColor DarkYellow
      & $pgCtl -D $pgData stop -m fast 2>&1 | Out-Null
      Start-Sleep 2
      if (-not (Test-Port 5432)) { Write-Host "PostgreSQL      : зогслоо" -ForegroundColor Yellow }
      else { Write-Host "PostgreSQL      : зогсоож чадсангүй (log: $logDir\pg.log)" -ForegroundColor Red }
    } else {
      Write-Host "PostgreSQL      : аль хэдийн зогссон" -ForegroundColor Gray
    }
  } else {
    Write-Host "PostgreSQL      : pg_ctl олдсонгүй ($pgCtl)" -ForegroundColor Red
  }
  Write-Host "Бүх сервис унтав." -ForegroundColor Yellow
  exit
}

# ---- АСААХ ----

# 1) PostgreSQL
if (Test-Port 5432) {
  Write-Host "PostgreSQL      : ажиллаж байна (:5432)" -ForegroundColor Gray
} else {
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"
  if (-not (Test-Path $pgCtl)) {
    Write-Host "PostgreSQL      : pg_ctl олдсонгүй: $pgCtl" -ForegroundColor Red
    Write-Host "  -> PostgreSQL суулгаагүй эсвэл TEMP цэвэрлэгдсэн. server/.env DATABASE_URL шалгана уу." -ForegroundColor Red
  } elseif (-not (Test-Path $pgData)) {
    Write-Host "PostgreSQL      : pgdata олдсонгүй: $pgData" -ForegroundColor Red
    Write-Host "  -> initdb хийх шаардлагатай." -ForegroundColor Red
  } else {
    Write-Host "PostgreSQL      : асааж байна..." -ForegroundColor DarkCyan
    $pgLog = Join-Path $logDir "pg.log"
    Start-Process -FilePath $pgCtl -ArgumentList "-D `"$pgData`" -l `"$pgLog`" start" -WindowStyle Hidden
    if (Wait-Port 5432 12) { Write-Host "PostgreSQL      : аслаа (:5432)" -ForegroundColor Green }
    else {
      Write-Host "PostgreSQL      : ассангүй (log: $pgLog)" -ForegroundColor Red
      Get-Content $pgLog -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  pg: $_" -ForegroundColor DarkGray }
    }
  }
}

# 2) API сервер (:4000)
if (Test-Port 4000) {
  Write-Host "API (:4000)     : ажиллаж байна" -ForegroundColor Gray
} else {
  if (-not (Test-Path "$root\server\src\index.js")) { Write-Host "API (:4000)     : server/src/index.js олдсонгүй" -ForegroundColor Red }
  elseif (-not (Test-Path "$root\server\node_modules")) { Write-Host "API (:4000)     : node_modules байхгүй — server/ дотор 'npm install' хийнэ үү" -ForegroundColor Red }
  else {
    Write-Host "API (:4000)     : асааж байна..." -ForegroundColor DarkCyan
    $srvLog = Join-Path $logDir "server.log"
    # log-ийг шинэ эхлэлд тэмдэглэх
    Add-Content $srvLog "`n--- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') start server ---" -ErrorAction SilentlyContinue
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c node src/index.js >> `"$srvLog`" 2>&1" -WorkingDirectory "$root\server" -WindowStyle Hidden
    if (Wait-Port 4000 12) {
      Write-Host "API (:4000)     : аслаа" -ForegroundColor Green
      # health check нэмэлт
      try {
        $h = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($h.StatusCode -ne 200) { Write-Host "  анхааруулга: /api/health хариу өгсөнгүй" -ForegroundColor Yellow }
      } catch {}
    } else {
      Write-Host "API (:4000)     : ассангүй (log: $srvLog)" -ForegroundColor Red
      Get-Content $srvLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  srv: $_" -ForegroundColor DarkGray }
    }
  }
}

# 3) Vite client (:5173, утаснаас харагдамаар --host)
if (Test-Port 5173) {
  Write-Host "Client (:5173)  : ажиллаж байна" -ForegroundColor Gray
} else {
  if (-not (Test-Path "$root\client\package.json")) { Write-Host "Client (:5173)  : client/package.json олдсонгүй" -ForegroundColor Red }
  elseif (-not (Test-Path "$root\client\node_modules")) { Write-Host "Client (:5173)  : node_modules байхгүй — client/ дотор 'npm install' хийнэ үү" -ForegroundColor Red }
  else {
    Write-Host "Client (:5173)  : асааж байна..." -ForegroundColor DarkCyan
    $viteLog = Join-Path $logDir "vite.log"
    Add-Content $viteLog "`n--- $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') start vite ---" -ErrorAction SilentlyContinue
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev -- --host >> `"$viteLog`" 2>&1" -WorkingDirectory "$root\client" -WindowStyle Hidden
    if (Wait-Port 5173 20) { Write-Host "Client (:5173)  : аслаа" -ForegroundColor Green }
    else {
      Write-Host "Client (:5173)  : ассангүй (log: $viteLog)" -ForegroundColor Red
      Get-Content $viteLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  vite: $_" -ForegroundColor DarkGray }
    }
  }
}

Write-Host ""
Write-Host "  Компьютер дээр : http://localhost:5173" -ForegroundColor Cyan
# IP олох — Gateway-тай Wi-Fi/Ethernet-ийг илүүд үзэх
$ip = $null
try {
  $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1
  if ($cfg -and $cfg.IPv4Address) { $ip = $cfg.IPv4Address.IPAddress }
} catch {}
if (-not $ip) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch 'VMware|Loopback|vEthernet|WSL|VirtualBox|Hyper-V' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } |
    Select-Object -First 1).IPAddress
}
if ($ip) { Write-Host "  Утаснаас       : http://${ip}:5173 (ижил Wi-Fi дээр)" -ForegroundColor Cyan }
else { Write-Host "  Утаснаас       : IP олдсонгүй — Wi-Fi холболтоо шалгана уу" -ForegroundColor Yellow }
Write-Host ""
Write-Host "  Оюутан: student@workahead.mn / student123" -ForegroundColor Gray
Write-Host "  Админ : admin@workahead.mn / admin123" -ForegroundColor Gray
Write-Host ""
Write-Host "  Лог: $logDir\pg.log, server.log, vite.log" -ForegroundColor DarkGray
