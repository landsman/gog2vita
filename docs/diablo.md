# Diablo + Hellfire

Extracts the game data from your GOG.com copy of *[Diablo + Hellfire](https://www.gog.com/en/game/diablo)* and prepares it for [DevilutionX](https://github.com/diasurgical/devilutionX), which runs on the PS Vita among many other systems.

## Usage

### 1. Download your GOG installer

Download the offline installer, signed in to GOG: <https://www.gog.com/downloads/diablo/en1installer0>. It is a single `.exe`, for example:

```text
gog/
└── setup_diablo_1.09_hellfire_v4_(78466).exe
```

### 2. Run the extractor

See [Usage in the README](../README.md#usage).

### 3. Install DevilutionX and copy the game data

These steps follow DevilutionX's [install guide](https://github.com/diasurgical/devilutionX/blob/master/docs/installing.md). After extraction you'll find:

```text
diasurgical/
├── devilutionx-vita.vpk   ← the newest release, downloaded on every run
└── devilution/            ← the MPQ files for ux0:data/diasurgical/devilution/
```

1. The script downloads `devilutionx-vita.vpk` from the newest [DevilutionX release](https://github.com/diasurgical/devilutionX/releases). If the download fails, it says so and the game data is still complete; get the VPK from that page yourself.
2. Install `diasurgical/devilutionx-vita.vpk` with [VitaShell](https://github.com/TheOfficialFloW/VitaShell).
3. In VitaShell, connect over USB or FTP and copy the `diasurgical/devilution/` folder into `ux0:data/`, so the files end up in `ux0:data/diasurgical/devilution/`.
4. Launch DevilutionX from LiveArea.

## What Gets Extracted

| File | Requirement | Notes |
|---|---|---|
| `DIABDAT.MPQ` | Required | The base game. |
| `hellfire.mpq`, `hfmonk.mpq`, `hfmusic.mpq`, `hfvoice.mpq` | Copied when present | The Hellfire expansion. |

The rest of the installer — the original Windows executables, DirectX redistributables, manuals and `Patch_rt.mpq` — is left out.

DevilutionX's guide also lists optional MPQs from [devilutionx-assets](https://github.com/diasurgical/devilutionx-assets/releases/latest): `fonts.mpq` for Chinese, Korean and Japanese text, and `pl.mpq` or `ru.mpq` for Polish or Russian voices. The script does not download them; copy the one you need next to the others.

## Credits

[DevilutionX](https://github.com/diasurgical/devilutionX) by the diasurgical team.
