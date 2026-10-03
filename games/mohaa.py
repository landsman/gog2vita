import shutil

PAKS = ["Pak0", "Pak1", "Pak2", "Pak3", "Pak4", "Pak5"]

def find_main_dir(source_dir):
    """Find the base game's main/ folder, the one holding Pak0.

    The installer also ships the expansions (mainta/, maintt/) with their own
    pak files, which must not end up in the base game's folder.
    """
    for pak in source_dir.rglob("Pak0*.pk3"):
        if pak.parent.name.lower() == "main":
            return pak.parent
    return None

def collect(source_dir, output_dir):
    """Copy the paks and loose music/sound/video from the base game's main/."""
    main_dir = find_main_dir(source_dir)
    if main_dir is None:
        return [], [f"{p}*.pk3" for p in PAKS]

    missing = [f"{p}*.pk3" for p in PAKS if not any(main_dir.glob(f"{p}*.pk3"))]
    if missing:
        return [], missing

    # Start from an empty folder, so nothing from an earlier run is left behind
    shutil.rmtree(output_dir, ignore_errors=True)
    output_dir.mkdir(parents=True)

    copied = []
    for item in sorted(main_dir.glob("*.pk3")):
        print(f"  copying {item.name}", flush=True)
        shutil.copy2(item, output_dir / item.name)
        copied.append(item.name)

    for dir_name in ["sound", "music", "video"]:
        item = main_dir / dir_name
        if item.is_dir():
            print(f"  copying {dir_name}/", flush=True)
            shutil.copytree(item, output_dir / dir_name)
            copied.append(f"{dir_name}/")

    return copied, missing

GAME = {
    "installer": "setup_medal_of_honor",
    "title": "Medal of Honor: Allied Assault",
    "gog": "https://www.gog.com/en/game/medal_of_honor_allied_assault_war_chest",
    # several parts (.exe + .bin), so the library page rather than one direct link
    "download": "https://www.gog.com/en/account",
    "port": "OpenMoHAA",
    "out": "openmohaa",
    "data": "main",
    "vita_path": "ux0:data/openmohaa/main/",
    "repo": "HenryKun55/openmohaa",
    "vpk": "OpenMoHAA.vpk",
    "collect": collect,
    "note": "Do NOT copy configs/ or save/ folders. OpenMoHAA Vita generates those automatically.",
}
