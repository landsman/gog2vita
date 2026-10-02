#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import tempfile
import platform
import glob
from pathlib import Path

REQUIRED_PAKS_PREFIX = ["Pak0", "Pak1", "Pak2", "Pak3", "Pak4", "Pak5"]
OPTIONAL_DIRS = ["sound", "music", "video"]

def find_tool(command_names):
    """Find an executable tool from a list of possible command names."""
    for cmd in command_names:
        if shutil.which(cmd):
            return cmd
    return None

def extract_exe(installer_path, temp_dir):
    """Extract a Windows .exe installer (InnoSetup), supporting multi-part .bin files."""
    exe_dir = installer_path.parent
    exe_name = installer_path.name
    base_name = installer_path.stem

    # Detect multi-part bin files
    bin_files = sorted(glob.glob(str(exe_dir / f"{base_name}-*.bin")))
    
    if bin_files:
        print(f"Detected {len(bin_files)} multi-part BIN file(s):")
        for bf in bin_files:
            print(f"  - {Path(bf).name}")
        print()

    # Try innoextract first (best for InnoSetup)
    innoextract = find_tool(["innoextract"])
    if innoextract:
        try:
            subprocess.run(
                [innoextract, exe_name, "-d", str(temp_dir)],
                check=True,
                capture_output=True,
                text=True,
                cwd=exe_dir
            )
            return True
        except subprocess.CalledProcessError as e:
            err = e.stderr.strip() if e.stderr else e.stdout.strip()
            print(f"Warning: innoextract failed: {err}", file=sys.stderr)

    # Fallback to 7-Zip (works very well with exe+bin multi-part installers)
    seven_zip = find_tool(["7z", "7zz", "7za"])
    if seven_zip:
        try:
            subprocess.run(
                [seven_zip, "x", exe_name, f"-o{temp_dir}", "-y"],
                check=True,
                capture_output=True,
                text=True,
                cwd=exe_dir
            )
            return True
        except subprocess.CalledProcessError as e:
            err = e.stderr.strip() if e.stderr else e.stdout.strip()
            print(f"Warning: 7-Zip failed: {err}", file=sys.stderr)

    print("Error: Could not extract .exe file.", file=sys.stderr)
    print("Ensure the following are installed and in your PATH:", file=sys.stderr)
    print("  - innoextract (recommended): brew/apt/choco install innoextract", file=sys.stderr)
    print("  - or 7-Zip: brew install p7zip / apt install p7zip-full / choco install 7zip", file=sys.stderr)
    print("\nAlso make sure ALL .bin files are in the same folder as the .exe!", file=sys.stderr)
    return False

def extract_sh(installer_path, temp_dir):
    """Extract a Linux .sh installer."""
    sh_dir = installer_path.parent
    sh_name = installer_path.name

    # Try unzip first (common for GOG sh files)
    unzip_tool = find_tool(["unzip"])
    if unzip_tool:
        try:
            subprocess.run(
                [unzip_tool, "-o", sh_name, "-d", str(temp_dir)],
                check=True,
                capture_output=True,
                text=True,
                cwd=sh_dir
            )
            return True
        except subprocess.CalledProcessError:
            print("unzip failed, trying self-extraction method...", file=sys.stderr)

    # Try self-extraction with --noexec
    try:
        if platform.system() != "Windows":
            os.chmod(installer_path, 0o755)

        subprocess.run(
            [str(installer_path), "--noexec", "--target", str(temp_dir)],
            check=True,
            capture_output=True,
            text=True,
            cwd=sh_dir
        )
        return True
    except subprocess.CalledProcessError as e:
        err = e.stderr.strip() if e.stderr else ""
        print(f"Warning: Self-extraction failed: {err}", file=sys.stderr)

    # Fallback to 7-Zip
    seven_zip = find_tool(["7z", "7zz", "7za"])
    if seven_zip:
        try:
            subprocess.run(
                [seven_zip, "x", sh_name, f"-o{temp_dir}", "-y"],
                check=True,
                capture_output=True,
                text=True,
                cwd=sh_dir
            )
            return True
        except subprocess.CalledProcessError as e:
            err = e.stderr.strip() if e.stderr else e.stdout.strip()
            print(f"Warning: 7-Zip failed: {err}", file=sys.stderr)

    print("Error: Could not extract .sh file.", file=sys.stderr)
    return False

def copy_required_files(source_dir, output_main_dir):
    """Copy all required and optional OpenMoHAA Vita files."""
    copied_items = []
    missing_required = []

    # Copy required PAKs (Pak0 - Pak5)
    for pak_prefix in REQUIRED_PAKS_PREFIX:
        found = False
        for item in source_dir.rglob(f"{pak_prefix}*.pk3"):
            shutil.copy2(item, output_main_dir / item.name)
            copied_items.append(item.name)
            found = True
            break
        if not found:
            missing_required.append(f"{pak_prefix}*.pk3")

    # Copy all other Pak*.pk3 files (optional but recommended)
    for item in source_dir.rglob("*.pk3"):
        if item.name not in copied_items:
            shutil.copy2(item, output_main_dir / item.name)
            copied_items.append(item.name)

    # Copy optional directories (preserve structure, case-sensitive safe)
    for dir_name in OPTIONAL_DIRS:
        for item in source_dir.rglob(dir_name):
            if item.is_dir():
                dest_dir = output_main_dir / item.name
                if dest_dir.exists():
                    shutil.rmtree(dest_dir)
                shutil.copytree(item, dest_dir, dirs_exist_ok=False)
                copied_items.append(f"{dir_name}/")
                break

    return copied_items, missing_required

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 extract_mohaa_for_vita.py <path_to_gog_installer.exe>")
        print("\nExamples:")
        print("  python3 extract_mohaa_for_vita.py ~/Downloads/setup_medal_of_honor_2.0.0.21.exe")
        print("  python3 extract_mohaa_for_vita.py \"C:\\Downloads\\setup_medal_of_honor_2.0.0.23.exe\"")
        print("\nIMPORTANT: Keep the .exe AND all matching -*.bin files in the same folder!")
        sys.exit(1)

    installer_path = Path(sys.argv[1]).resolve()

    if not installer_path.exists():
        print(f"Error: Installer not found: {installer_path}", file=sys.stderr)
        sys.exit(1)

    script_dir = Path(__file__).parent.resolve()
    output_parent = script_dir / "OpenMoHAA_Vita_GameData"
    output_main_dir = output_parent / "main"
    output_main_dir.mkdir(parents=True, exist_ok=True)

    print(f"Extracting GOG installer: {installer_path.name}")
    print(f"Working directory: {installer_path.parent}")
    print(f"Output will be: {output_main_dir}")
    print()

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        success = False

        ext = installer_path.suffix.lower()
        if ext == ".exe":
            success = extract_exe(installer_path, temp_dir)
        elif ext == ".sh":
            success = extract_sh(installer_path, temp_dir)
        else:
            print(f"Error: Unsupported installer type: {ext}", file=sys.stderr)
            sys.exit(1)

        if not success:
            print("\nExtraction failed. Exiting.", file=sys.stderr)
            sys.exit(1)

        print("Extraction complete! Collecting OpenMoHAA Vita game files...")
        copied, missing = copy_required_files(temp_dir, output_main_dir)

        print()
        print("=== Extraction Summary ===")
        if copied:
            unique_copied = sorted(set(copied))
            print("Copied files/directories:")
            for item in unique_copied:
                print(f"  - {item}")

        if missing:
            print("\nWarning: Missing required files:")
            for item in missing:
                print(f"  - {item}")
            print("\nYour installation may be incomplete. Verify your GOG download is intact.")
        else:
            print("\nAll required PAK files (Pak0–Pak5) were found!")

        print()
        print("=== READY FOR PS VITA ===")
        print(f"Game data prepared at: {output_parent}")
        print()
        print("Transfer steps:")
        print("1. Open VitaShell on your PS Vita (USB or FTP)")
        print("2. Go to: ux0:data/openmohaa/")
        print("   (Create 'openmohaa' folder if it doesn't exist)")
        print("3. Drag and drop the 'main' folder from 'OpenMoHAA_Vita_GameData/'")
        print("   directly into ux0:data/openmohaa/")
        print()
        print("Do NOT copy configs/ or save/ folders. OpenMoHAA Vita generates those automatically.")

if __name__ == "__main__":
    main()
