# test.ps1 - Launch MS Edge with extension loaded

$ExtensionDir = $PSScriptRoot
$TempProfileDir = Join-Path $env:TEMP "EdgeExtensionTestProfile"

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
Write-Host "1. Open a webpage (e.g., https://es.wikipedia.org/wiki/Chromium )"
Write-Host "2. Hold 'Ctrl' and select some Spanish text (or set target language to English)."
Write-Host "3. Keep holding 'Ctrl' while moving the mouse over the selection."
Write-Host "4. Or visit the Extension Options page to configure parameters."

Start-Process -FilePath "msedge.exe" -ArgumentList "--user-data-dir=`"$TempProfileDir`"", "--load-extension=`"$ExtensionDir`"", "https://es.wikipedia.org/wiki/Browser_extension"
