"""
VISION AI — Python Multimodal Vision, Document & Screen Bridge
Provides high-performance native image, PDF, DOCX, video, and UI Automation
services for Phase 11 Advanced Multimodal Intelligence.
"""

import sys
import os
import json
import time
import math
import ctypes
from ctypes import wintypes
from PIL import Image, ImageGrab, ImageChops, ImageStat
import cv2
import pymupdf
import docx

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
shcore = ctypes.windll.shcore

# DPI Awareness
try:
    shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

# Interactive desktop attachment
DESKTOP_ALL = 0x01FF
h_default = user32.OpenDesktopW('Default', 0, False, DESKTOP_ALL)
if h_default:
    user32.SetThreadDesktop(h_default)

def capture_screen(target_path=None, rect=None):
    if not target_path:
        ts = int(time.time() * 1000)
        target_path = os.path.join(os.getcwd(), 'scratch', f'screen_capture_{ts}.png')
    os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)

    if rect:
        img = ImageGrab.grab(bbox=(rect[0], rect[1], rect[2], rect[3]))
    else:
        # Full primary screen
        w = user32.GetSystemMetrics(0)
        h = user32.GetSystemMetrics(1)
        img = ImageGrab.grab(bbox=(0, 0, w, h))

    img.save(target_path)
    return {
        "success": True,
        "path": target_path,
        "width": img.width,
        "height": img.height,
        "sizeBytes": os.path.getsize(target_path)
    }

def get_active_window_info():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return {"success": False, "error": "No foreground window found"}

    length = user32.GetWindowTextLengthW(hwnd)
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buff, length + 1)
    title = buff.value

    cbuff = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, cbuff, 256)
    cname = cbuff.value

    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))

    return {
        "success": True,
        "hwnd": hwnd,
        "title": title,
        "className": cname,
        "pid": pid.value,
        "rect": [rect.left, rect.top, rect.right, rect.bottom],
        "width": rect.right - rect.left,
        "height": rect.bottom - rect.top
    }

def inspect_accessibility_tree(hwnd=None):
    try:
        import uiautomation as auto
        if hwnd:
            ctrl = auto.ControlFromHandle(int(hwnd))
        else:
            active_info = get_active_window_info()
            if not active_info.get("success"):
                return {"success": False, "error": "Could not determine active window"}
            ctrl = auto.ControlFromHandle(active_info["hwnd"])

        if not ctrl:
            return {"success": False, "error": "Control not found from handle"}

        elements = []
        for child, depth in auto.WalkControl(ctrl, maxDepth=4):
            rect = child.BoundingRectangle
            elements.append({
                "name": child.Name or "",
                "controlType": child.ControlTypeName,
                "automationId": child.AutomationId or "",
                "className": child.ClassName or "",
                "depth": depth,
                "rect": [rect.left, rect.top, rect.right, rect.bottom],
                "isEnabled": child.IsEnabled
            })

        return {
            "success": True,
            "rootName": ctrl.Name,
            "rootType": ctrl.ControlTypeName,
            "elementCount": len(elements),
            "elements": elements
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def parse_pdf_document(pdf_path):
    if not os.path.exists(pdf_path):
        return {"success": False, "error": f"File not found: {pdf_path}"}

    try:
        # Suppress pymupdf stdout banner warnings
        import io
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            doc = pymupdf.open(pdf_path)
        finally:
            sys.stdout = old_stdout

        pages_data = []
        full_text = []

        for idx, page in enumerate(doc):
            text = page.get_text()
            full_text.append(text)
            blocks = page.get_text("blocks")
            tables = []
            try:
                # Tabular extraction if available
                t = page.find_tables()
                if t.tables:
                    for tab in t.tables:
                        tables.append(tab.extract())
            except Exception:
                pass

            pages_data.append({
                "pageNumber": idx + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "textLength": len(text),
                "blockCount": len(blocks),
                "tableCount": len(tables),
                "tables": tables,
                "preview": text[:400]
            })

        metadata = doc.metadata or {}
        combined_text = "\n\n".join(full_text)

        return {
            "success": True,
            "filePath": pdf_path,
            "pageCount": len(doc),
            "metadata": metadata,
            "totalCharacters": len(combined_text),
            "pages": pages_data,
            "fullText": combined_text
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def parse_docx_document(docx_path):
    if not os.path.exists(docx_path):
        return {"success": False, "error": f"File not found: {docx_path}"}

    try:
        doc = docx.Document(docx_path)
        paragraphs = []
        headings = []

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            if p.style and 'Heading' in p.style.name:
                headings.append({"level": p.style.name, "text": text})
            paragraphs.append(text)

        tables_data = []
        for t_idx, table in enumerate(doc.tables):
            rows = []
            for row in table.rows:
                rows.append([cell.text.strip() for cell in row.cells])
            tables_data.append({
                "tableIndex": t_idx + 1,
                "rowCount": len(rows),
                "columnCount": len(rows[0]) if rows else 0,
                "data": rows
            })

        full_text = "\n\n".join(paragraphs)
        return {
            "success": True,
            "filePath": docx_path,
            "paragraphCount": len(paragraphs),
            "headings": headings,
            "tableCount": len(tables_data),
            "tables": tables_data,
            "fullText": full_text
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def parse_image_file(image_path):
    if not os.path.exists(image_path):
        return {"success": False, "error": f"File not found: {image_path}"}

    try:
        img_pil = Image.open(image_path)
        w, h = img_pil.size
        mode = img_pil.mode
        stat = ImageStat.Stat(img_pil)
        mean_brightness = sum(stat.mean[:3]) / min(3, len(stat.mean))

        # OpenCV contour and edge analysis
        img_cv = cv2.imread(image_path)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        bounding_boxes = []
        for c in contours:
            bx, by, bw, bh = cv2.boundingRect(c)
            if bw > 25 and bh > 25:
                bounding_boxes.append([int(bx), int(by), int(bw), int(bh)])

        # OCR attempt: pytesseract first, then native Windows.Media.Ocr (WinRT) via scripts/win_ocr.ps1
        ocr_text = ""
        ocr_engine_used = "none"
        try:
            import pytesseract
            ocr_text = pytesseract.image_to_string(img_pil).strip()
            ocr_engine_used = "tesseract"
        except Exception:
            try:
                import subprocess
                repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                win_ocr_ps1 = os.path.join(repo_root, "scripts", "win_ocr.ps1")
                if os.path.exists(win_ocr_ps1):
                    proc = subprocess.run(
                        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", win_ocr_ps1, image_path],
                        capture_output=True, text=True, timeout=8
                    )
                    if proc.returncode == 0 and proc.stdout:
                        ocr_text = proc.stdout.strip()
                        ocr_engine_used = "windows_winrt_ocr"
            except Exception:
                pass

        # Circular feature detection (useful for rotors, gears, lenses, pulleys, wheels)
        circles_count = 0
        try:
            blurred = cv2.medianBlur(gray, 5)
            circles = cv2.HoughCircles(
                blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=24,
                param1=80, param2=35, minRadius=8, maxRadius=max(16, min(w, h) // 2)
            )
            if circles is not None:
                circles_count = int(len(circles[0]))
        except Exception:
            pass

        # Segmentation summary (Otsu foreground mask coverage & centroid)
        segmentation = {"foregroundRatio": 0.0, "centroid": [0.5, 0.5], "segmentCount": 0}
        try:
            _, otsu_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            fg_pixels = int(cv2.countNonZero(otsu_mask))
            fg_ratio = fg_pixels / max(1.0, float(w * h))
            if fg_ratio > 0.85:
                otsu_mask = cv2.bitwise_not(otsu_mask)
                fg_pixels = int(cv2.countNonZero(otsu_mask))
                fg_ratio = fg_pixels / max(1.0, float(w * h))
            m = cv2.moments(otsu_mask)
            cx_norm = (m["m10"] / m["m00"]) / max(1, w) if m["m00"] > 0 else 0.5
            cy_norm = (m["m01"] / m["m00"]) / max(1, h) if m["m00"] > 0 else 0.5
            num_labels, _ = cv2.connectedComponents(otsu_mask)
            segmentation = {
                "foregroundRatio": round(fg_ratio, 4),
                "centroid": [round(float(cx_norm), 4), round(float(cy_norm), 4)],
                "segmentCount": max(0, int(num_labels) - 1),
            }
        except Exception:
            pass

        # Spatial relationships between dominant bounding regions
        spatial_relations = []
        try:
            top_boxes = sorted(bounding_boxes, key=lambda b: b[2] * b[3], reverse=True)[:5]
            for i in range(len(top_boxes)):
                for j in range(i + 1, len(top_boxes)):
                    b1, b2 = top_boxes[i], top_boxes[j]
                    c1x, c1y = b1[0] + b1[2] / 2.0, b1[1] + b1[3] / 2.0
                    c2x, c2y = b2[0] + b2[2] / 2.0, b2[1] + b2[3] / 2.0
                    dx, dy = c2x - c1x, c2y - c1y
                    horiz = "left_of" if dx > 12 else ("right_of" if dx < -12 else "horizontally_aligned")
                    vert = "above" if dy > 12 else ("below" if dy < -12 else "vertically_aligned")
                    spatial_relations.append(f"region_{i} is {horiz} and {vert} region_{j}")
        except Exception:
            pass

        # Visual anomaly & quality assessment (blur variance + localized contrast anomaly)
        visual_anomaly = {"sharpnessLaplacian": 0.0, "blurRisk": False, "outlierPatchCount": 0, "anomalyDetected": False}
        try:
            import numpy as np
            lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            grid = cv2.resize(gray.astype(np.float32), (8, 8))
            mean_g, std_g = float(grid.mean()), float(grid.std())
            outliers = int(np.sum(np.abs(grid - mean_g) > max(28.0, 2.1 * std_g)))
            visual_anomaly = {
                "sharpnessLaplacian": round(lap_var, 2),
                "blurRisk": lap_var < 35.0,
                "outlierPatchCount": outliers,
                "anomalyDetected": bool(outliers >= 2 or lap_var < 35.0 or mean_brightness < 25.0 or mean_brightness > 245.0),
            }
        except Exception:
            pass

        return {
            "success": True,
            "filePath": image_path,
            "width": w,
            "height": h,
            "mode": mode,
            "meanBrightness": round(mean_brightness, 2),
            "detectedRegionsCount": len(bounding_boxes),
            "circularFeaturesCount": circles_count,
            "regions": bounding_boxes[:30],
            "normalizedRegions": [
                [round(b[0] / w, 4), round(b[1] / h, 4), round(b[2] / w, 4), round(b[3] / h, 4)]
                for b in bounding_boxes[:15]
            ],
            "segmentation": segmentation,
            "spatialRelations": spatial_relations[:10],
            "visualAnomaly": visual_anomaly,
            "ocrText": ocr_text,
            "ocrEngine": ocr_engine_used,
            "sizeBytes": os.path.getsize(image_path)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def compare_images(img1_path, img2_path):
    if not os.path.exists(img1_path) or not os.path.exists(img2_path):
        return {"success": False, "error": "One or both image paths do not exist"}

    try:
        im1 = Image.open(img1_path).convert('RGB')
        im2 = Image.open(img2_path).convert('RGB')

        # Resize to matching dimensions if unequal
        if im1.size != im2.size:
            target_size = (max(im1.width, im2.width), max(im1.height, im2.height))
            im1 = im1.resize(target_size)
            im2 = im2.resize(target_size)

        diff = ImageChops.difference(im1, im2)
        stat = ImageStat.Stat(diff)
        diff_val = sum(stat.mean) / 3.0 # average channel difference (0-255)
        diff_pct = round((diff_val / 255.0) * 100, 2)
        similarity_pct = round(100.0 - diff_pct, 2)

        bbox = diff.getbbox()
        return {
            "success": True,
            "identical": diff_val < 0.5,
            "similarityPercentage": similarity_pct,
            "differencePercentage": diff_pct,
            "changedBoundingBox": list(bbox) if bbox else None,
            "image1Size": [im1.width, im1.height],
            "image2Size": [im2.width, im2.height]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def process_video_file(video_path, max_frames=8):
    if not os.path.exists(video_path):
        return {"success": False, "error": f"Video file not found: {video_path}"}

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"success": False, "error": "Could not open video file"}

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_sec = round(frame_count / fps, 2)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        frames_extracted = []
        out_dir = os.path.join(os.getcwd(), 'scratch', 'video_frames')
        os.makedirs(out_dir, exist_ok=True)

        import numpy as np
        step = max(1, frame_count // max_frames)
        prev_gray = None
        for i in range(max_frames):
            frame_idx = i * step
            if frame_idx >= frame_count:
                break
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break

            timestamp_sec = round(frame_idx / fps, 2)
            fname = f"frame_{int(timestamp_sec*1000)}ms.jpg"
            fpath = os.path.join(out_dir, fname)
            cv2.imwrite(fpath, frame)

            gray_f = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 90))
            motion_score = 0.0
            if prev_gray is not None:
                diff_f = np.abs(gray_f.astype(np.float32) - prev_gray.astype(np.float32))
                motion_score = round(float(np.mean(diff_f) / 255.0) * 100.0, 2)
            prev_gray = gray_f
            mean_lum = round(float(np.mean(gray_f)), 2)

            frames_extracted.append({
                "frameIndex": frame_idx,
                "timestampSec": timestamp_sec,
                "savedPath": fpath,
                "meanLuminance": mean_lum,
                "motionDeltaPercent": motion_score,
                "significantChange": motion_score >= 4.0
            })

        cap.release()

        return {
            "success": True,
            "videoPath": video_path,
            "durationSec": duration_sec,
            "fps": round(fps, 2),
            "totalFrames": frame_count,
            "resolution": [width, height],
            "extractedFramesCount": len(frames_extracted),
            "temporalEventsCount": sum(1 for fr in frames_extracted if fr.get("significantChange")),
            "frames": frames_extracted
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def discover_cameras(max_probe=3):
    devices = []
    for idx in range(max_probe):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
            devices.append({
                "deviceId": f"opencv_camera_{idx}",
                "index": idx,
                "label": f"Video Capture Device #{idx} ({w}x{h})" if w > 0 else f"Video Capture Device #{idx}",
                "isDefault": idx == 0,
                "hardwareVerified": True
            })
            cap.release()
    return {"success": True, "devices": devices, "hardwareProbed": True}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action provided"}))
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == 'capture_screen':
        target = sys.argv[2] if len(sys.argv) > 2 else None
        res = capture_screen(target)
        print(json.dumps(res))
    elif action == 'active_window':
        res = get_active_window_info()
        print(json.dumps(res))
    elif action == 'inspect_tree':
        hwnd = sys.argv[2] if len(sys.argv) > 2 else None
        res = inspect_accessibility_tree(hwnd)
        print(json.dumps(res))
    elif action == 'parse_pdf':
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing pdf path"}))
            sys.exit(1)
        res = parse_pdf_document(sys.argv[2])
        print(json.dumps(res))
    elif action == 'parse_docx':
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing docx path"}))
            sys.exit(1)
        res = parse_docx_document(sys.argv[2])
        print(json.dumps(res))
    elif action == 'parse_image':
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing image path"}))
            sys.exit(1)
        res = parse_image_file(sys.argv[2])
        print(json.dumps(res))
    elif action == 'compare_images':
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Missing 2 image paths"}))
            sys.exit(1)
        res = compare_images(sys.argv[2], sys.argv[3])
        print(json.dumps(res))
    elif action == 'process_video':
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing video path"}))
            sys.exit(1)
        max_f = int(sys.argv[3]) if len(sys.argv) > 3 else 8
        res = process_video_file(sys.argv[2], max_f)
        print(json.dumps(res))
    elif action == 'discover_cameras':
        res = discover_cameras()
        print(json.dumps(res))
    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))
