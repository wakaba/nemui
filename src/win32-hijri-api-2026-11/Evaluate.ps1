# WinRT Calendar (Windows.Globalization.Calendar) evaluator for the Hijri calendars.
#
# usage:
#   .\Evaluate.ps1 -Mode probe                              ... print supported ranges and G(2026-11-17) for both calendars
#   .\Evaluate.ps1 -Mode golden                             ... G 2026-11-17 -> 1448-06-07 / anchor H 1-01-01 -> G 622-07-18 (exit 0 on match)
#   .\Evaluate.ps1 -Mode g2h  -Variant hijri|uaq -OutFile F  ... G -> H, full domain (G 1601-01-01..G 9999-12-31)
#   .\Evaluate.ps1 -Mode h2g  -Variant hijri|uaq -OutFile F  ... H -> G, full domain (H 0001-01-01..H 9666-04-03)
#
# CalendarIdentifiers:
#   hijri = Hijri     (Hijri calendar)
#   uaq   = UmAlQura  (Umm al-Qura calendar)
#
# Output lines: g2h: "<g>,<m>,<d>\t<h>,<m>,<d>"   h2g: "<h>,<m>,<d>\t<g>,<m>,<d>"
#   Lines where the API throws an exception are printed as "<tuple>\t!<exception-type-name>"
#
# Requires Windows PowerShell 5.1 (WinRT interop built in). NOT compatible with pwsh (PowerShell 7).

param(
  [Parameter(Mandatory=$true)][ValidateSet('probe','golden','g2h','h2g')][string]$Mode,
  [string]$Variant = '',
  [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'

function New-Cal([string]$Id) {
  $cal = [Windows.Globalization.Calendar,Windows,ContentType=WindowsRuntime]::new()
  $cal.ChangeCalendarSystem($Id)
  return $cal
}

function Get-VariantId([string]$v) {
  switch ($v) {
    'hijri' { return 'HijriCalendar' }      # exact WinRT identifier ("CalendarIdentifiers.Hijri" = "HijriCalendar")
    'uaq'   { return 'UmAlQuraCalendar' }   # exact WinRT identifier ("CalendarIdentifiers.UmAlQura" = "UmAlQuraCalendar")
    default { throw "Variant must be hijri or uaq (got: $v)" }
  }
}

if ($Mode -eq 'probe') {
  foreach ($v in @('hijri','uaq')) {
    $id = Get-VariantId $v
    $cal = New-Cal $id
    $cal.SetToMin()
    $min = "$($cal.Year)-$($cal.Month)-$($cal.Day)"
    $cal.SetToMax()
    $max = "$($cal.Year)-$($cal.Month)-$($cal.Day)"
    $cal.SetDateTime([datetime]::new(2026,11,17))
    $now = "$($cal.Year)-$($cal.Month)-$($cal.Day)"
    Write-Host ("{0}: min={1} max={2} G(2026-11-17)=H {3}" -f $v, $min, $max, $now)
  }
  exit 0
}

if ($Mode -eq 'golden') {
  $cal = New-Cal (Get-VariantId 'hijri')
  $cal.SetDateTime([datetime]::new(2026,11,17))
  $ok1 = ($cal.Year -eq 1448) -and ($cal.Month -eq 6) -and ($cal.Day -eq 7)
  $cal.SetDateTime([datetime]::new(622,7,18))
  $ok2 = ($cal.Year -eq 1) -and ($cal.Month -eq 1) -and ($cal.Day -eq 1)
  Write-Host ("golden [hijri]: G(2026-11-17) -> H {0}-{1}-{2} (expect 1448-6-7) / anchor H 1-01-01 -> G 622-07-18: {3}" -f $cal.Year, $cal.Month, $cal.Day, $ok2)
  $calUaq = New-Cal (Get-VariantId 'uaq')
  $calUaq.SetDateTime([datetime]::new(2026,11,17))
  Write-Host ("golden [uaq]:   G(2026-11-17) -> H {0}-{1}-{2}" -f $calUaq.Year, $calUaq.Month, $calUaq.Day)
  if ($ok1 -and $ok2) { exit 0 } else { exit 2 }
}

if ($Variant -eq '') { throw '-Variant hijri|uaq is required' }
if ($OutFile -eq '') { throw '-OutFile is required' }
$id = Get-VariantId $Variant
$cal = New-Cal $id

if ($Mode -eq 'g2h') {
  # Stream results to disk so a mid-run failure still yields a (partial) file with a !FATAL trailer.
  $fs = [System.IO.File]::Open($OutFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  $sw = New-Object System.IO.StreamWriter($fs, (New-Object System.Text.UTF8Encoding($false)))
  $g = [datetime]::new(1601,1,1)
  $end = [datetime]::new(9999,12,31)
  $i = 0
  try {
    while ($g -le $end) {
      $err = $null
      try {
        $cal.SetDateTime($g)
      } catch {
        $err = ($_.Exception.GetType().Name)
        try {
          # Fallback: explicit Windows.Foundation.DateTime wrapper (some hosts refuse plain [datetime])
          $wfdt = [Windows.Foundation.DateTime,Windows,ContentType=WindowsRuntime]::new($g.Ticks)
          $cal.SetDateTime($wfdt)
          $err = $null
        } catch { }
      }
      if ($err -eq $null) {
        $sw.WriteLine("$($g.Year),$($g.Month),$($g.Day)`t$($cal.Year),$($cal.Month),$($cal.Day)")
      } else {
        $sw.WriteLine("$($g.Year),$($g.Month),$($g.Day)`t!$err")
      }
      $g = $g.AddDays(1)
      $i++
      if ($i % 250000 -eq 0) { Write-Host "[g2h] wrote $i rows (now at $($g.Year)-$($g.Month)-$($g.Day))" }
    }
    $sw.Close()
    exit 0
  } catch {
    Write-Host "[g2h] FATAL: $($_.Exception.GetType().FullName): $($_.Exception.Message)"
    $sw.WriteLine("!FATAL`t$($_.Exception.GetType().FullName): $($_.Exception.Message)")
    $sw.Close()
    exit 1
  }
}

if ($Mode -eq 'h2g') {
  $fs = [System.IO.File]::Open($OutFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  $sw = New-Object System.IO.StreamWriter($fs, (New-Object System.Text.UTF8Encoding($false)))
  $i = 0
  try {
    for ($y = 1; $y -le 9666; $y++) {
      for ($m = 1; $m -le 12; $m++) {
        for ($d = 1; $d -le 32; $d++) {
          try {
            $cal.Year = [uint32]$y
            $cal.Month = [uint32]$m
            $cal.Day = [uint32]$d
            $dt = $cal.GetDateTime().DateTime
            $sw.WriteLine("$y,$m,$d`t$($dt.Year),$($dt.Month),$($dt.Day)")
          } catch {
            $err = ($_.Exception.GetType().Name); $sw.WriteLine("$y,$m,$d`t!$err")
          }
          $i++
        }
      }
      if ($y % 500 -eq 0) { Write-Host "[h2g] wrote $i rows (H $y done)" }
    }
    $sw.Close()
    exit 0
  } catch {
    Write-Host "[h2g] FATAL: $($_.Exception.GetType().FullName): $($_.Exception.Message)"
    $sw.WriteLine("!FATAL`t$($_.Exception.GetType().FullName): $($_.Exception.Message)")
    $sw.Close()
    exit 1
  }
}
