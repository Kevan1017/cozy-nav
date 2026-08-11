# 生成 cozy·nav 扩展图标（绿色圆底 + 白色书签形状）
# 用法：powershell -ExecutionPolicy Bypass -File gen-icons.ps1
Add-Type -AssemblyName System.Drawing

function New-Icon($size, $outPath) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # 背景圆（绿色，用预定义画刷避免构造函数兼容问题）
  $bg = [System.Drawing.Brushes]::MediumSeaGreen
  $g.FillEllipse($bg, 0, 0, $size - 1, $size - 1)

  # 白色书签形状：圆角矩形 + 底部三角
  $white = [System.Drawing.Brushes]::White
  $w = [Math]::Round($size * 0.36)
  $h = [Math]::Round($size * 0.5)
  $x = [Math]::Round(($size - $w) / 2)
  $y = [Math]::Round($size * 0.18)
  $h1 = [Math]::Round($h * 0.72)
  $r = [Math]::Max(2, [Math]::Round($size * 0.05))

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90)
  $path.AddLine($x + $r, $y, $x + $w - $r, $y)
  $path.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
  $path.AddLine($x + $w, $y + $r, $x + $w, $y + $h1)
  $path.AddLine($x + $w, $y + $h1, [Math]::Round($x + $w / 2), $y + $h)
  $path.AddLine([Math]::Round($x + $w / 2), $y + $h, $x, $y + $h1)
  $path.CloseFigure()
  $g.FillPath($white, $path)

  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "generated $outPath"
}

$dir = Join-Path $PSScriptRoot 'icons'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-Icon 16  (Join-Path $dir 'icon16.png')
New-Icon 32  (Join-Path $dir 'icon32.png')
New-Icon 48  (Join-Path $dir 'icon48.png')
New-Icon 128 (Join-Path $dir 'icon128.png')
