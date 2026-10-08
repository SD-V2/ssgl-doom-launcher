$ErrorActionPreference = 'Stop'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Fail($msg) { Write-Host "`nSTOPPED: $msg" -ForegroundColor Red; exit 1 }
function Run($label) { if ($LASTEXITCODE -ne 0) { Fail "$label failed (see the messages above)." } }

Write-Host "=== Build your SSGL fork ===`n"
$user = (Read-Host "Your GitHub username (just press Enter for SD-V2)").Trim()
if (-not $user) { $user = "SD-V2" }

# 1) Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "`nNode.js is not installed. Installing it now (a Windows prompt may ask permission)..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Write-Host "`nNode.js installed. Please CLOSE this window and double-click Build-SSGL.cmd again." -ForegroundColor Yellow
    exit 0
}

# 2) Download your fork
# the commit GitHub writes into the comment of the zip it makes ('' if it is not there)
function Get-ZipCommit($path) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $last = [Math]::Max(0, $bytes.Length - 65557)
        for ($i = $bytes.Length - 22; $i -ge $last; $i--) {
            if ($bytes[$i] -eq 0x50 -and $bytes[$i + 1] -eq 0x4B -and $bytes[$i + 2] -eq 0x05 -and $bytes[$i + 3] -eq 0x06) {
                $len = $bytes[$i + 20] + 256 * $bytes[$i + 21]
                if ($len -gt 0 -and ($i + 22 + $len) -le $bytes.Length) {
                    $text = [System.Text.Encoding]::ASCII.GetString($bytes, $i + 22, $len).Trim()
                    if ($text -match '^[0-9a-f]{40}$') { return $text }
                }
                return ''
            }
        }
    } catch { }
    return ''
}

$work = Join-Path $env:USERPROFILE 'ssgl-build'
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Path $work | Out-Null
$zip = Join-Path $work 'fork.zip'
Write-Host "`nDownloading your fork..."
try { Invoke-WebRequest "https://github.com/$user/ssgl-doom-launcher/archive/HEAD.zip" -OutFile $zip -UseBasicParsing }
catch { Fail "Could not download github.com/$user/ssgl-doom-launcher. Check the username, and that the fork is public." }
# Which upload is this? GitHub writes it into the zip. The program remembers it, so it
# can tell you later when newer files were uploaded to your fork.
$sha = Get-ZipCommit $zip
if (-not $sha) {
    try {
        $answer = Invoke-RestMethod -UseBasicParsing -Headers @{ Accept = 'application/vnd.github.sha'; 'User-Agent' = 'ssgl-build' } -Uri "https://api.github.com/repos/$user/ssgl-doom-launcher/commits/HEAD"
        if ("$answer".Trim() -match '^[0-9a-f]{40}$') { $sha = "$answer".Trim() }
    } catch { $sha = '' }
}
if ($sha) { Write-Host "Built from upload $($sha.Substring(0, 7)) of your fork." }
else { Write-Host "Could not find out which upload this is (the update notice will stay quiet)." }
Expand-Archive -LiteralPath $zip -DestinationPath $work
$app = Join-Path (Get-ChildItem $work -Directory | Select-Object -First 1).FullName 'app'
if (-not (Test-Path (Join-Path $app 'electron\handlers\mods.js'))) {
    Fail "Your fork doesn't contain the new file app\electron\handlers\mods.js yet. Do step 1 (upload to GitHub) first."
}

# 3) Build
Set-Location $app
$env:NODE_OPTIONS = '--openssl-legacy-provider'
$env:GITHUB_SHA = $sha   # becomes the "built from" mark inside the program
Write-Host "`nInstalling parts (takes a few minutes)..."
& npx.cmd --yes yarn@1.22.22 install --ignore-engines; Run "Install"
Write-Host "`nBuilding SSGL..."
& npx.cmd yarn clean; & npx.cmd yarn build; Run "Build"
Write-Host "`nPackaging the program..."
& npx.cmd electron-builder build --win dir --publish never; Run "Packaging"

$out = Join-Path $app 'dist\win-unpacked'
if (-not (Test-Path (Join-Path $out 'SSGL.exe'))) { Fail "Packaging finished but SSGL.exe was not found in $out" }

# 4) Put the finished program somewhere permanent
$final = Join-Path $env:USERPROFILE 'SSGL-fork'
if (Test-Path $final) { Remove-Item -Recurse -Force $final }
Copy-Item -Recurse $out $final
Write-Host "`nDONE! Your program is in: $final" -ForegroundColor Green
Write-Host "Double-click SSGL.exe in that folder. (Right-click it > Send to > Desktop to make a shortcut.)"
Start-Process explorer.exe $final
