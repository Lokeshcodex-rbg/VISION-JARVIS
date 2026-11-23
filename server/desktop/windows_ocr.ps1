param(
    [string]$ImagePath = "scratch/chat_ocr_target.png",
    [switch]$IncludeBoxes
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime] | Out-Null

$resolved = Resolve-Path $ImagePath
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($resolved.Path)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

if ($IncludeBoxes) {
    $items = @()
    foreach ($line in $result.Lines) {
        $t = $line.Text.Trim()
        if ($t -and $line.Words.Count -gt 0) {
            $w0 = $line.Words | Select-Object -First 1
            $rect = $w0.BoundingRect
            $items += [PSCustomObject]@{
                text = $t
                x = [int][Math]::Round($rect.X)
                y = [int][Math]::Round($rect.Y)
                w = [int][Math]::Round($rect.Width)
                h = [int][Math]::Round($rect.Height)
            }
        }
    }
    $items | ConvertTo-Json
} else {
    $lines = @()
    foreach ($line in $result.Lines) {
        $t = $line.Text.Trim()
        if ($t) { $lines += $t }
    }
    $lines | ConvertTo-Json
}

