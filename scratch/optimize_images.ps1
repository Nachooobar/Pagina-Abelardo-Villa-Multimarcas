Add-Type -AssemblyName System.Drawing

$inputPath = "C:\Work\ASTRO WEB\PROYECTOS\Pagina Abelardo Villa Multimarcas\public\images\astroweb-logo.png"
$outputPath = "C:\Work\ASTRO WEB\PROYECTOS\Pagina Abelardo Villa Multimarcas\public\images\astroweb-logo.png"
$tempPath = "C:\Work\ASTRO WEB\PROYECTOS\Pagina Abelardo Villa Multimarcas\public\images\astroweb-logo-temp.png"

$src = [System.Drawing.Image]::FromFile($inputPath)
$newWidth = 360
$ratio = $newWidth / $src.Width
$newHeight = [int]($src.Height * $ratio)

$dest = New-Object System.Drawing.Bitmap $newWidth, $newHeight
$g = [System.Drawing.Graphics]::FromImage($dest)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, $newWidth, $newHeight)

$src.Dispose()
$dest.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dest.Dispose()
$g.Dispose()

Remove-Item $inputPath
Move-Item $tempPath $inputPath

$fileInfo = Get-Item $inputPath
Write-Output "Optimized astroweb-logo.png size: $($fileInfo.Length) bytes"
