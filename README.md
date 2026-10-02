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

From your GOG account, download the offline backup installer for *[Medal of Honor: Allied Assault](https://www.gog.com/en/account)*. For recent versions, you'll get files like this (all in the same folder):

```text
setup_medal_of_honor_2.0.0.21.exe
setup_medal_of_honor_2.0.0.21-1.bin
setup_medal_of_honor_2.0.0.21-2.bin
```

> [!IMPORTANT]
> Keep the `.exe` and **all** matching `-*.bin` files in the same directory. The script automatically detects them regardless of version number.

### 2. Run the script

Run the script and pass the `.exe` file as the argument. You only need to point it at the `.exe` — it will automatically use the `.bin` parts.

#### macOS / Linux

From this repository's folder:

```bash
make extract
```

It asks for the installer; drag the `.exe` into the terminal window and press Enter. To skip the question, pass it directly: `make extract INSTALLER=~/Downloads/setup_medal_of_honor_2.0.0.21.exe`. Run `make` on its own to list the other targets.

#### Windows (Command Prompt/PowerShell)

```powershell
python extract_mohaa_for_vita.py "C:\Users\YourUsername\Downloads\setup_medal_of_honor_2.0.0.21.exe"
```

### 3. Transfer to your PS Vita

After extraction completes, you'll find a new folder in the same directory as the script:

```text
OpenMoHAA_Vita_GameData/main/
```

To transfer to your Vita:

1. Open [VitaShell](https://github.com/TheOfficialFloW/VitaShell) on your PS Vita (via USB or FTP).
2. Navigate to `ux0:data/openmohaa/` on your Vita. Create the `openmohaa` folder if it doesn't exist.
3. Drag and drop the `main/` folder from `OpenMoHAA_Vita_GameData/` directly into `ux0:data/openmohaa/`.
4. Launch [OpenMoHAA Vita](https://github.com/ChatProductions/openmohaavita) from your LiveArea.

> [!NOTE]
> Do **not** copy `configs/` or `save/` folders. OpenMoHAA Vita will generate these automatically on first launch.

## What Gets Extracted

The script collects everything OpenMoHAA Vita needs:

| File/Folder | Required | Notes |
|---|---|---|
| `Pak0.pk3` – `Pak5.pk3` | **Yes** | Base game + official 1.11 update data. |
| Any other `Pak*.pk3` files | If present | All additional PAK files (e.g. language packs) are included. |
| `sound/` | If present | Preserves original structure and case. Vita is case-sensitive for these files. |
| `music/` | If present | Copied if present as loose files. |
| `video/` | If present | Copied if intro/cinematic files exist outside PAKs. |

## Troubleshooting

- **Missing BIN files**: Ensure all `-*.bin` files are in the same folder as the `.exe`. The script will list detected BINs when it runs.
- **Extraction fails**: Try installing `innoextract` (recommended) or `7-Zip`. The script will tell you which tools it tried and what to install.
- **Wrong installer**: Make sure you're using the "Offline Backup Game Installers" from GOG, not the Galaxy installer.
- **Long load times on Vita**: This is a [known limitation](https://github.com/ChatProductions/openmohaavita#long-loading-times) of the OpenMoHAA Vita port and is expected behavior.

## Credits

This extractor is designed specifically for preparing GOG copies for [OpenMoHAA Vita](https://github.com/ChatProductions/openmohaavita) by [Chat Productions](https://github.com/ChatProductions).

## License

See [LICENSE](LICENSE) if included, or refer to the repository's license file.