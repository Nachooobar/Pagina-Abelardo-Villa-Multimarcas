Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\nahue\.gemini\antigravity-ide\brain\a190e7d7-ebd4-45cb-9baa-325e446d4ae0\.user_uploaded\media_1790084160132.png'
$bmp = New-Object System.Drawing.Bitmap($imgPath)
Write-Host "--- LEFT EDGE (X=0 to 45) ---"
for ($x = 0; $x -lt 45; $x += 2) {
    $c = $bmp.GetPixel($x, 100)
    Write-Host "X=$x : R=$($c.R) G=$($c.G) B=$($c.B)"
}
Write-Host "--- TOP EDGE (Y=0 to 45 at X=500) ---"
for ($y = 0; $y -lt 45; $y += 2) {
    $c = $bmp.GetPixel(500, $y)
    Write-Host "Y=$y : R=$($c.R) G=$($c.G) B=$($c.B)"
}
Write-Host "--- BOTTOM EDGE (Y=260 to 310 at X=500) ---"
for ($y = 260; $y -lt 310; $y += 2) {
    $c = $bmp.GetPixel(500, $y)
    Write-Host "Y=$y : R=$($c.R) G=$($c.G) B=$($c.B)"
}
$bmp.Dispose()
