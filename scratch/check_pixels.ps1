Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\nahue\.gemini\antigravity-ide\brain\a190e7d7-ebd4-45cb-9baa-325e446d4ae0\.user_uploaded\media_1790084160132.png'
$bmp = New-Object System.Drawing.Bitmap($imgPath)
for ($x = 970; $x -lt $bmp.Width; $x += 2) {
    $c = $bmp.GetPixel($x, 100)
    Write-Host "X=$x : R=$($c.R) G=$($c.G) B=$($c.B)"
}
$bmp.Dispose()
