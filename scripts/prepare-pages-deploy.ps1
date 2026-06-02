$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist-pages"

New-Item -ItemType Directory -Path $dist -Force | Out-Null

$files = @(
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
  "privacy.html",
  "terms.html"
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $dist $file) -Force
}

Write-Host "Prepared Cloudflare Pages assets at $dist"
Write-Host "Deploy with: wrangler pages deploy dist-pages --project-name otterfit --functions-directory functions"
