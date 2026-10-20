$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  $ffmpegDirectory = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Directory -Filter 'Gyan.FFmpeg*' | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Filter ffmpeg.exe -File -Recurse } | Select-Object -First 1 -ExpandProperty DirectoryName
  if ($ffmpegDirectory) { $env:Path = "$ffmpegDirectory;$env:Path" }
}
npx --yes hyperframes@0.8.179 render --output renders/crear-un-proyecto.mp4 --quality looks --fps 30 --workers 4
if ($LASTEXITCODE -ne 0) { throw 'El render no se completó.' }
