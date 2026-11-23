param([switch]$StopOnly, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeDir = Join-Path $projectRoot '.runtime'
$serverPath = Join-Path $PSScriptRoot 'server.mjs'
$pidPath = Join-Path $runtimeDir 'server.pid'
$port = 8788
function Get-TripFileHash([string]$Path) {
  $stream=[IO.File]::OpenRead($Path)
  $sha=[Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
  finally { $stream.Dispose(); $sha.Dispose() }
}
try {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  if (Test-Path -LiteralPath $pidPath) {
    $savedPid = [int](Get-Content -LiteralPath $pidPath)
    $ownedProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid"
    if ($ownedProcess) {
      if ($ownedProcess.Name -ne 'node.exe' -or -not $ownedProcess.CommandLine.Contains($serverPath)) { throw 'Saved PID does not belong to this Trip Rand server. No process was stopped.' }
      Stop-Process -Id $savedPid
      for ($i=0; $i -lt 50; $i++) { if (-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Milliseconds 200 }
    }
    Remove-Item -LiteralPath $pidPath -Force
  }
  if ($StopOnly) { Write-Host 'Trip Rand stopped.'; exit 0 }
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is used by another application. It was left running." }
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
  if ($nodePath) { $nodeMajor = [int]((& $nodePath --version).TrimStart('v').Split('.')[0]); if ($nodeMajor -lt 22 -or ($nodeMajor -eq 22 -and [int]((& $nodePath --version).TrimStart('v').Split('.')[1]) -lt 13)) { $nodePath=$null } }
  if (-not $nodePath) {
    $localNode = Get-ChildItem -Path $runtimeDir -Filter 'node-v22*-win-x64' -Directory | Select-Object -First 1
    if ($localNode -and (Test-Path -LiteralPath (Join-Path $localNode.FullName 'node.exe'))) { $nodePath=Join-Path $localNode.FullName 'node.exe' }
    else {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $nodeBase='https://nodejs.org/dist/latest-v22.x/'
      $sums=(Invoke-WebRequest -UseBasicParsing -Uri ($nodeBase+'SHASUMS256.txt')).Content
      $sumLine=$sums -split "`n" | Where-Object { $_ -match 'node-v22\.[0-9]+\.[0-9]+-win-x64\.zip$' } | Select-Object -First 1
      if (-not $sumLine) { throw 'Official Node.js checksum was not found.' }
      $parts=$sumLine.Trim() -split '\s+'
      $archivePath=Join-Path $runtimeDir $parts[1]
      Invoke-WebRequest -UseBasicParsing -Uri ($nodeBase+$parts[1]) -OutFile $archivePath
      if ((Get-TripFileHash $archivePath).ToLower() -ne $parts[0].ToLower()) { throw 'Node.js download checksum mismatch.' }
      Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeDir -Force
      $nodePath=Join-Path $runtimeDir ($parts[1].Replace('.zip','')+'\node.exe')
    }
  }
  & $nodePath --version
  if ($LASTEXITCODE -ne 0) { throw 'Node.js did not start.' }
  $npmPath=Join-Path (Split-Path $nodePath) 'npm.cmd'
  $lockHash=Get-TripFileHash (Join-Path $projectRoot 'package-lock.json')
  $hashFile=Join-Path $runtimeDir 'dependencies.sha256'
  Push-Location $projectRoot
  try {
    if (-not (Test-Path (Join-Path $projectRoot 'node_modules/esbuild')) -or -not (Test-Path $hashFile) -or (Get-Content $hashFile) -ne $lockHash) {
      & $npmPath ci
      if ($LASTEXITCODE -ne 0) { throw 'Dependency setup failed.' }
      Set-Content -LiteralPath $hashFile -Value $lockHash
    }
    & $nodePath (Join-Path $PSScriptRoot 'build.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }
    & $nodePath (Join-Path $PSScriptRoot 'configure-ip-memory.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'IP memory setup failed.' }
  } finally { Pop-Location }
  $outLog=Join-Path $runtimeDir 'server.log'
  $errLog=Join-Path $runtimeDir 'server-error.log'
  $serverProcess=Start-Process -FilePath $nodePath -ArgumentList @('"'+$serverPath+'"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
  $health=$null
  for($i=0;$i -lt 30;$i++) {
    try { $health=Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 10; break } catch { if($serverProcess.HasExited){throw "Server failed. See $errLog"}; Start-Sleep -Milliseconds 300 }
  }
  if (-not $health -or $health.app -ne 'trip-rand' -or $health.pid -ne $serverProcess.Id) { throw "Server readiness check failed. See $errLog" }
  if (-not $health.db.ok) { throw 'Supabase table is unavailable or empty. Server is running; run schema.sql then seed.sql in the existing DB SQL Editor. The app can display its research snapshot, but DB setup has not passed.' }
  if (-not $health.login.ok) { throw 'Independent login data API is unavailable. Run migrations/004-id-only.sql in the existing Supabase SQL Editor.' }
  Write-Host "Trip Rand ready: http://127.0.0.1:$port"
  if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$port" }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; Write-Host "Logs: $runtimeDir"; exit 1 }
