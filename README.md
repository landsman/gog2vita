# OpenMoHAA Vita GOG Extractor

A cross-platform one-command script to extract game data from your GOG.com copy of *Medal of Honor: Allied Assault* and prepare it for use with [OpenMoHAA Vita](https://github.com/ChatProductions/openmohaavita).

This script handles both single-file installers and GOG's multi-part installers (`.exe` + `-*.bin` files), automatically extracts the correct game data, and creates a ready-to-transfer `main/` folder for your PS Vita.

> [!IMPORTANT]
> This tool is for use with your own legally purchased copy of the game. It does not provide or distribute any EA game data.

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

### 2. Run the script

The script only needs the `.exe` and picks up the `.bin` parts next to it.

#### macOS / Linux

From this repository's folder:

```bash
make extract
```

It finds the installer in `gog/` on its own. If there is none, it asks for one; drag the `.exe` into the terminal window and press Enter. To use an installer somewhere else, pass it directly: `make extract INSTALLER=~/Downloads/setup_medal_of_honor_2.0.0.21.exe`. Run `make` on its own to list the other targets.

#### Windows (Command Prompt/PowerShell)

From this repository's folder:

```powershell
python extract_mohaa_for_vita.py gog\setup_medal_of_honor_2.0.0.21.exe
```

### 3. Install OpenMoHAA Vita and copy the game data

These steps follow the [OpenMoHAA Vita install guide](https://github.com/ChatProductions/openmohaavita#install). You need a homebrew-capable PS Vita.

After extraction completes, you'll find a new folder in the same directory as the script, laid out like `ux0:data/openmohaa/` on the Vita:

```text
openmohaa/main/
```

1. Download `OpenMoHAA.vpk` from the [latest OpenMoHAA Vita release](https://github.com/ChatProductions/openmohaavita/releases/latest).
2. Install the VPK with [VitaShell](https://github.com/TheOfficialFloW/VitaShell).
3. In VitaShell, connect over USB or FTP and copy the extracted `openmohaa/main/` folder so it ends up as:

   ```text
   ux0:data/openmohaa/main/
   ```

   Create `ux0:data/openmohaa/` first if it doesn't exist.
4. Launch OpenMoHAA from LiveArea.

> [!NOTE]
> Do **not** copy `configs/` or `save/` folders from a computer installation. OpenMoHAA Vita creates its own on first launch.

## What Gets Extracted

The script collects the files the [OpenMoHAA Vita install guide](https://github.com/ChatProductions/openmohaavita#install) asks for, from the base game's `main/` folder only:

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
- **Extraction fails**: Try installing `innoextract` (recommended) or `7-Zip`. The script will tell you which tools it tried and what to install.
- **Wrong installer**: Make sure you're using the "Offline Backup Game Installers" from GOG, not the Galaxy installer.
- **Long load times on Vita**: This is a [known limitation](https://github.com/ChatProductions/openmohaavita#long-loading-times) of the OpenMoHAA Vita port and is expected behavior.

## Credits

This extractor is designed specifically for preparing GOG copies for [OpenMoHAA Vita](https://github.com/ChatProductions/openmohaavita) by [Chat Productions](https://github.com/ChatProductions).

## License

See [LICENSE](LICENSE) if included, or refer to the repository's license file.