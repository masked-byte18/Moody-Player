Add-Type -AssemblyName System.Drawing
$inputPath = "c:\Users\rajka\Desktop\Web_Dev\Seriyans Coding School\Backend\Moody Player\Frontend\public\logo2.png"
$outputPath = "c:\Users\rajka\Desktop\Web_Dev\Seriyans Coding School\Backend\Moody Player\Frontend\public\cropped_favicon.png"

$img = [System.Drawing.Image]::FromFile($inputPath)

# We want to crop the central 65% of the image to remove the transparent padding
$cropWidth = [math]::Floor($img.Width * 0.65)
$cropHeight = [math]::Floor($img.Height * 0.65)
$cropX = [math]::Floor(($img.Width - $cropWidth) / 2)
$cropY = [math]::Floor(($img.Height - $cropHeight) / 2)

$cropRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropWidth, $cropHeight

$bmp = New-Object System.Drawing.Bitmap $cropWidth, $cropHeight
$bmp.SetResolution($img.HorizontalResolution, $img.VerticalResolution)

$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$destRect = New-Object System.Drawing.Rectangle 0, 0, $cropWidth, $cropHeight
$gfx.DrawImage($img, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)

$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$gfx.Dispose()
$bmp.Dispose()
$img.Dispose()

Write-Output "Successfully cropped image to $outputPath"
