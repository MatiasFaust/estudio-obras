# Crea el acceso directo "Estudio RF" (Escritorio y menú Inicio) que abre el sistema
# en una ventana propia de Microsoft Edge, sin barra de direcciones ni pestañas.
#
# Uso (desde la carpeta del repositorio):
#   powershell -ExecutionPolicy Bypass -File tools\crear-acceso-directo.ps1
#
# Se puede ejecutar las veces que haga falta: vuelve a crear el ícono y los accesos.
# Si el acceso directo muestra una hoja en blanco, ejecutarlo de nuevo lo arregla.
# No guarda datos personales: todo queda en la carpeta del usuario de Windows.

param(
  [string]$Url = "https://estudio-rf.vercel.app",
  [string]$Nombre = "Estudio RF",
  [string]$Logo = (Join-Path $PSScriptRoot "..\sistema\public\logos\arquitectura.png")
)

$ErrorActionPreference = "Stop"

# --- 1. Microsoft Edge ------------------------------------------------------
$edge = $null
foreach ($key in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe")) {
  $p = (Get-ItemProperty $key -ErrorAction SilentlyContinue).'(default)'
  if ($p -and (Test-Path $p)) { $edge = $p; break }
}
if (-not $edge) {
  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $edge) {
  Write-Host "No encontré Microsoft Edge. Instalalo desde https://www.microsoft.com/edge y volvé a ejecutar este script." -ForegroundColor Red
  exit 1
}
Write-Host "Edge: $edge"

# --- 2. Ícono (.ico con varios tamaños) ------------------------------------
$Logo = (Resolve-Path $Logo).Path
$carpeta = Join-Path $env:LOCALAPPDATA "EstudioRF"
New-Item -ItemType Directory -Force $carpeta | Out-Null
$temporal = Join-Path $carpeta "estudio-rf.tmp"

Add-Type -AssemblyName System.Drawing

# Imagen cuadrada de N x N px, reducida con la mejor calidad
function New-Resized([System.Drawing.Image]$src, [int]$n) {
  $bmp = New-Object System.Drawing.Bitmap $n, $n, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY) # sin bordes oscuros
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $n, $n), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose()
  return $bmp
}

# Tamaño chico: mapa de bits de 32 bits (lo que mejor entiende Windows en tamaños chicos)
function Get-BmpEntry([System.Drawing.Bitmap]$bmp) {
  $n = $bmp.Width
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter $ms
  # BITMAPINFOHEADER (alto x2: imagen + máscara)
  $w.Write([int32]40); $w.Write([int32]$n); $w.Write([int32]($n * 2)); $w.Write([int16]1); $w.Write([int16]32)
  $w.Write([int32]0); $w.Write([int32]0); $w.Write([int32]0); $w.Write([int32]0); $w.Write([int32]0); $w.Write([int32]0)
  # Píxeles BGRA, de abajo hacia arriba
  for ($y = $n - 1; $y -ge 0; $y--) {
    for ($x = 0; $x -lt $n; $x++) {
      $c = $bmp.GetPixel($x, $y)
      $w.Write([byte]$c.B); $w.Write([byte]$c.G); $w.Write([byte]$c.R); $w.Write([byte]$c.A)
    }
  }
  # Máscara de 1 bit (todo visible: la transparencia la da el canal alfa)
  $fila = [int]([math]::Ceiling($n / 32.0) * 4)
  $w.Write((New-Object byte[] ($fila * $n)))
  $w.Flush()
  return ,$ms.ToArray()  # la coma evita que PowerShell lo separe en bytes sueltos
}

function Get-PngEntry([System.Drawing.Bitmap]$bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  return ,$ms.ToArray()
}

$tamanos = 16, 24, 32, 48, 64, 128, 256
$src = [System.Drawing.Image]::FromFile($Logo)
$entradas = foreach ($n in $tamanos) {
  $bmp = New-Resized $src $n
  # 256 px va comprimido (PNG); los demás, como mapa de bits
  [byte[]]$datos = if ($n -eq 256) { Get-PngEntry $bmp } else { Get-BmpEntry $bmp }
  $bmp.Dispose()
  [pscustomobject]@{ Tamano = $n; Datos = $datos }
}
$src.Dispose()

$fs = [System.IO.File]::Create($temporal)
$w = New-Object System.IO.BinaryWriter $fs
$w.Write([int16]0); $w.Write([int16]1); $w.Write([int16]$entradas.Count)   # ICONDIR
$offset = 6 + 16 * $entradas.Count
foreach ($e in $entradas) {                                                # ICONDIRENTRY
  $lado = if ($e.Tamano -ge 256) { 0 } else { $e.Tamano }
  $w.Write([byte]$lado); $w.Write([byte]$lado); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([int16]1); $w.Write([int16]32); $w.Write([int32]$e.Datos.Length); $w.Write([int32]$offset)
  $offset += $e.Datos.Length
}
foreach ($e in $entradas) { $w.Write([byte[]]$e.Datos) }
$w.Close()
if ((Get-Item $temporal).Length -lt 10000) { throw "El ícono quedó vacío o incompleto: $temporal" }

# Windows guarda los íconos en memoria según el nombre del archivo: si el ícono cambia y se
# llama igual, puede seguir mostrando el viejo (por ejemplo, una hoja en blanco). Por eso el
# nombre lleva una marca del contenido, y se borran las versiones anteriores.
$marca = (Get-FileHash $temporal -Algorithm SHA256).Hash.Substring(0, 8).ToLower()
$ico = Join-Path $carpeta "estudio-rf-$marca.ico"
Get-ChildItem $carpeta -Filter "estudio-rf*.ico" | Where-Object { $_.FullName -ne $ico } | Remove-Item -Force
Move-Item -Force $temporal $ico
Write-Host "Ícono: $ico ($($tamanos -join ', ') px)"

# --- 3. Accesos directos ----------------------------------------------------
$shell = New-Object -ComObject WScript.Shell
$destinos = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "$Nombre.lnk"),
  (Join-Path ([Environment]::GetFolderPath("Programs")) "$Nombre.lnk")
)
foreach ($lnk in $destinos) {
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath = $edge
  $s.Arguments = "--app=$Url"
  $s.WorkingDirectory = Split-Path $edge
  $s.IconLocation = "$ico,0"
  $s.Description = "Sistema de gestión del estudio"
  $s.Save()
  Write-Host "Acceso directo: $lnk"
}

# Pedirle a Windows que vuelva a leer los íconos del Escritorio y del menú Inicio
$ie4 = Join-Path $env:WINDIR "System32\ie4uinit.exe"
if (Test-Path $ie4) { & $ie4 -show }
Add-Type -Namespace EstudioRF -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, int f, IntPtr a, IntPtr b);'
[EstudioRF.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)  # SHCNE_ASSOCCHANGED

Write-Host ""
Write-Host "Listo. Abrí '$Nombre' desde el Escritorio o el menú Inicio." -ForegroundColor Green
