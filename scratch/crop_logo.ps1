Add-Type -AssemblyName System.Drawing

$imgPath = "C:\Users\nahue\.gemini\antigravity-ide\brain\a190e7d7-ebd4-45cb-9baa-325e446d4ae0\.user_uploaded\media_1790084160132.png"
$bmp = New-Object System.Drawing.Bitmap($imgPath)

Write-Host "Image dimensions: $($bmp.Width) x $($bmp.Height)"

$minX = $bmp.Width
$minY = $bmp.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # Check if blue border pixel
        if ($c.B -gt 160 -and $c.B -gt ($c.R + 80) -and $c.G -gt 80) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Blue frame bounds: X=$minX, Y=$minY, MaxX=$maxX, MaxY=$maxY, Width=$($maxX - $minX + 1), Height=$($maxY - $minY + 1)"

# Crop exactly to the blue rectangle
$cropWidth = $maxX - $minX + 1
$cropHeight = $maxY - $minY + 1
$rect = New-Object System.Drawing.Rectangle($minX, $minY, $cropWidth, $cropHeight)
$croppedBmp = $bmp.Clone($rect, $bmp.PixelFormat)

$outCropped = "c:\Work\ASTRO WEB\PROYECTOS\Pagina Abelardo Villa Multimarcas\public\images\logo-abelardo-banner.png"
$croppedBmp.Save($outCropped, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved cropped banner to: $outCropped"

$croppedBmp.Dispose()
$bmp.Dispose()
