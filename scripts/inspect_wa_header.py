import sys, os
sys.path.insert(0, os.path.abspath('.'))
import uiautomation as auto
from server.desktop.whatsapp_automator import find_whatsapp_window

hwnd = find_whatsapp_window()
ctrl = auto.ControlFromHandle(hwnd)

print("Checking header text in WhatsApp...")
for c, depth in auto.WalkControl(ctrl, maxDepth=12):
    rect = c.BoundingRectangle
    if rect and rect.top < 230 and rect.left > 200:
        name = (c.Name or '').strip()
        if name and len(name) > 1:
            print(f"  {c.ControlTypeName}: '{name}' rect={rect}")

