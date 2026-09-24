param(
    [string]$SampleDirectory = (Join-Path $PSScriptRoot '..\artifacts\sample'),
    [string]$EvidencePath = (Join-Path $PSScriptRoot '..\artifacts\sample-tmdl-structural.json')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sampleRoot = (Resolve-Path -LiteralPath $SampleDirectory).Path
$modelRoot = Join-Path $sampleRoot 'Atlyn Pareto.SemanticModel'
$definitionRoot = Join-Path $modelRoot 'definition'
$tablesRoot = Join-Path $definitionRoot 'tables'
$manifest = Get-Content -LiteralPath (Join-Path $sampleRoot 'sample-manifest.json') -Raw | ConvertFrom-Json

if (Test-Path -LiteralPath (Join-Path $modelRoot 'model.bim')) {
    throw 'Legacy model.bim must not coexist with the Desktop-ready TMDL semantic model.'
}

$database = Get-Content -LiteralPath (Join-Path $definitionRoot 'database.tmdl') -Raw
if ($database -notmatch '(?m)^\s*compatibilityLevel:\s*1601\s*$' -or $database -notmatch '(?m)^database\s*$') {
    throw 'TMDL database must be anonymous and declare compatibility level 1601.'
}

$model = Get-Content -LiteralPath (Join-Path $definitionRoot 'model.tmdl') -Raw
if ($model -notmatch '(?m)^\s*model Model\s*$' -or $model -match 'PBI_QueryOrder') {
    throw 'TMDL model metadata must omit the unsupported PBI_QueryOrder annotation.'
}
foreach ($tableName in @('Defects', 'Complaints', 'CustomerRevenue')) {
    if ($model -notmatch "(?m)^ref table $tableName\s*$") {
        throw "TMDL model reference missing for $tableName."
    }
}
if ($model -match '(?m)^[ \t]+ref table ') {
    throw 'TMDL model table references must be root-level.'
}

$expected = @{
    Defects = @{ columns = @('Category', 'DefectCount', 'ReworkMinutes'); measures = @('Total defects', 'Total rework minutes') }
    Complaints = @{ columns = @('Category', 'ComplaintCostUSD', 'ComplaintCount'); measures = @('Total complaint cost', 'Total complaints') }
    CustomerRevenue = @{ columns = @('Category', 'RevenueUSD', 'InvoiceCount'); measures = @('Total customer revenue', 'Total invoices') }
}

$tables = foreach ($tableName in $expected.Keys) {
    $tablePath = Join-Path $tablesRoot "$tableName.tmdl"
    $content = Get-Content -LiteralPath $tablePath -Raw
    if ($content -match '(?m)^\s+description:') { throw "Unsupported TMDL description property found in $tableName." }
    if ($content -notmatch "(?m)^\s*table $tableName\s*$") { throw "TMDL table header missing for $tableName." }
    if ($content -notmatch "(?m)^\s*partition $tableName = m\s*$" -or
        $content -notmatch "(?m)^\s*mode: import\s*$" -or
        $content -notmatch '#table\(') { throw "Embedded Import M partition missing for $tableName." }
    if ($tableName -eq 'CustomerRevenue' -and
        ($content -notmatch 'type table \[Category = text, RevenueUSD = Currency\.Type, InvoiceCount = Int64\.Type\]' -or
         $content -notmatch '(?s)\bin\s+Source\s*```' -or
         $content -match 'Table\.TransformColumnTypes\s*\(\s*Source')) {
        throw 'CustomerRevenue must use a self-contained typed #table source without a cyclic transform.'
    }
    if ($content -match '(?:File|Web|Sql)\.Contents|https?:|[A-Z]:\\') {
        throw "External data source found in $tableName."
    }
    foreach ($column in $expected[$tableName].columns) {
        if ($content -notmatch "(?m)^\s*column $column\s*$") { throw "Column $column missing from $tableName." }
    }
    foreach ($measure in $expected[$tableName].measures) {
        if ($content -notmatch "(?m)^\s*measure '$([regex]::Escape($measure))' =") { throw "Measure $measure missing from $tableName." }
    }
    @{
        name = $tableName
        columns = $expected[$tableName].columns
        measures = $expected[$tableName].measures
        partitions = 1
        source = 'embedded #table M'
    }
}

$evidence = @{
    status = 'passed'
    checkedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
    packageSha256 = $manifest.package.sha256
    method = 'Regex/text structural validation only (no TOM parser). See "npm run sample:tom" for a real Microsoft TOM TmdlSerializer parse.'
    modelFormat = 'TMDL definition folder'
    compatibilityLevel = 1601
    tables = $tables
    boundary = 'Read-only TMDL structural validation only. It does not establish native Desktop open, refresh, render, export or host acceptance, and it is not a substitute for a real TOM parse.'
}
$output = [System.IO.Path]::GetFullPath($EvidencePath)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($output)) | Out-Null
[System.IO.File]::WriteAllText($output, ($evidence | ConvertTo-Json -Depth 8) + "`n")
Write-Output "TMDL structural validation (regex/text only, not a TOM parse) passed for 3 tables / 9 columns / 6 measures / 3 embedded M partitions. Evidence: $output"
