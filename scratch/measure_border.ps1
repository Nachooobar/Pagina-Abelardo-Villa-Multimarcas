Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap('c:\Work\ASTRO WEB\PROYECTOS\Pagina Abelardo Villa Multimarcas\public\images\logo-abelardo-banner.png')

$topThick = 0
for ($y=0; $y -lt 30; $y++) {
    $c = $bmp.GetPixel(500, $y)
    if ($c.B -gt 160) { $topThick++ } else { break }
}

$botThick = 0
for ($y=$bmp.Height-1; $y -ge $bmp.Height-30; $y--) {
    $c = $bmp.GetPixel(500, $y)
    if ($c.B -gt 160) { $botThick++ } else { break }
}

$leftThick = 0
for ($x=0; $x -lt 30; $x++) {
    $c = $bmp.GetPixel($x, 100)
    if ($c.B -gt 160) { $leftThick++ } else { break }
}

$rightThick = 0
for ($x=$bmp.Width-1; $x -ge $bmp.Width-30; $x--) {
    $c = $bmp.GetPixel($x, 100)
    if ($c.B -gt 160) { $rightThick++ } else { break }
}

Write-Host "Border thickness: Top=$topThick, Bottom=$botThick, Left=$leftThick, Right=$rightThick"
$bmp.Dispose()
