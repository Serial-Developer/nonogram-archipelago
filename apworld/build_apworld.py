#!/usr/bin/env python3
"""
Package the Nonopelagram APWorld for distribution.

Usage:
    python build_apworld.py

This creates a nonopelagram.apworld file that can be installed in Archipelago.
"""

import os
import json
import zipfile
from pathlib import Path

def build_apworld():
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    world_dir = script_dir / "nonopelagram"
    output_file = script_dir / "nonopelagram.apworld"

    # Check that the world directory exists
    if not world_dir.exists():
        print(f"Error: World directory not found: {world_dir}")
        return False

    # Remove existing apworld if present
    if output_file.exists():
        output_file.unlink()
        print(f"Removed existing: {output_file}")

    # APContainer format version. The official Launcher "Build APWorlds" component (source installs
    # only) injects these into the packaged manifest automatically; we replicate it here so the
    # artifact built on a frozen install is identical. APContainer 7 ships with Archipelago 0.6.4+.
    APCONTAINER_VERSION = 7

    # Create the apworld (which is just a zip file)
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(world_dir):
            # Skip __pycache__ directories
            dirs[:] = [d for d in dirs if d != '__pycache__']

            for file in files:
                # Skip .pyc files and other unwanted files
                if file.endswith('.pyc') or file.startswith('.'):
                    continue

                file_path = Path(root) / file
                # Calculate the archive name (relative to apworld directory, with nonopelagram/ prefix)
                arcname = "nonopelagram" / file_path.relative_to(world_dir)

                if file == 'archipelago.json':
                    # Carry over the source manifest and add the APContainer version fields,
                    # matching what the official "Build APWorlds" component would produce.
                    manifest = json.loads(file_path.read_text(encoding='utf-8'))
                    manifest.setdefault('version', APCONTAINER_VERSION)
                    manifest.setdefault('compatible_version', APCONTAINER_VERSION)
                    zipf.writestr(str(arcname).replace(os.sep, '/'),
                                  json.dumps(manifest, indent=4))
                    print(f"  Added (manifest + version/compatible_version): {arcname}")
                else:
                    zipf.write(file_path, arcname)
                    print(f"  Added: {arcname}")

    print(f"\nSuccessfully created: {output_file}")
    print(f"File size: {output_file.stat().st_size} bytes")
    return True


if __name__ == "__main__":
    print("Building nonopelagram APWorld...")
    print("-" * 40)
    success = build_apworld()
    print("-" * 40)
    if success:
        print("\nTo install:")
        print("1. Copy nonopelagram.apworld to your Archipelago/custom_worlds/ folder")
        print("   OR")
        print("2. Copy the nonopelagram/ folder to Archipelago/worlds/")
    else:
        print("\nBuild failed!")
