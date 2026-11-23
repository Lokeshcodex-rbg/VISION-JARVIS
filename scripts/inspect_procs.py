import ctypes
from ctypes import wintypes
# Let's inspect processes named WINWORD.EXE and Code.exe
import subprocess
out = subprocess.check_output(['powershell', '-c', 'Get-CimInstance Win32_Process -Filter "Name=\'WINWORD.EXE\' or Name=\'Code.exe\'" | Select-Object ProcessId, Name, CommandLine, ParentProcessId | Format-List']).decode('utf-8', errors='ignore')
print(out)
