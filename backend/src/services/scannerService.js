const { execFile } = require('child_process');

const WIA_JPEG_FORMAT = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}';
const WIA_PAGE_SIZES = {
  1: 'A4', 2: 'Carta', 3: 'Legal', 4: 'A5', 5: 'B5', 6: 'Tabloide'
};

const runPowerShell = (script, signal) => new Promise((resolve, reject) => {
  if (process.platform !== 'win32') {
    return reject(new Error('El escaneo físico requiere Windows y controladores compatibles con WIA.'));
  }

  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
  execFile('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encodedScript
  ], {
    windowsHide: true,
    maxBuffer: 80 * 1024 * 1024,
    ...(signal ? { signal } : {})
  }, (error, stdout, stderr) => {
    if (error) {
      if (error.name === 'AbortError') return reject(error);
      return reject(new Error(stderr.trim() || error.message));
    }

    try {
      resolve(JSON.parse(stdout.trim() || '{}'));
    } catch (parseError) {
      reject(new Error(`Windows no devolvió una respuesta válida del escáner: ${parseError.message}`));
    }
  });
});

const devicesScript = `
$manager = New-Object -ComObject WIA.DeviceManager
$devices = @(
  foreach ($deviceInfo in $manager.DeviceInfos) {
    if ([int]$deviceInfo.Type -eq 1) {
      $name = [string]$deviceInfo.Properties.Item('Name').Value
      $manufacturer = ''
      try { $manufacturer = [string]$deviceInfo.Properties.Item('Manufacturer').Value } catch {}
      [PSCustomObject]@{
        id = [string]$deviceInfo.DeviceID
        nombre = $name
        fabricante = $manufacturer
      }
    }
  }
)
ConvertTo-Json -InputObject @($devices) -Compress -Depth 4
`;

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const encodePayload = (payload) => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

const getScannerDevices = async () => {
  const result = await runPowerShell(devicesScript);
  return normalizeArray(result).filter(device => device?.id && device?.nombre);
};

const selectedDeviceScript = (payload) => `
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodePayload(payload)}')) | ConvertFrom-Json
$manager = New-Object -ComObject WIA.DeviceManager
$deviceInfo = $manager.DeviceInfos | Where-Object { $_.DeviceID -eq $payload.deviceId -and [int]$_.Type -eq 1 } | Select-Object -First 1
if ($null -eq $deviceInfo) { throw 'El escáner seleccionado ya no está disponible.' }
$device = $deviceInfo.Connect()
$item = $device.Items.Item(1)
function Get-WiaProperty($collection, $propertyId) {
  try { return $collection.Item([int]$propertyId) } catch { return $null }
}
$capabilities = Get-WiaProperty $device.Properties 3086
$handling = Get-WiaProperty $device.Properties 3088
$capabilityFlags = if ($capabilities) { [int]$capabilities.Value } else { 0 }
$canUseFeeder = ($capabilityFlags -band 1) -ne 0
$canUseDuplex = ($capabilityFlags -band 4) -ne 0
if ($payload.options.adf -and -not $canUseFeeder) { throw 'El escáner no informa compatibilidad con alimentador automático.' }
if ($payload.options.duplex -and -not $canUseDuplex) { throw 'El escáner no informa compatibilidad con doble cara.' }
if ($handling) {
  $handling.Value = if ($payload.options.adf) { if ($payload.options.duplex) { 5 } else { 1 } } else { 2 }
}
if ($payload.options.pageSize -ne $null) {
  $property = Get-WiaProperty $device.Properties 3097
  if (-not $property) { throw 'El controlador no permite configurar el tamaño de papel.' }
  $property.Value = [int]$payload.options.pageSize
}
if ($payload.options.dpi -ne $null) {
  $property = Get-WiaProperty $item.Properties 6147
  if (-not $property) { throw 'El controlador no permite configurar la resolución.' }
  $property.Value = [int]$payload.options.dpi
  $property = Get-WiaProperty $item.Properties 6148
  if ($property) { $property.Value = [int]$payload.options.dpi }
}
if ($payload.options.colorMode -ne $null) {
  $property = Get-WiaProperty $item.Properties 6146
  if (-not $property) { throw 'El controlador no permite configurar el modo de color.' }
  $property.Value = [int]$payload.options.colorMode
}
$workDirectory = Join-Path ([IO.Path]::GetTempPath()) ('correspondencia-wia-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workDirectory | Out-Null
$pages = [System.Collections.Generic.List[object]]::new()
try {
  $pageLimit = if ($payload.options.adf) { 100 } else { 1 }
  for ($pageNumber = 1; $pageNumber -le $pageLimit; $pageNumber++) {
    try {
      $image = $item.Transfer('${WIA_JPEG_FORMAT}')
    } catch {
      if ($payload.options.adf -and $pages.Count -gt 0) { break }
      throw
    }
    $filePath = Join-Path $workDirectory ('pagina-' + $pageNumber + '.jpg')
    $image.SaveFile($filePath)
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $pages.Add([PSCustomObject]@{
      ancho = [int]$image.Width
      alto = [int]$image.Height
      imagen = [Convert]::ToBase64String($bytes)
    })
    [IO.File]::Delete($filePath)
    if (-not $payload.options.adf) { break }
  }
  if ($pages.Count -eq 0) { throw 'El escáner no devolvió páginas.' }
  ConvertTo-Json -InputObject @{ paginas = @($pages) } -Compress -Depth 5
} finally {
  Remove-Item -LiteralPath $workDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
`;

const getScannerCapabilities = async (deviceId) => {
  const script = `
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodePayload({ deviceId })}')) | ConvertFrom-Json
$manager = New-Object -ComObject WIA.DeviceManager
$deviceInfo = $manager.DeviceInfos | Where-Object { $_.DeviceID -eq $payload.deviceId -and [int]$_.Type -eq 1 } | Select-Object -First 1
if ($null -eq $deviceInfo) { throw 'El escáner seleccionado ya no está disponible.' }
$device = $deviceInfo.Connect()
$item = $device.Items.Item(1)
function Get-WiaOptions($collection, $propertyId) {
  try {
    $property = $collection.Item([int]$propertyId)
    if ([int]$property.SubType -eq 2) { return @($property.SubTypeValues | ForEach-Object { [int]$_ }) }
    if ([int]$property.SubType -eq 1) {
      $minimum = [int]$property.SubTypeMin
      $maximum = [int]$property.SubTypeMax
      $step = [Math]::Max(1, [int]$property.SubTypeStep)
      $candidates = switch ([int]$propertyId) {
        3097 { @(1, 2, 3, 4, 5, 6) }
        6146 { @(0, 1, 2, 3) }
        default { @(75, 100, 150, 200, 300, 600, 1200) }
      }
      return @($candidates | Where-Object { $_ -ge $minimum -and $_ -le $maximum -and (($_ - $minimum) % $step) -eq 0 })
    }
  } catch {}
  return @()
}
function Get-WiaProperty($collection, $propertyId) { try { return $collection.Item([int]$propertyId) } catch { return $null } }
$handlingCaps = Get-WiaProperty $device.Properties 3086
$handlingFlags = if ($handlingCaps) { [int]$handlingCaps.Value } else { 0 }
$paperOptions = Get-WiaOptions $device.Properties 3097
$dpiOptions = Get-WiaOptions $item.Properties 6147
$colorOptions = Get-WiaOptions $item.Properties 6146
ConvertTo-Json -InputObject @{
  tamanoPapel = @($paperOptions)
  resoluciones = @($dpiOptions)
  modosColor = @($colorOptions)
  alimentador = (($handlingFlags -band 1) -ne 0)
  dobleCara = (($handlingFlags -band 4) -ne 0)
} -Compress -Depth 4
`;
  const result = await runPowerShell(script);
  const asArray = value => normalizeArray(value).map(Number).filter(Number.isFinite);
  return {
    tamanoPapel: asArray(result.tamanoPapel).map(value => ({
      valor: value,
      etiqueta: WIA_PAGE_SIZES[value] || `Tamaño ${value}`
    })),
    resoluciones: asArray(result.resoluciones),
    modosColor: asArray(result.modosColor).map(value => ({
      valor: value,
      etiqueta: ({ 1: 'Blanco y negro', 2: 'Escala de grises', 3: 'Color' })[value] || `Modo ${value}`
    })),
    alimentador: Boolean(result.alimentador),
    dobleCara: Boolean(result.dobleCara)
  };
};

const scanWithWia = async (deviceId, options, signal) => {
  const devices = await getScannerDevices();
  if (!devices.some(device => device.id === deviceId)) {
    throw new Error('El escáner seleccionado no está disponible. Vuelva a detectarlo.');
  }

  const capabilities = await getScannerCapabilities(deviceId);
  const validateOption = (value, supported, label) => {
    if (value !== undefined && value !== null && !supported.includes(Number(value))) {
      throw new Error(`El escáner seleccionado no admite ${label} solicitado.`);
    }
  };
  validateOption(options.pageSize, capabilities.tamanoPapel.map(item => item.valor), 'el tamaño de papel');
  validateOption(options.dpi, capabilities.resoluciones, 'la resolución');
  validateOption(options.colorMode, capabilities.modosColor.map(item => item.valor), 'el modo de color');
  if (options.adf && !capabilities.alimentador) throw new Error('Este escáner no informa un alimentador automático disponible.');
  if (options.duplex && (!options.adf || !capabilities.dobleCara)) {
    throw new Error('Este escáner no informa compatibilidad con doble cara para el alimentador.');
  }

  const result = await runPowerShell(selectedDeviceScript({ deviceId, options }), signal);
  const pages = normalizeArray(result.paginas);
  if (pages.length === 0) throw new Error('El escáner no devolvió páginas.');
  return pages.map((page, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    ancho: Number(page.ancho),
    alto: Number(page.alto),
    imagen: page.imagen
  }));
};

module.exports = { getScannerDevices, getScannerCapabilities, scanWithWia };