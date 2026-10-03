#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import tempfile
import platform
import glob
import json
import urllib.request
from pathlib import Path

from games import GAMES

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
                cwd=exe_dir
            )
            return True
        except subprocess.CalledProcessError as e:
            err = f"exit code {e.returncode}, see its output above"
            print(f"Warning: innoextract failed: {err}", file=sys.stderr)

    # Fallback to 7-Zip (works very well with exe+bin multi-part installers)
    seven_zip = find_tool(["7z", "7zz", "7za"])
    if seven_zip:
        try:
            subprocess.run(
                [seven_zip, "x", exe_name, f"-o{temp_dir}", "-y", "-bsp1"],
                check=True,
                cwd=exe_dir
            )
            return True
        except subprocess.CalledProcessError as e:
            err = f"exit code {e.returncode}, see its output above"
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
            cwd=sh_dir
        )
        return True
    except subprocess.CalledProcessError as e:
        err = f"exit code {e.returncode}, see its output above"
        print(f"Warning: Self-extraction failed: {err}", file=sys.stderr)

    # Fallback to 7-Zip
    seven_zip = find_tool(["7z", "7zz", "7za"])
    if seven_zip:
        try:
            subprocess.run(
                [seven_zip, "x", sh_name, f"-o{temp_dir}", "-y"],
                check=True,
                cwd=sh_dir
            )
            return True
        except subprocess.CalledProcessError as e:
            err = f"exit code {e.returncode}, see its output above"
            print(f"Warning: 7-Zip failed: {err}", file=sys.stderr)

    print("Error: Could not extract .sh file.", file=sys.stderr)
    return False

def detect_game(installer_name):
    """The game whose installer name prefix matches, or None."""
    name = installer_name.lower()
    for game in GAMES:
        if name.startswith(game["installer"]):
            return game
    return None

def newest_vpk(releases, vpk_name):
    """Tag and URL of the newest release that ships the VPK, pre-releases included."""
    for release in releases:
        if release.get("draft"):
            continue
        for asset in release.get("assets", []):
            if asset.get("name") == vpk_name:
                return release["tag_name"], asset["browser_download_url"]
    return None

def download_vpk(game, output_parent):
    """Download the newest VPK next to the data folder. A failure only warns: the game data is already done."""
    vpk = game["vpk"]
    page = f"https://github.com/{game['repo']}/releases"
    try:
        api = f"https://api.github.com/repos/{game['repo']}/releases"
        with urllib.request.urlopen(api, timeout=30) as response:
            found = newest_vpk(json.load(response), vpk)
        if found is None:
            print(f"Warning: no release ships {vpk}; get it from {page}", file=sys.stderr)
            return None
        tag, url = found
        print(f"Downloading {vpk} {tag}...", flush=True)
        part = output_parent / (vpk + ".part")
        urllib.request.urlretrieve(url, part)
        part.replace(output_parent / vpk)
        return tag
    except (OSError, ValueError) as e:
        print(f"Warning: could not download {vpk} ({e}); get it from {page}", file=sys.stderr)
        return None

def choose(question, labels):
    """Ask for one of labels by number; returns its index."""
    for n, label in enumerate(labels, 1):
        print(f"  {n}) {label}")
    while True:
        answer = input(f"{question} [1-{len(labels)}]: ").strip()
        if answer.isdigit() and 1 <= int(answer) <= len(labels):
            return int(answer) - 1

def link(url):
    """A URL the terminal makes clickable; OSC 8 for the ones that do not detect bare URLs."""
    return f"\033]8;;{url}\033\\{url}\033]8;;\033\\" if sys.stdout.isatty() else url

def pick_installer(gog_dir):
    """(installer, game or None) from gog/, asking which one when there are several.

    With an empty gog/ it asks which game, points at its GOG page and waits
    for the installer to be dragged in.
    """
    found = sorted(gog_dir.glob("setup_*.exe")) + sorted(gog_dir.glob("*.sh"))
    if len(found) == 1:
        return found[0], None
    if found:
        print(f"Installers in {gog_dir}:")
        return found[choose("Which one", [f.name for f in found])], None

    print(f"No installer in {gog_dir}. Which game do you want on the Vita?")
    game = GAMES[choose("Game", [f"{g['title']} for {g['port']}" for g in GAMES])]
    print()
    if input("Do you already own it on GOG? [y/N]: ").strip().lower().startswith("y"):
        print(f"Download the offline installer (signed in):  {link(game['download'])}")
    else:
        print(f"Buy it on GOG first:  {link(game['gog'])}")
        print(f"then download the offline installer:  {link(game['download'])}")
    print(f"Put the .exe and its .bin files in {gog_dir}, or drag the .exe here.")
    print()
    # read the way a terminal pastes a dragged-in file: quoted or with backslash escapes
    answer = input("Path to the setup_*.exe (Enter to look in gog/ again): ").strip().strip("'\"")
    if answer:
        return Path(answer.replace("\\ ", " ").replace("\\(", "(").replace("\\)", ")")), game
    found = sorted(gog_dir.glob(f"{game['installer']}*.exe"))
    return (found[0] if found else None), game

def main():
    if len(sys.argv) > 2 or sys.argv[1:] in (["-h"], ["--help"]):
        print("Usage: python3 extract_for_vita.py [path_to_gog_installer.exe]")
        print("\nWithout a path it takes the installer from gog/, asking which one if there are several.")
        print("\nSupported games:")
        for game in GAMES:
            print(f"  {game['installer']}*  {game['title']} for {game['port']}")
        print("\nIMPORTANT: Keep the .exe AND all matching -*.bin files in the same folder!")
        sys.exit(1)

    script_dir = Path(__file__).parent.resolve()
    if len(sys.argv) == 2:
        installer_path, game = Path(sys.argv[1]), None
    else:
        installer_path, game = pick_installer(script_dir / "gog")
    if installer_path is None:
        print("Error: no installer given", file=sys.stderr)
        sys.exit(1)
    installer_path = installer_path.expanduser().resolve()

    if not installer_path.exists():
        print(f"Error: Installer not found: {installer_path}", file=sys.stderr)
        sys.exit(1)

    game = detect_game(installer_path.name) or game
    if game is None:
        print(f"{installer_path.name} is not a name this script knows. Which game is it?")
        game = GAMES[choose("Game", [f"{g['title']} for {g['port']}" for g in GAMES])]

    output_parent = script_dir / game["out"]
    output_data_dir = output_parent / game["data"]

    print(f"Extracting GOG installer: {installer_path.name} ({game['title']})")
    print(f"Working directory: {installer_path.parent}")
    print(f"Output will be: {output_data_dir}")
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

        print(f"Extraction complete! Collecting {game['port']} game files...")
        copied, missing = game["collect"](temp_dir, output_data_dir)

        print()
        print("=== Extraction Summary ===")
        if copied:
            print("Copied files/directories:")
            for item in sorted(set(copied)):
                print(f"  - {item}")

        if missing:
            print("\nWarning: Missing required files:")
            for item in missing:
                print(f"  - {item}")
            print("\nYour installation may be incomplete. Verify your GOG download is intact.")
            print("Nothing was written to the output folder.")
            sys.exit(1)

        print("\nAll required files were found!")
        print()
        vpk_tag = download_vpk(game, output_parent)

        vpk, out, data = game["vpk"], game["out"], game["data"]
        print()
        print("=== READY FOR PS VITA ===")
        print(f"Game data prepared at: {output_parent}")
        print()
        print("Transfer steps:")
        if vpk_tag:
            print(f"1. Install {out}/{vpk} ({vpk_tag}) with VitaShell")
        else:
            print(f"1. Install {vpk} from https://github.com/{game['repo']}/releases with VitaShell")
        print(f"2. Copy the contents of '{out}/{data}/' so they end up in")
        print(f"   {game['vita_path']} (create the folder if needed)")
        if game["note"]:
            print()
            print(game["note"])

if __name__ == "__main__":
    main()
