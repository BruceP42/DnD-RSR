# ---------------------------------------------------------
# Path:         server.py
# File:         server.py
# Version:      V2.1
# System:       DnD-RSR — D&D 5e Dynamic Reference System
# Module/Role:  Local server — static file serving and
#               pipeline flag endpoints.
# Dependencies: flask, flask-cors  (pip install -r requirements.txt)
# Created:      2026-05-09
# Last Updated: 2026-05-24
# Author:       Bruce Pilcher
# Usage:        python server.py              -> runs on port 8000
#               PORT=9000 python server.py   -> override port
#               VERBOSE=true python server.py -> enable request logging
# Changelog:
#   V2.1: Adapted for DnD-RSR public repository.
#         Default file changed from default.html to index.html.
#         System name and startup message updated.
#   V2.0: Renamed from phase3_server.py. Consolidated to single
#         server on port 8000. Port configurable via PORT env var.
#         Flag file at project root. Verbose logging via VERBOSE
#         env var. Removed unused imports.
# ---------------------------------------------------------

from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import os
import mimetypes
from datetime import datetime, timezone

# -----------------------------
# Configuration
# -----------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PORT     = int(os.environ.get('PORT', 8000))
VERBOSE  = os.environ.get('VERBOSE', 'false').lower() == 'true'

def log(msg):
    if VERBOSE:
        print(f"[server] {msg}")

# -----------------------------
# App setup
# -----------------------------
app = Flask(__name__, static_folder=None)
CORS(app)  # allow all origins for local use

# -----------------------------
# Serve any file from project root
# Default route serves index.html
# -----------------------------
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_file(path):
    full_path = os.path.join(BASE_DIR, path)
    log(f"GET /{path}")

    if not os.path.exists(full_path):
        log(f"Not found: {full_path}")
        return "Not Found", 404

    mimetype, _ = mimetypes.guess_type(full_path)
    if path.endswith('.js'):
        mimetype = 'application/javascript'
    elif path.endswith('.woff2'):
        mimetype = 'font/woff2'
    elif path.endswith('.woff'):
        mimetype = 'font/woff'

    return send_from_directory(BASE_DIR, path, mimetype=mimetype)

# -----------------------------
# POST /write-file
# Body: { "path": "relative/path/to/file.js", "content": "..." }
# Writes any file within the project root. Rejects path traversal.
# -----------------------------
@app.route('/write-file', methods=['POST'])
def write_file():
    try:
        body     = request.get_json(force=True)
        rel_path = body.get('path', '')
        content  = body.get('content', '')
        resolved = os.path.normpath(os.path.join(BASE_DIR, rel_path))

        if not resolved.startswith(BASE_DIR + os.sep) and resolved != BASE_DIR:
            log(f"/write-file rejected path traversal: {resolved}")
            return jsonify({"ok": False, "error": "Path traversal rejected"}), 400

        os.makedirs(os.path.dirname(resolved), exist_ok=True)

        with open(resolved, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)

        log(f"/write-file wrote: {resolved}")
        return jsonify({"ok": True})

    except Exception as e:
        log(f"/write-file error: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

# -----------------------------
# POST /write-flag
# No body required.
# Creates pipeline-needed.flag in the project root with a UTC timestamp.
# -----------------------------
@app.route('/write-flag', methods=['POST'])
def write_flag():
    try:
        flag_path = os.path.join(BASE_DIR, 'pipeline-needed.flag')
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        with open(flag_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(timestamp)

        log(f"/write-flag wrote: {flag_path} ({timestamp})")
        return jsonify({"ok": True})

    except Exception as e:
        log(f"/write-flag error: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

# -----------------------------
# Entry point
# -----------------------------
if __name__ == '__main__':
    print(f"DnD-RSR — serving from: {BASE_DIR}")
    print(f"Open http://localhost:{PORT}/  (Ctrl+C to stop)")
    print(f"Verbose logging: {'on' if VERBOSE else 'off'} (set VERBOSE=true to enable)")
    app.run(host='0.0.0.0', port=PORT, debug=False)
