param(
    [Parameter(Mandatory)][string]$Workbook,
    [Parameter(Mandatory)][string]$OutputSql
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-WorkbookXml($Archive, [string]$EntryName) {
    $entry = $Archive.GetEntry($EntryName)
    if (-not $entry) { throw "Missing workbook part: $EntryName" }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-CellText($Row, [string]$Column, $SharedStrings) {
    $cell = $Row.SelectSingleNode("./x:c[@r='$Column$($Row.r)']", $worksheetNs)
    if (-not $cell) { return '' }
    if ($cell.t -eq 's') { return $SharedStrings[[int]$cell.v] }
    if ($cell.t -eq 'inlineStr') { return $cell.SelectSingleNode('./x:is', $worksheetNs).InnerText }
    return [string]$cell.v
}

function ConvertTo-SqlText([string]$Value) {
    $hex = [Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($Value))
    return "convert_from(decode('$hex', 'hex'), 'UTF8')"
}

$entries = [Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
$missingEmail = 0
$missingName = 0
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Workbook).ProviderPath)
try {
    $sharedStrings = @()
    if ($archive.GetEntry('xl/sharedStrings.xml')) {
        $strings = Read-WorkbookXml $archive 'xl/sharedStrings.xml'
        $sharedStrings = @($strings.SelectNodes('//*[local-name()="si"]') | ForEach-Object {
            ($_.SelectNodes('.//*[local-name()="t" and not(ancestor::*[local-name()="rPh"])]') |
                ForEach-Object InnerText) -join ''
        })
    }
    $sheet = Read-WorkbookXml $archive 'xl/worksheets/sheet1.xml'
    $worksheetNs = [Xml.XmlNamespaceManager]::new($sheet.NameTable)
    $worksheetNs.AddNamespace('x', $sheet.DocumentElement.NamespaceURI)
    $rows = @($sheet.SelectNodes('/x:worksheet/x:sheetData/x:row', $worksheetNs))
    if ((Get-CellText $rows[0] 'D' $sharedStrings) -ne 'เมลอาจารย์') {
        throw 'Unexpected workbook layout. Expected the lecturer email header in D1.'
    }
    foreach ($row in ($rows | Select-Object -Skip 1)) {
        $name = (Get-CellText $row 'B' $sharedStrings).Trim()
        if (-not $name) { $name = (Get-CellText $row 'C' $sharedStrings).Trim() }
        $field = (Get-CellText $row 'D' $sharedStrings).Trim()
        if (-not $name -and -not $field) { continue }
        $emails = [regex]::Matches($field, '(?i)[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,}')
        if (-not $emails.Count) { $missingEmail++; continue }
        if (-not $name) { $missingName++ }
        foreach ($match in $emails) {
            $email = $match.Value.ToLowerInvariant()
            $displayName = if ($name) { $name } else { $email }
            if ($entries.ContainsKey($email) -and $entries[$email] -ne $displayName) {
                throw "Conflicting names for a repeated email in row $($row.r)"
            }
            $entries[$email] = $displayName
        }
    }
} finally {
    $archive.Dispose()
}

if (-not $entries.Count) { throw 'No lecturer emails found.' }
$values = foreach ($email in ($entries.Keys | Sort-Object)) {
    '  ({0}, {1})' -f (ConvertTo-SqlText $email), (ConvertTo-SqlText $entries[$email])
}
$sql = @"
begin;
-- Serialize the existing-account check with registration.
lock table auth.users in share mode;
with input(email, full_name) as (values
$($values -join ",`n")
), new_registrations as (
  select i.* from input i
  where not exists (select 1 from auth.users u where lower(btrim(u.email)) = i.email)
), inserted as (
  insert into public.preassigned_user_roles (email, full_name, role_code)
  select email, full_name, 'TEACHER' from new_registrations
  on conflict (email) do nothing
  returning id
)
select (select count(*) from input) as input_count,
       (select count(*) from input) - (select count(*) from new_registrations) as existing_accounts,
       (select count(*) from inserted) as added,
       (select count(*) from new_registrations) - (select count(*) from inserted) as already_preassigned;
commit;
"@
$outputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputSql)
if (-not $outputPath.EndsWith('.sql', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'OutputSql must point to a new .sql file.'
}
$stream = [IO.File]::Open($outputPath, [IO.FileMode]::CreateNew)
$writer = [IO.StreamWriter]::new($stream)
try { $writer.WriteLine($sql) } finally { $writer.Dispose() }
[pscustomobject]@{ UniqueEmails = $entries.Count; RowsWithoutEmail = $missingEmail; RowsWithoutName = $missingName; SqlFile = $outputPath }
