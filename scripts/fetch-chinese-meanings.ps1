# One-time translation of the existing Chinese answer key; review output before release.
$ErrorActionPreference = 'Stop'
$rootPath = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $rootPath '.sites-runtime/chinese-meanings.txt'
$outputPath = Join-Path $rootPath '.sites-runtime/english-from-chinese.json'
$terms = @(Get-Content -LiteralPath $sourcePath -Encoding UTF8 | Select-Object -Unique)
$output = @{}
if (Test-Path -LiteralPath $outputPath) {
  $prior = Get-Content -LiteralPath $outputPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($property in $prior.PSObject.Properties) { $output[$property.Name] = $property.Value }
}
$pending = @($terms | Where-Object { -not $output.ContainsKey($_) })

function Get-TranslatedMeanings([string[]] $group) {
  $query = [uri]::EscapeDataString(($group -join "`n"))
  $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=$query"
  $response = Invoke-WebRequest -Uri $url -TimeoutSec 25
  $data = $response.Content | ConvertFrom-Json
  $translated = (($data[0] | ForEach-Object { $_[0] }) -join '') -split "`n"
  $translated = @($translated | ForEach-Object { $_.Trim() })
  if ($translated.Count -eq $group.Count -and @($translated | Where-Object { -not $_ }).Count -eq 0) {
    return $translated
  }
  if ($group.Count -eq 1) { throw "Could not parse translation for $($group[0])" }
  $middle = [int][math]::Ceiling($group.Count / 2)
  $left = @(Get-TranslatedMeanings $group[0..($middle - 1)])
  $right = @(Get-TranslatedMeanings $group[$middle..($group.Count - 1)])
  return @($left + $right)
}

for ($i = 0; $i -lt $pending.Count; $i += 10) {
  $last = [math]::Min($i + 9, $pending.Count - 1)
  $group = @($pending[$i..$last])
  try { $english = @(Get-TranslatedMeanings $group) }
  catch {
    $output | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $outputPath -Encoding UTF8
    throw
  }
  for ($j = 0; $j -lt $group.Count; $j++) { $output[$group[$j]] = $english[$j] }
  if ($i % 50 -eq 0) {
    $output | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $outputPath -Encoding UTF8
    Write-Output "$([math]::Min($i + 10, $pending.Count))/$($pending.Count)"
  }
  Start-Sleep -Milliseconds 200
}
$output | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $outputPath -Encoding UTF8
Write-Output "$($output.Count) translated meanings ready."
