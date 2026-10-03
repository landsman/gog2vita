# Medal of Honor: Allied Assault

Extracts the game data from your GOG.com copy of *Medal of Honor: Allied Assault* and prepares it for [OpenMoHAA for PS Vita](https://github.com/HenryKun55/openmohaa), HenryKun55's Vita port of [OpenMoHAA](https://github.com/openmoh/openmohaa).

GOG ships it as a multi-part installer (`.exe` + `-*.bin` files); the extractor picks the parts up and creates a ready-to-transfer `main/` folder.

## Usage

### 1. Download your GOG installer files

From your GOG account, download the offline backup installer for *[Medal of Honor: Allied Assault](https://www.gog.com/en/account)* and put the files in the `gog/` folder of this repository. For recent versions, that looks like this:

```text
gog/
├── setup_medal_of_honor_2.0.0.21.exe
├── setup_medal_of_honor_2.0.0.21-1.bin
└── setup_medal_of_honor_2.0.0.21-2.bin
```

> [!IMPORTANT]
> Keep the `.exe` and **all** matching `-*.bin` files together, and only one installer version in `gog/` at a time. Git ignores everything in `gog/`, so the game files are never committed.

### 2. Run the extractor

See [Usage in the README](../README.md#usage).

### 3. Install OpenMoHAA Vita and copy the game data

These steps follow the port's [install guide](https://github.com/HenryKun55/openmohaa/blob/vita-port/docs/PORTING-VITA.md#install-on-the-vita). You need a homebrew-capable PS Vita with `ur0:data/libshacccg.suprx`, the Vita's shader compiler; if it is missing, install and run [ShaRKF00D](https://github.com/Rinnegatamante/ShaRKF00D) once, or the menu shows only white outlines.

After extraction completes, you'll find a new folder in this repository:

```text
openmohaa/
├── OpenMoHAA.vpk   ← the newest release of the port, downloaded on every run
└── main/           ← the game data, laid out like ux0:data/openmohaa/main/ on the Vita
```

1. The script downloads `OpenMoHAA.vpk` from the newest [release of the port](https://github.com/HenryKun55/openmohaa/releases), so a run always brings the current version; installing it over an older one keeps settings and saves. If the download fails, it says so and the game data is still complete; get the VPK from that page yourself.
2. Install `openmohaa/OpenMoHAA.vpk` with [VitaShell](https://github.com/TheOfficialFloW/VitaShell).
3. In VitaShell, connect over USB or FTP and copy the extracted `openmohaa/main/` folder so it ends up as:

   ```text
   ux0:data/openmohaa/main/
   ```

   Create `ux0:data/openmohaa/` first if it doesn't exist.
4. Launch OpenMoHAA from LiveArea.

> [!NOTE]
> Do **not** copy `configs/` or `save/` folders from a computer installation. The port creates its own on first launch.

The release also offers optional `lang_*.pk3` packs that translate the menu pictures into Portuguese, Spanish, French, German or Italian. The script does not download them; copy the one you want next to the paks in `ux0:data/openmohaa/main/`.

## What Gets Extracted

The script collects the files the port's [install guide](https://github.com/HenryKun55/openmohaa/blob/vita-port/docs/PORTING-VITA.md#install-on-the-vita) asks for, from the base game's `main/` folder only:

| File or folder | Requirement | Notes |
|---|---|---|
| `Pak0.pk3` – `Pak3.pk3` | Required | Base-game data. |
| `Pak4.pk3` – `Pak5.pk3` | Required | Data from the official 1.11 update. |
| Other `Pak*.pk3` files | Copied when present | Language and additional official data such as `Pak6EnUk.pk3` or `pak7.pk3`. |
| `music/` | Copied when present | Loose background-music files stored outside the paks. |
| `sound/` | Copied when present | Loose audio, copied with its subfolders and file names as the installer has them. |
| `video/` | Copied when present | RoQ intro and cinematic files stored outside the paks. |

If the installer also carries the expansions (`mainta/`, `maintt/`), their files are left out.

## Troubleshooting

- **Missing BIN files**: Ensure all `-*.bin` files are in the same folder as the `.exe`. The script will list detected BINs when it runs.
- **Only white outlines in the menu**: `libshacccg.suprx` is missing; run [ShaRKF00D](https://github.com/Rinnegatamante/ShaRKF00D) once.
- **Something else goes wrong on the Vita**: see the port's [how to report a problem](https://github.com/HenryKun55/openmohaa/issues/2) and attach `ux0:data/openmohaa/main/boot.log`.

## Credits

This extractor prepares GOG copies for [OpenMoHAA for PS Vita](https://github.com/HenryKun55/openmohaa) by [HenryKun55](https://github.com/HenryKun55), built on [OpenMoHAA](https://github.com/openmoh/openmohaa).
