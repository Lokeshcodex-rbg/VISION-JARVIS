import comtypes.client
from comtypes import GUID

try:
    clsid = GUID("{ff48dba4-60ef-4201-aa87-54103eef594e}")
    uia = comtypes.client.CreateObject(clsid)
    print("Created CUIAutomation:", uia)
    hwnd = 526618
    element = uia.ElementFromHandle(hwnd)
    print("Element:", element.CurrentName)
    
    walker = uia.ControlViewWalker
    def walk(el, depth=0):
        if depth > 6:
            return
        child = walker.GetFirstChildElement(el)
        while child:
            name = child.CurrentName
            aid = child.CurrentAutomationId
            cls = child.CurrentClassName
            rect = child.CurrentBoundingRectangle
            if "send" in (name or "").lower() or "type" in (name or "").lower() or "message" in (name or "").lower() or "button" in (cls or "").lower() or "harsh" in (name or "").lower():
                print(f"{'  '*depth}[{child.CurrentControlType}] Name='{name}', Id='{aid}', Class='{cls}', Rect=({rect.left}, {rect.top}, {rect.right}, {rect.bottom})")
            walk(child, depth + 1)
            child = walker.GetNextSiblingElement(child)
    walk(element)
except Exception as e:
    import traceback
    traceback.print_exc()
