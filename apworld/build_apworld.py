#!/usr/bin/env python3
"""
Package the Nonopelagram APWorld for distribution.

Usage:
    python build_apworld.py

This creates a nonopelagram.apworld file that can be installed in Archipelago.
"""

import os
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
