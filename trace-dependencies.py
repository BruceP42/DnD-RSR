#!/usr/bin/env python3
# ---------------------------------------------------------
# File:         trace-dependencies.py
# Version:      V2.1
# System:       DnD-RSR — D&D 5e Dynamic Reference System
# Module/Role:  Traces all file dependencies from HTML entry
#               points in the DnD-RSR release folder. Compares
#               against the DnD personal site (the source) to
#               produce a precise list of files that need
#               copying — no dead wood from old versions.
# Usage:        python trace-dependencies.py
#               Run from the DnD-RSR directory.
#               Output: dependency-report.txt
#                       copy-missing-files.ps1
# Changelog:
#   V2.1: Added EXCLUDE_EXTENSIONS to skip .bak files.
#         Applied exclusion in both process_file() and
#         add_dynamic_dir() so .bak files never appear
#         in the report or copy script.
#         Updated SANDBOX_ROOT to DnD (renamed from D&D).
#   V2.0: Adapted for DnD-RSR public repository.
#         RELEASE_ROOT updated to DnD-RSR.
#         SANDBOX_ROOT updated to DnD personal site (source).
#         DYNAMIC_DIRS updated — removed components/.
#         Removed prefix+ pattern from extract_refs_js.
#         System name and print messages updated.
#   V1.1: Fixed sandbox path capitalisation. Added
#         templates/common, writers. Added EXCLUDE_DIRS.
#         Fixed PowerShell path quoting for & in paths.
#   V1.0: Initial version.
# ---------------------------------------------------------

import os
import re
from pathlib import Path

# ---------------------------------------------------------
# CONFIGURE THESE TWO PATHS BEFORE RUNNING
# ---------------------------------------------------------
RELEASE_ROOT = Path(r"C:\Users\bruce\OneDrive\DnD-RSR")
SANDBOX_ROOT = Path(r"C:\Users\bruce\OneDrive\DnD")

# ---------------------------------------------------------
# FILES TO ALWAYS INCLUDE
# Needed but not referenced by any HTML/JS/CSS.
# ---------------------------------------------------------
ALWAYS_INCLUDE = [
    "server.py",
    "requirements.txt",
    "pipeline-needed.flag",
    "README.md",
    ".gitignore",
]

# ---------------------------------------------------------
# DIRECTORIES TO ENUMERATE FULLY
# Files here are loaded via dynamic import() where the
# filename is constructed at runtime from URL parameters.
# Note: components/ is not in DnD-RSR (header/footer inlined).
#       css/ and images/ are traced via index.html <link> tags.
# ---------------------------------------------------------
DYNAMIC_DIRS = [
    "runtime/js/controllers",
    "runtime/js/engines",
    "runtime/js/engines/_core",
    "runtime/js/formatters",
    "runtime/js/forms",
    "runtime/js/registry",
    "runtime/js/renderers",
    "runtime/js/templates",
    "runtime/js/templates/common",
    "runtime/js/templates/common/entity",
    "runtime/js/validators",
    "runtime/js/writers",
    "runtime/js/_core",
    "pipeline",
]

# ---------------------------------------------------------
# SUBDIRECTORIES TO EXCLUDE
# Old/legacy directories that must never be copied.
# ---------------------------------------------------------
EXCLUDE_DIRS = [
    "runtime/js/controllers/Legacy",
]

# ---------------------------------------------------------
# FILE EXTENSIONS TO EXCLUDE
# Development artefacts that must never appear in the repo.
# ---------------------------------------------------------
EXCLUDE_EXTENSIONS = {'.bak'}

# ---------------------------------------------------------
# FILE EXTENSIONS TO TRACE (parse for further references)
# ---------------------------------------------------------
TRACE_EXTENSIONS = {'.html', '.js', '.css'}

# ---------------------------------------------------------
# URL PREFIXES TO SKIP (not local files)
# ---------------------------------------------------------
SKIP_PREFIXES = ('http://', 'https://', '//', 'data:', 'blob:', 'mailto:')


# =========================================================
# Reference extraction
# =========================================================

def extract_refs_html(content):
    refs = []
    refs += re.findall(r'<script[^>]+\bsrc=["\']([^"\']+)["\']', content, re.IGNORECASE)
    refs += re.findall(r'<link[^>]+\bhref=["\']([^"\']+)["\']', content, re.IGNORECASE)
    refs += re.findall(r'<img[^>]+\bsrc=["\']([^"\']+)["\']', content, re.IGNORECASE)
    refs += re.findall(r'<source[^>]+\bsrc=["\']([^"\']+)["\']', content, re.IGNORECASE)
    return refs


def extract_refs_js(content):
    refs = []
    # static import ... from '...'
    refs += re.findall(r'''import\s+(?:[\w*{},\s]+\s+from\s+)?['"](\.{1,2}/[^'"]+)['"]''', content)
    # dynamic import('...')
    refs += re.findall(r'''import\s*\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)''', content)
    # fetch('...')
    refs += re.findall(r'''fetch\s*\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)''', content)
    # Note: prefix+ pattern removed — layout-loader.js not used in DnD-RSR
    return refs


def extract_refs_css(content):
    refs = []
    refs += re.findall(r'''url\s*\(\s*['"]?([^'"\)\s]+)['"]?\s*\)''', content)
    refs += re.findall(r'''@import\s+['"]([^'"]+)['"]''', content)
    return refs


# =========================================================
# Core tracer
# =========================================================

visited = set()
needed  = set()


def is_excluded(path: Path) -> bool:
    """Returns True if path is in an excluded directory or has an excluded extension."""
    if path.suffix.lower() in EXCLUDE_EXTENSIONS:
        return True
    rel = str(path).replace('\\', '/')
    for excl in EXCLUDE_DIRS:
        if excl.lower() in rel.lower():
            return True
    return False


def resolve_ref(base_file: Path, ref: str):
    ref = ref.strip()
    if not ref or any(ref.startswith(p) for p in SKIP_PREFIXES):
        return None
    ref = ref.split('?')[0].split('#')[0]
    if not ref:
        return None
    try:
        resolved = (base_file.parent / ref).resolve()
        resolved.relative_to(RELEASE_ROOT.resolve())
        return resolved
    except (ValueError, OSError):
        return None


def process_file(file_path: Path):
    if is_excluded(file_path):
        return
    resolved = file_path.resolve()
    if resolved in visited:
        return
    visited.add(resolved)

    try:
        rel = str(resolved.relative_to(RELEASE_ROOT.resolve()))
    except ValueError:
        return

    needed.add(rel)

    if not resolved.exists():
        return

    suffix = resolved.suffix.lower()
    if suffix not in TRACE_EXTENSIONS:
        return

    try:
        content = resolved.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return

    if suffix == '.html':
        refs = extract_refs_html(content)
    elif suffix == '.js':
        refs = extract_refs_js(content)
    elif suffix == '.css':
        refs = extract_refs_css(content)
    else:
        refs = []

    for ref in refs:
        target = resolve_ref(resolved, ref)
        if target:
            process_file(target)


def add_dynamic_dir(rel_dir: str):
    """Enumerate all files in a dynamic directory, checking release first then sandbox."""
    dir_path = RELEASE_ROOT / rel_dir
    source   = dir_path if dir_path.exists() else SANDBOX_ROOT / rel_dir

    if not source.exists():
        return

    for f in sorted(source.rglob('*')):
        if not f.is_file() or is_excluded(f):
            continue
        try:
            rel_from_dyn = (
                f.relative_to(SANDBOX_ROOT)
                if SANDBOX_ROOT in f.parents
                else f.relative_to(RELEASE_ROOT)
            )
        except ValueError:
            continue
        release_equiv = RELEASE_ROOT / rel_from_dyn
        process_file(release_equiv)


# =========================================================
# PowerShell safe path (quote paths containing & or spaces)
# =========================================================

def ps_path(p):
    return f'"{p}"'


# =========================================================
# Main
# =========================================================

def main():
    print("DnD-RSR — Dependency Tracer V2.1")
    print(f"Release : {RELEASE_ROOT}")
    print(f"Source  : {SANDBOX_ROOT}")
    print()

    if not RELEASE_ROOT.exists():
        print(f"ERROR: Release directory does not exist: {RELEASE_ROOT}")
        print("Create the DnD-RSR directory first, then re-run.")
        return

    # 1. HTML entry points
    html_files = sorted(RELEASE_ROOT.rglob('*.html'))
    print(f"HTML entry points: {len(html_files)}")
    for f in html_files:
        print(f"  {f.relative_to(RELEASE_ROOT)}")
    print()

    # 2. Trace from each HTML file
    for html in html_files:
        process_file(html)

    # 3. Enumerate dynamic directories
    print("Enumerating dynamic directories...")
    for d in DYNAMIC_DIRS:
        add_dynamic_dir(d)

    # 4. Always-include files
    for rel in ALWAYS_INCLUDE:
        needed.add(rel.replace('/', os.sep))

    # 5. Classify each needed file
    ok_list      = []
    copy_list    = []
    nowhere_list = []

    for rel in sorted(needed):
        release_file = RELEASE_ROOT / rel
        if release_file.exists():
            ok_list.append(rel)
        else:
            sandbox_file = SANDBOX_ROOT / rel
            if sandbox_file.exists():
                copy_list.append(rel)
            else:
                nowhere_list.append(rel)

    # 6. Build report
    report_lines = [
        "DnD-RSR — Dependency Report V2.1",
        f"Release : {RELEASE_ROOT}",
        f"Source  : {SANDBOX_ROOT}",
        "",
        f"Total files needed : {len(needed)}",
        f"Present in release : {len(ok_list)}",
        f"Need copying       : {len(copy_list)}",
        f"Not found anywhere : {len(nowhere_list)}",
        "",
        "=" * 70,
        "FULL FILE LIST  (OK = present | COPY = missing | MISSING = not anywhere)",
        "=" * 70,
    ]
    for rel in sorted(needed):
        if (RELEASE_ROOT / rel).exists():
            report_lines.append(f"  OK      {rel}")
        elif (SANDBOX_ROOT / rel).exists():
            report_lines.append(f"  COPY    {rel}")
        else:
            report_lines.append(f"  MISSING {rel}")

    report_lines += [
        "",
        "=" * 70,
        "FILES TO COPY FROM SOURCE (DnD personal site)",
        "=" * 70,
    ]
    report_lines += (
        [f"  {r}" for r in copy_list]
        if copy_list
        else ["  (none — release is complete)"]
    )

    report_lines += [
        "",
        "=" * 70,
        "NOT FOUND IN RELEASE OR SOURCE  (investigate)",
        "=" * 70,
    ]
    report_lines += (
        [f"  {r}" for r in nowhere_list]
        if nowhere_list
        else ["  (none)"]
    )

    report_text = "\n".join(report_lines)
    print(report_text)

    report_path = RELEASE_ROOT / "dependency-report.txt"
    report_path.write_text(report_text, encoding='utf-8')
    print(f"\nReport saved to: {report_path}")

    # 7. Generate PowerShell copy script
    if copy_list:
        ps_lines = [
            "# copy-missing-files.ps1",
            "# Generated by trace-dependencies.py V2.1 for DnD-RSR",
            "# Review before running.",
            "# Copies files needed but missing from DnD-RSR release.",
            "# Files already in release are NOT touched.",
            "",
            f"$source  = {ps_path(SANDBOX_ROOT)}",
            f"$release = {ps_path(RELEASE_ROOT)}",
            "",
        ]
        for rel in copy_list:
            rel_bs = rel.replace('/', '\\')
            ps_lines += [
                f'$src = "{SANDBOX_ROOT}\\{rel_bs}"',
                f'$dst = "{RELEASE_ROOT}\\{rel_bs}"',
                r'$dir = Split-Path $dst',
                r'if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }',
                r'Copy-Item $src $dst',
                f'Write-Output "Copied: {rel_bs}"',
                "",
            ]
        ps_path_file = RELEASE_ROOT / "copy-missing-files.ps1"
        ps_path_file.write_text("\n".join(ps_lines), encoding='utf-8')
        print(f"Copy script saved to: {ps_path_file}")
        print("Review copy-missing-files.ps1 then run it in PowerShell.")
    else:
        print("No files to copy — release is complete.")


if __name__ == '__main__':
    main()
