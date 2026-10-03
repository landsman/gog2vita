import shutil

MPQS = ["diabdat.mpq", "hellfire.mpq", "hfmonk.mpq", "hfmusic.mpq", "hfvoice.mpq"]

def collect(source_dir, output_dir):
    """Copy DIABDAT.MPQ and, when the installer has Hellfire, its four MPQs."""
    found = {}
    for mpq in source_dir.rglob("*"):
        # ponytail: first match wins; GOG ships each of these MPQs once
        if mpq.name.lower() in MPQS and mpq.is_file():
            found.setdefault(mpq.name.lower(), mpq)

    if "diabdat.mpq" not in found:
        return [], ["DIABDAT.MPQ"]

    # Start from an empty folder, so nothing from an earlier run is left behind
    shutil.rmtree(output_dir, ignore_errors=True)
    output_dir.mkdir(parents=True)

    copied = []
    for name in MPQS:
        if name in found:
            print(f"  copying {found[name].name}", flush=True)
            shutil.copy2(found[name], output_dir / found[name].name)
            copied.append(found[name].name)
    return copied, []

GAME = {
    "installer": "setup_diablo",
    "title": "Diablo + Hellfire",
    "gog": "https://www.gog.com/en/game/diablo",
    # signed-in GOG link that starts the offline installer download
    "download": "https://www.gog.com/downloads/diablo/en1installer0",
    "port": "DevilutionX",
    "out": "devilutionx",
    "data": "devilution",
    "vita_path": "ux0:data/diasurgical/devilution/",
    "repo": "diasurgical/devilutionX",
    "vpk": "devilutionx-vita.vpk",
    "collect": collect,
    "note": "",
}
