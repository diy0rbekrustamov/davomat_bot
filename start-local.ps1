$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$runtimeDir = Join-Path $PSScriptRoot 'local-runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$mutex = [System.Threading.Mutex]::new($false, 'Local\DavomatLocalSupervisor')
if (-not $mutex.WaitOne(0)) { Write-Host 'Davomat supervisor already running.'; exit 0 }
$cloudflared = Join-Path $env:LOCALAPPDATA 'Programs\mycomp\resources\app.asar.unpacked\runtime\cloudflared.exe'
$tunnelPidFile = Join-Path $runtimeDir 'tunnel.pid'
$tunnelLog = Join-Path $runtimeDir 'tunnel.stderr.log'
$publicEnv = Join-Path $runtimeDir 'public.env'
try {
  while ($true) {
    try {
      $tunnelProcess = $null
      if (Test-Path $tunnelPidFile) {
        $savedTunnelId = [int](Get-Content $tunnelPidFile -Raw).Trim()
        $candidate = Get-Process -Id $savedTunnelId -ErrorAction SilentlyContinue
        if ($candidate -and $candidate.ProcessName -eq 'cloudflared') { $tunnelProcess = $candidate }
      }
      if (-not $tunnelProcess) {
        $tunnelProcess = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel','--url','http://127.0.0.1:4000','--no-autoupdate','--protocol','http2') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'tunnel.stdout.log') -RedirectStandardError $tunnelLog -PassThru
        Set-Content -Path $tunnelPidFile -Value $tunnelProcess.Id
      }
      $publicUrl = $null
      for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-Path $tunnelLog) {
          $urlMatch = [regex]::Match((Get-Content $tunnelLog -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com')
          if ($urlMatch.Success) { $publicUrl = $urlMatch.Value; break }
        }
        Start-Sleep -Seconds 2
      }
      if (-not $publicUrl) { throw 'Tunnel URL not available yet. See local-runtime/tunnel.stderr.log.' }
      Set-Content -Path $publicEnv -Value "DAVOMAT_PUBLIC_URL=$publicUrl" -Encoding ascii
      & docker compose --env-file $publicEnv -p davomat-local -f docker-compose.local.yml up -d
      if ($LASTEXITCODE -ne 0) { throw 'Docker startup failed. Open Docker Desktop and try again.' }
      Write-Host "Davomat: $publicUrl"
      while (Get-Process -Id $tunnelProcess.Id -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 10 }
      Write-Host 'Tunnel stopped; reconnecting and updating bot URLs.'
    } catch {
      Write-Host "$(Get-Date -Format s) $($_.Exception.Message)"
      Start-Sleep -Seconds 15
    }
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
