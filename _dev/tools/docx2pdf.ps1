# docx2pdf.ps1 — Word COM으로 .docx의 목차/필드를 갱신·저장하고 PDF로 내보내기
# 사용법: powershell -NoProfile -File docx2pdf.ps1 -In "D:\path\a.docx" -Out "D:\path\a.pdf"
param([Parameter(Mandatory=$true)][string]$In, [Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference = 'Stop'
$word = $null; $doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $inPath = [string](Resolve-Path $In).Path
  $doc = $word.Documents.Open($inPath, $false, $false)
  foreach ($t in $doc.TablesOfContents) { $t.Update() | Out-Null }
  $doc.Fields.Update() | Out-Null
  $doc.Save()
  $doc.ExportAsFixedFormat($Out, 17)   # 17 = wdExportFormatPDF
  $pages = $doc.ComputeStatistics(2)    # 2 = wdStatisticPages
  Write-Output ("PDF OK: " + $Out + " pages=" + $pages)
} finally {
  if ($doc) { $doc.Close(0) }
  if ($word) { $word.Quit() }
}
