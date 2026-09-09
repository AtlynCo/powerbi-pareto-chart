param(
    [string]$SampleDirectory = (Join-Path $PSScriptRoot '..\artifacts\sample'),
    [string]$EvidencePath = (Join-Path $PSScriptRoot '..\artifacts\sample-tom-preflight.json'),
    [string]$DesktopBin = "${env:ProgramFiles}\Microsoft Power BI Desktop\bin"
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$sampleRoot = (Resolve-Path -LiteralPath $SampleDirectory).Path
$modelPath = Join-Path $sampleRoot 'Atlyn Pareto.SemanticModel\model.bim'
$manifest = Get-Content -LiteralPath (Join-Path $sampleRoot 'sample-manifest.json') -Raw | ConvertFrom-Json
$assemblies = @(
    'Microsoft.AnalysisServices.Server.Core.dll',
    'Microsoft.AnalysisServices.Server.Tabular.dll',
    'Microsoft.AnalysisServices.Server.Tabular.Json.dll'
)
$assemblyEvidence = foreach ($name in $assemblies) {
    $file = Join-Path $DesktopBin $name
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Installed Desktop TOM assembly missing: $file. This command never installs or restores dependencies."
    }
    Add-Type -Path $file
    @{
        filename = $name
        version = (Get-Item -LiteralPath $file).VersionInfo.FileVersion
        sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$database = [Microsoft.AnalysisServices.Tabular.JsonSerializer]::DeserializeDatabase(
    [System.IO.File]::ReadAllText($modelPath),
    $null,
    [Microsoft.AnalysisServices.CompatibilityMode]::PowerBI
)
try {
    $expectedTables = @('Complaints', 'CustomerRevenue', 'Defects')
    $actualTables = @($database.Model.Tables | ForEach-Object { $_.Name } | Sort-Object)
    if (($actualTables -join ',') -ne ($expectedTables -join ',') -or $database.CompatibilityLevel -ne 1600) {
        throw 'Deserialized sample does not have the expected three tables and compatibility level 1600.'
    }
    $tables = @($database.Model.Tables | ForEach-Object {
        if ($_.Columns.Count -ne 3 -or $_.Measures.Count -ne 2 -or $_.Partitions.Count -ne 1) {
            throw "Unexpected deserialized members in table $($_.Name)"
        }
        if ($_.Partitions[0].Source -isnot [Microsoft.AnalysisServices.Tabular.MPartitionSource]) {
            throw "Expected an M partition in table $($_.Name)"
        }
        @{
            name = $_.Name
            columns = @($_.Columns | ForEach-Object { @{ name = $_.Name; dataType = $_.DataType.ToString() } })
            measures = @($_.Measures | ForEach-Object { $_.Name })
            partitions = $_.Partitions.Count
        }
    })
    $evidence = @{
        status = 'passed'
        checkedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        packageSha256 = $manifest.package.sha256
        modelFormat = 'TMSL model.bim; no TMDL ref-table indentation applies'
        modelSha256 = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant()
        parser = 'Microsoft.AnalysisServices.Tabular.JsonSerializer.DeserializeDatabase'
        requestedCompatibilityMode = 'PowerBI'
        databaseName = $database.Name
        compatibilityLevel = $database.CompatibilityLevel
        tables = $tables
        desktopVersion = (Get-Item -LiteralPath (Join-Path $DesktopBin 'PBIDesktop.exe')).VersionInfo.ProductVersion
        powershellVersion = $PSVersionTable.PSVersion.ToString()
        dotnetVersion = [System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
        assemblies = @($assemblyEvidence)
        boundary = 'Read-only official TOM deserialization only. No Desktop UI, server, refresh, M/DAX execution, report render, export, licensing or native-host acceptance is established.'
    }
    $output = [System.IO.Path]::GetFullPath($EvidencePath)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($output)) | Out-Null
    [System.IO.File]::WriteAllText($output, ($evidence | ConvertTo-Json -Depth 8) + "`n")
    Write-Output "TOM parsed 3 tables / 9 columns / 6 measures / 3 M partitions. Evidence: $output"
} finally {
    $database.Dispose()
}
