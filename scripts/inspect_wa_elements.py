import sys, os
sys.path.insert(0, os.path.abspath('.'))
import uiautomation as auto
from server.desktop.whatsapp_automator import find_whatsapp_window

hwnd = find_whatsapp_window()
ctrl = auto.ControlFromHandle(hwnd)

print(f"WhatsApp root: {ctrl.Name}, Rect={ctrl.BoundingRectangle}")

# Find buttons and edit controls
buttons = ctrl.GetChildren()
print(f"Top children count: {len(buttons)}")

print("Walking all controls in WhatsApp...")
for c, depth in auto.WalkControl(ctrl, maxDepth=8):
    name = (c.Name or "").strip()
    c_type = c.ControlTypeName
    if name or c_type in ('ButtonControl', 'EditControl', 'DocumentControl', 'TextControl'):
        print(f"{'  '*depth}{c_type}: '{name}' {c.BoundingRectangle}")


