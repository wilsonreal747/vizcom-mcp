$ErrorActionPreference = 'Stop'
$env:VIZCOM_SESSION_SOURCE = 'edge'
node --use-system-ca (Join-Path $PSScriptRoot 'src\server.mjs')
exit $LASTEXITCODE
