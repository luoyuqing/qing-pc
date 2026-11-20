$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot

foreach ($tool in @('flutter', 'git', 'cmake', 'nasm', 'nuget', 'rustup')) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing build tool: $tool"
    }
}

if ($projectRoot.Length -gt 40) {
    throw 'Use a short project path such as C:\src\qing, or map this directory to an unused drive with subst before building.'
}

flutter config --enable-windows-desktop
if ($LASTEXITCODE -ne 0) { throw 'Flutter configuration failed' }
flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'Dependency resolution failed' }
flutter test test/service_gateway_config_test.dart test/qing_desktop_shell_test.dart test/desktop_files_test.dart
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
flutter build windows --release
if ($LASTEXITCODE -ne 0) { throw 'Windows build failed' }

$releaseDirectory = Join-Path $projectRoot 'build\windows\x64\runner\Release'
$archivePath = Join-Path $projectRoot 'build\Qing-Windows-x64.zip'
Compress-Archive -Path "$releaseDirectory\*" -DestinationPath $archivePath -Force
Write-Output "Portable Windows package: $archivePath"
