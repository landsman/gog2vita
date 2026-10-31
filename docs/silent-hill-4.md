# Silent Hill 4: The Room

Prepares your GOG.com copy of *[Silent Hill 4: The Room](https://www.gog.com/en/game/silent_hill_4_the_room)* for [sh4vita](https://github.com/vallfrr/sh4vita), a native PS Vita port. The preparing is done by the port's own `sh4prep`, which the script downloads and runs.

Only version **1.0 gog v5** works, because the VPK is recompiled from that exact executable; `sh4prep` rejects any other.

## Usage

### 1. Put the game in `games-gog/`

Either the offline installer from [your GOG library](https://www.gog.com/en/account), with any `-*.bin` parts, or a folder named `sh4` holding the installed game, `SILENT HILL 4.exe` next to `data/`, `demo/`, `movie/` and `sound/`:

```text
games-gog/
└── setup_silent_hill_4_the_room_1.0_gog_v5_(80750).exe
```

### 2. Run the extractor

See [Usage in the README](../README.md#usage). The game language defaults to English; `SH4_LANGUAGE=German make extract` picks another of French, English, German, Italian and Spanish.

`sh4prep` has builds for Apple Silicon macOS, x86-64 Linux and Windows. Elsewhere the script stops; build `tools/sh4prep` from the port's source.

### 3. Install sh4vita and copy the game data

You need a hacked PS Vita with about 4 GB free on `ux0:` and `ur0:data/libshacccg.suprx`; if it is missing, install it with [ShaRKF00D](https://github.com/Rinnegatamante/ShaRKF00D). After extraction you'll find:

```text
games-vita/sh4vita/
├── sh4vita.vpk   ← the newest release, downloaded on every run
└── sh4/          ← the folder for ux0:data/
```

1. Install `games-vita/sh4vita/sh4vita.vpk` with [VitaShell](https://github.com/TheOfficialFloW/VitaShell).
2. Copy the `games-vita/sh4vita/sh4/` folder into `ux0:data/`, over USB rather than FTP, which is much slower.
3. Start Silent Hill 4 from LiveArea.

Saves stay in `ux0:data/sh4/save/`. Anything else, including controls and known problems, is in the [port's README](https://github.com/vallfrr/sh4vita#readme).

## Credits

[sh4vita](https://github.com/vallfrr/sh4vita) by vallfrr.
