# Hollow Knight

Builds _[Hollow Knight](https://store.steampowered.com/app/367520/Hollow_Knight/)_ for [PatnosDD's PS Vita port](https://github.com/PatnosDD/Hollow-Knight-PsVita) on macOS and Linux. It does what the port's `APPLYPATCH.bat` does, minus Windows.

**Steam only for now.** The port's V1.0 ships no GOG patch, and its older GOG patch was made before GOG's current build 1.5.12620 ([issue #31](https://github.com/PatnosDD/Hollow-Knight-PsVita/issues/31)). The GOG entry in `src/game/hollow_knight.ts` waits for the size and SHA-256 the next GOG `APPLYPATCH.bat` prints.

## How the patch works

`APPLYPATCH.bat` stores the game's `hollow_knight_Data` in a zip with [deterministic-zip](https://github.com/timo-reymann/deterministic-zip) 2.1.0, then runs `xdelta3` on that zip. The patch applies only to the exact bytes the Windows tool writes. The same tool run on macOS writes `/` where Windows writes `\`, sorts the files another way and stores other file modes. So the extractor writes the Windows bytes itself, and needs nothing from the patch but its `.vcdiff`.

## Usage

### 1. Lay out the patch folder

Download `HollowKnightVitaSTEAM.zip` from the [port's releases](https://github.com/PatnosDD/Hollow-Knight-PsVita/releases), extract it into `games-gog/`, and copy your `Hollow Knight` folder from `steamapps/common/` into it, as the port's README says:

```text
games-gog/
└── HollowKnightVitaPatchSteam/
    ├── Hollow Knight/      ← from steamapps/common, unmodified
    ├── vcdiff/
    └── APPLYPATCH.bat      ← not used here
```

The patch is made from the **Windows** build. Steam on macOS installs the macOS one, `hollow_knight.app`, which does not work. Get the Windows files with `download_depot` in the Steam console (`steam://open/console`), using the Windows depot from [SteamDB](https://steamdb.info/app/367520/depots/). On Linux, a Proton install already is the Windows build.

### 2. Run the extractor

```bash
make extract
```

Pick Hollow Knight. It needs `xdelta3` and 7-Zip, and offers to install them. It also needs about 7 GB free in the temp folder, for the game's zip and the patched one. Patching takes 10 to 25 minutes.

It stops before patching when your zip is not the 5 181 410 649 bytes the patch expects, which means another game version or modified files. It also checks the result against the SHA-256 the port publishes.

### 3. Install it on the Vita

```text
games-vita/hollowknight/
├── HollowKnight.vpk   ← the newest release, downloaded on every run
└── HKVT12222/         ← its contents go to ux0:app/HKVT12222/
```

1. Install `HollowKnight.vpk` with [VitaShell](https://github.com/TheOfficialFloW/VitaShell), and do not start it yet.
2. Copy the contents of `games-vita/hollowknight/HKVT12222/` (`Media/`, `sce_module/`, `sce_sys/`, `archive.psarc`, `eboot.bin`) into `ux0:app/HKVT12222/`, replacing the files when asked.
3. Install the `ioplus.skprx` plugin and overclock the CPU to 500 MHz, then start the game.

## Credits

[Hollow-Knight-PsVita](https://github.com/PatnosDD/Hollow-Knight-PsVita) by PatnosDD.
