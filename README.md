# GOG to PS Vita extractor

A cross-platform one-command script that takes the offline installer of a game you own on GOG.com, pulls out the game data a PS Vita port needs, and downloads the newest VPK of that port next to it.

> [!IMPORTANT]
> This tool is for use with your own legally purchased copies of the games. It does not provide or distribute any game data.

## Supported games

| Game | Vita port | Data on the Vita | Guide |
|---|---|---|---|
| [Medal of Honor: Allied Assault](https://www.gog.com/en/game/medal_of_honor_allied_assault_war_chest) | [OpenMoHAA](https://github.com/HenryKun55/openmohaa) | `ux0:data/openmohaa/main/` | [docs/mohaa.md](docs/mohaa.md) |
| [Diablo + Hellfire](https://www.gog.com/en/game/diablo) | [DevilutionX](https://github.com/diasurgical/devilutionX) | `ux0:data/diasurgical/devilution/` | [docs/diablo.md](docs/diablo.md) |

Each game is one module in [`games/`](games/); adding a game means adding a module there and listing it in `games/__init__.py`.

## Supported Platforms

- macOS
- Linux
- Windows

## Requirements

You need at least one of the following extraction tools installed and available in your PATH:

| Tool | Recommended For | Installation |
|---|---|---|
| [`innoextract`](https://constexpr.org/innoextract/) | Windows `.exe` installers (best) | **macOS:** `brew install innoextract` • **Linux:** `sudo apt install innoextract` • **Windows:** `choco install innoextract` |
| [`7-Zip`](https://www.7-zip.org/) (`7z`) | Fallback for multi-part installers | **macOS:** `brew install p7zip` • **Linux:** `sudo apt install p7zip-full` • **Windows:** [Download from 7-zip.org](https://www.7-zip.org/) (add to PATH) |
| [`unzip`](https://linux.die.net/man/1/unzip) | Linux `.sh` installers | Usually pre-installed on most systems |

On macOS and Linux, `make tools` shows which of these are installed, and `make deps` installs innoextract and 7-Zip with `brew` or `apt`.

## Usage

Put the GOG offline installer (the `.exe` and any `-*.bin` parts) in the `gog/` folder of this repository. Git ignores everything in `gog/`, so the game files are never committed.

### macOS / Linux

```bash
make extract
```

- One installer in `gog/`: it is used.
- Several: the script lists them and asks which one.
- None: it asks which game you want, whether you already own it on GOG, prints a clickable link to the store page or the download, and then waits for you to drag the `.exe` into the terminal.

To use an installer somewhere else, pass it directly: `make extract INSTALLER="$HOME/Downloads/setup_diablo_1.09_hellfire_v4_(78466).exe"` (quoted, because of the parentheses). Run `make` on its own to list the other targets.

### Windows (Command Prompt/PowerShell)

```powershell
python scripts\extract_for_vita.py
python scripts\extract_for_vita.py "gog\setup_diablo_1.09_hellfire_v4_(78466).exe"
```

The game is recognised by the installer's file name; if the name is not one the script knows, it asks which game it is. The output lands in this repository laid out the way `ux0:data/` expects it — `openmohaa/main/` or `diasurgical/devilution/` — and the game's guide says where it goes on the Vita.

## Troubleshooting

- **Extraction fails**: Try installing `innoextract` (recommended) or `7-Zip`. The script will tell you which tools it tried and what to install.
- **Wrong installer**: Make sure you're using the offline backup installer from GOG, not the Galaxy installer.
- Game-specific problems are in each game's guide.

## License

See [LICENSE](LICENSE) if included, or refer to the repository's license file.
