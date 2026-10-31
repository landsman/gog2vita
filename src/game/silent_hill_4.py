import platform
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

EXE = "SILENT HILL 4.exe"
REPO = "vallfrr/sh4vita"
LANGUAGES = ["English", "French", "German", "Italian", "Spanish"]
PREPARERS = {
    ("Darwin", "arm64"): "sh4prep-macos",
    ("Linux", "x86_64"): "sh4prep-linux",
    ("Windows", "AMD64"): "sh4prep-windows.exe",
}

def ask_language():
    """English on a plain Enter, since most runs want it."""
    for n, language in enumerate(LANGUAGES, 1):
        print(f"  {n}) {language}")
    while True:
        answer = input(f"Game language [1-{len(LANGUAGES)}, Enter for {LANGUAGES[0]}]: ").strip()
        if not answer:
            return LANGUAGES[0]
        if answer.isdigit() and 1 <= int(answer) <= len(LANGUAGES):
            return LANGUAGES[int(answer) - 1]

def collect(source_dir, output_dir):
    """Run the port's own preparer, which rejects any exe but GOG v5 and writes the index the VPK checks.

    It is not reimplemented here: the index and manifest format belong to the port and move with its VPK.
    """
    exe = next(source_dir.rglob(EXE), None)
    if exe is None:
        return [], [EXE]

    asset = PREPARERS.get((platform.system(), platform.machine()))
    if asset is None:
        sys.exit(f"Error: {REPO} ships no sh4prep for {platform.system()} {platform.machine()}; build tools/sh4prep from its source.")

    language = ask_language()
    with tempfile.TemporaryDirectory() as tmp:
        preparer = Path(tmp) / asset
        print(f"Downloading {asset}...", flush=True)
        try:
            # ponytail: latest skips pre-releases, unlike the VPK; pair them if the port starts shipping those
            urllib.request.urlretrieve(f"https://github.com/{REPO}/releases/latest/download/{asset}", preparer)
        except OSError as e:
            sys.exit(f"Error: could not download {asset} ({e})")
        preparer.chmod(0o755)
        output_dir.parent.mkdir(parents=True, exist_ok=True)
        # writes <output_dir.parent>/sh4/; a rerun skips the files already copied
        result = subprocess.run([str(preparer), str(exe.parent), str(output_dir.parent), language])
    if result.returncode != 0:
        sys.exit(f"Error: sh4prep failed with exit code {result.returncode}, see its output above.")
    return [EXE, "data/", "demo/", "movie/", "sound/", "files.idx", "sh4vita.json"], []

GAME = {
    "installer": "setup_silent_hill_4",
    "folder": "sh4",
    "innoextract": ["--gog"],
    "title": "Silent Hill 4: The Room",
    "gog": "https://www.gog.com/en/game/silent_hill_4_the_room",
    # the port accepts only 1.0 gog v5, so the library page rather than one direct link
    "download": "https://www.gog.com/en/account",
    "port": "sh4vita",
    "out": "games-vita/sh4vita",
    "data": "sh4",
    "vita_path": "ux0:data/sh4/",
    "repo": REPO,
    "vpk": "sh4vita.vpk",
    "collect": collect,
    "note": "Needs ur0:data/libshacccg.suprx (install it with ShaRKF00D) and about 4 GB free on ux0:.",
}
