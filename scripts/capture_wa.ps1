Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$out = "D:\Jarvis\wa_captured.png"

# Find WhatsApp window rect
$hwnd = [IntPtr]526618
$rect = New-Object System.Drawing.Rectangle
# Get Window rect using P/Invoke
$signature = @'
[DllImport("user32.dll")]
public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
'@
Add-Type -MemberDefinition $signature -Name Win32Utils -Namespace Win32

$r = New-Object Win32.Win32Utils+RECT
[Win32.Win32Utils]::GetWindowRect($hwnd, [ref]$r)

$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top
Write-Output "Capture Rect: Left=$($r.Left) Top=$($r.Top) W=$w H=$h"

if ($w -gt 0 -and $h -gt 0) {
    # If offscreen or negative, normalize
    $srcX = [Math]::Max(0, $r.Left)
    $srcY = [Math]::Max(0, $r.Top)
    $srcW = [Math]::Min(1920 - $srcX, $w)
    $srcH = [Math]::Min(1080 - $srcY, $h)
    
    $bmp = New-Object System.Drawing.Bitmap $srcW, $srcH
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($srcX, $srcY, 0, 0, (New-Object System.Drawing.Size($srcW, $srcH)))
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Saved to $out ($srcW x $srcH)"
}

