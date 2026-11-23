"""
VISION AI — Native Camera Hardware Frame Grabber
Accesses integrated webcam (Index 0) with OpenCV, verifies exposure,
and outputs verified Base64 JPEG data and image metrics.
"""

import sys
import os
import json
import time
import cv2
import numpy as np

def capture_webcam_frame(output_path=None, quality=85):
    t0 = time.time()
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        # Fallback to default backend
        cap = cv2.VideoCapture(0)
        
    if not cap.isOpened():
        return {
            "success": False,
            "error": "Webcam device 0 could not be opened. Verify device connection and permissions."
        }
        
    try:
        # Set resolution if supported
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        
        # Flush initial warm-up frames for auto-exposure stabilization
        for _ in range(3):
            cap.read()
            
        ret, frame = cap.read()
        cap.release()
        
        if not ret or frame is None:
            return {"success": False, "error": "Failed to read frame from active camera sensor."}
            
        h, w, c = frame.shape
        # Check luminance
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_lum = float(np.mean(gray))
        is_dark = mean_lum < 15.0
        
        # Save output file if requested
        if not output_path:
            ts = int(time.time() * 1000)
            output_path = os.path.join(os.getcwd(), 'scratch', f'webcam_capture_{ts}.jpg')
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        cv2.imwrite(output_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        
        # Encode base64
        _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        import base64
        b64_str = base64.b64encode(buffer).decode('utf-8')
        
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "success": True,
            "path": output_path,
            "width": w,
            "height": h,
            "meanLuminance": round(mean_lum, 2),
            "isDarkOrCovered": is_dark,
            "base64": b64_str,
            "latencyMs": latency_ms
        }
    except Exception as e:
        try: cap.release()
        except Exception: pass
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    out_file = sys.argv[1] if len(sys.argv) > 1 else ""
    res = capture_webcam_frame(out_file)
    # Print JSON output (omit huge base64 in stdout if just CLI inspection)
    print_res = {k: v for k, v in res.items() if k != 'base64'}
    print_res['base64Length'] = len(res.get('base64', ''))
    print(json.dumps(print_res))

