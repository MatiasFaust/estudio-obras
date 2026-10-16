# Prepara una computadora para usar el sistema como aplicación ("Estudio RF").
#
# La aplicación se instala desde Microsoft Edge (Aplicaciones → Instalar Estudio RF):
# así tiene su propio ícono con el logo en el Escritorio, el menú Inicio y la barra de
# tareas, y se puede desinstalar desde Configuración → Aplicaciones. Este script:
#   1. revisa que Edge esté instalado,
#   2. manda a la papelera los accesos directos viejos (versión anterior de este script),
#   3. si la aplicación ya está instalada, avisa y termina,
#   4. si no, abre Edge en la página y explica cómo instalarla.
#
# Uso (desde la carpeta del repositorio):
#   powershell -ExecutionPolicy Bypass -File tools\instalar-estudio-rf.ps1
#
# No guarda datos personales: el repositorio es público.

param(
  [string]$Url = "https://estudio-rf.vercel.app",
  [string]$Nombre = "Estudio RF"
)

$ErrorActionPreference = "Stop"
$sitio = ([Uri]$Url).Host

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

# --- 2. Accesos directos viejos -------------------------------------------
# La versión anterior creaba accesos que abrían "msedge.exe --app=<página>". Se reconocen
# por eso y se mandan a la papelera (no se tocan los que crea Edge al instalar la aplicación).
Add-Type -AssemblyName Microsoft.VisualBasic
$papelera = [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
$soloErrores = [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs
$shell = New-Object -ComObject WScript.Shell
$carpetas = @([Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs"))
foreach ($dir in $carpetas) {
  Get-ChildItem $dir -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
    $s = $shell.CreateShortcut($_.FullName)
    # Algunos accesos (de aplicaciones de Windows) no tienen archivo de destino: se ignoran
    if ($s.TargetPath -and (Split-Path $s.TargetPath -Leaf) -eq "msedge.exe" -and $s.Arguments -like "--app=*$sitio*") {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($_.FullName, $soloErrores, $papelera)
      Write-Host "Acceso viejo a la papelera: $($_.FullName)"
    }
  }
}
$iconoViejo = Join-Path $env:LOCALAPPDATA "EstudioRF"
if (Test-Path $iconoViejo) {
  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($iconoViejo, $soloErrores, $papelera)
  Write-Host "Carpeta vieja del ícono a la papelera: $iconoViejo"
}

# --- 3. ¿Ya está instalada? -------------------------------------------------
# Edge crea accesos que abren "msedge_proxy.exe ... --app-id=... --app-url=<página>"
$instalada = $false
foreach ($dir in $carpetas) {
  Get-ChildItem $dir -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $s = $shell.CreateShortcut($_.FullName)
    if ($s.Arguments -like "*--app-id=*" -and $s.Arguments -like "*--app-url=*$sitio*") { $instalada = $true }
  }
}
if ($instalada) {
  Write-Host ""
  Write-Host "'$Nombre' ya está instalada en esta computadora. Abrila desde el Escritorio o el menú Inicio." -ForegroundColor Green
  exit 0
}

# --- 4. Abrir Edge para instalarla -----------------------------------------
Start-Process -FilePath $edge -ArgumentList "--new-window", $Url
Write-Host ""
Write-Host "Se abrió Edge en $Url. Para instalar '$Nombre':" -ForegroundColor Green
Write-Host "  1. Iniciá sesión con tu correo y contraseña."
Write-Host "  2. En la barra de direcciones, tocá el iconito de cuadraditos con un '+' (o los tres puntitos ... → Aplicaciones → Instalar $Nombre)."
Write-Host "  3. Tocá 'Instalar'."
Write-Host "  4. En el cartel que aparece, marcá 'Anclar a la barra de tareas', 'Anclar a Inicio' y 'Crear acceso directo en el escritorio', y tocá 'Permitir'."
