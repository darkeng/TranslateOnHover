# test.ps1 - Launch MS Edge with extension loaded

$ExtensionDir = Join-Path $PSScriptRoot "dist"
$TempProfileDir = Join-Path $env:TEMP "EdgeExtensionTestProfile"

if (-not (Test-Path $ExtensionDir)) {
    Write-Host "Error: Compiled Extension ('dist' folder) not found!" -ForegroundColor Red
    Write-Host "Please run 'npm run build' first to compile the extension." -ForegroundColor Yellow
    exit 1
}

if (Test-Path $TempProfileDir) {
    try {
        Remove-Item -Path $TempProfileDir -Recurse -Force -ErrorAction SilentlyContinue
    } catch {}
}
New-Item -ItemType Directory -Path $TempProfileDir -Force | Out-Null

Write-Host "============================"
Write-Host " Translate On Hover Testing "
Write-Host "============================"
Write-Host "Launching Microsoft Edge with isolated profile..."
Write-Host "`nInstructions:"
Write-Host "1. Open an English webpage (e.g., loaded automatically)"
Write-Host "2. Hold 'Ctrl' and move the mouse over English text to translate it to Spanish."
Write-Host "3. Or visit the Extension Options page to configure custom parameters."

Start-Process -FilePath "msedge.exe" -ArgumentList "--user-data-dir=`"$TempProfileDir`"", "--load-extension=`"$ExtensionDir`"", "https://en.wikipedia.org/wiki/Browser_extension"
