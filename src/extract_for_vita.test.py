import tempfile
import unittest
from pathlib import Path
from unittest import mock

from extract_for_vita import detect_game, newest_vpk
from src.game.diablo import collect as collect_diablo
from src.game.mohaa import collect as collect_mohaa
from src.game.silent_hill_4 import collect as collect_sh4


def touch(path, text=""):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


class CollectMohaa(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src = self.tmp / "extracted"
        self.out = self.tmp / "out" / "main"

    def test_copies_only_the_base_game(self):
        for n in range(6):
            touch(self.src / "app" / "main" / f"Pak{n}.pk3", "base")
        touch(self.src / "app" / "main" / "sound" / "a.wav")
        touch(self.src / "app" / "mainta" / "pak1.pk3", "spearhead")
        touch(self.src / "app" / "mainta" / "sound" / "b.wav")
        touch(self.out / "stale.pk3")

        copied, missing = collect_mohaa(self.src, self.out)

        self.assertEqual(missing, [])
        self.assertEqual(sorted(p.name for p in self.out.glob("*.pk3")),
                         [f"Pak{n}.pk3" for n in range(6)])
        self.assertEqual((self.out / "Pak1.pk3").read_text(), "base")
        self.assertEqual([p.name for p in (self.out / "sound").iterdir()], ["a.wav"])
        self.assertIn("sound/", copied)

    def test_missing_pak_leaves_the_output_alone(self):
        for n in range(5):
            touch(self.src / "app" / "main" / f"Pak{n}.pk3")
        touch(self.out / "previous.pk3")

        copied, missing = collect_mohaa(self.src, self.out)

        self.assertEqual(missing, ["Pak5*.pk3"])
        self.assertEqual(copied, [])
        self.assertTrue((self.out / "previous.pk3").exists())


class CollectDiablo(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src = self.tmp / "extracted"
        self.out = self.tmp / "out" / "devilution"

    def test_copies_diablo_and_hellfire_mpqs_only(self):
        touch(self.src / "DIABDAT.MPQ")
        touch(self.src / "Patch_rt.mpq")
        for name in ["hellfire", "hfmonk", "hfmusic", "hfvoice"]:
            touch(self.src / "hellfire" / f"{name}.mpq")
        touch(self.out / "stale.mpq")

        copied, missing = collect_diablo(self.src, self.out)

        self.assertEqual(missing, [])
        self.assertEqual(sorted(p.name for p in self.out.iterdir()),
                         ["DIABDAT.MPQ", "hellfire.mpq", "hfmonk.mpq", "hfmusic.mpq", "hfvoice.mpq"])

    def test_missing_diabdat_leaves_the_output_alone(self):
        touch(self.src / "hellfire" / "hellfire.mpq")
        touch(self.out / "previous.mpq")

        copied, missing = collect_diablo(self.src, self.out)

        self.assertEqual((copied, missing), ([], ["DIABDAT.MPQ"]))
        self.assertTrue((self.out / "previous.mpq").exists())


class CollectSilentHill4(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.src = self.tmp / "extracted"
        self.out = self.tmp / "sh4vita" / "sh4"

    def test_missing_exe_downloads_nothing(self):
        touch(self.src / "app" / "data" / "a.bin")
        with mock.patch("urllib.request.urlretrieve") as download:
            self.assertEqual(collect_sh4(self.src, self.out), ([], ["SILENT HILL 4.exe"]))
        download.assert_not_called()

    def run_preparer(self, returncode, answers=("",)):
        touch(self.src / "app" / "SILENT HILL 4.exe")
        with mock.patch("platform.system", return_value="Linux"), \
             mock.patch("platform.machine", return_value="x86_64"), \
             mock.patch("builtins.input", side_effect=answers), \
             mock.patch("urllib.request.urlretrieve", side_effect=lambda url, path: touch(Path(path))) as download, \
             mock.patch("subprocess.run", return_value=mock.Mock(returncode=returncode)) as run:
            result = collect_sh4(self.src, self.out)
        self.assertTrue(download.call_args[0][0].endswith("/releases/latest/download/sh4prep-linux"))
        # the preparer appends sh4/ itself, so it gets the parent, and the folder holding the exe
        self.assertEqual(run.call_args[0][0][1:], [str(self.src / "app"), str(self.out.parent), "English"])
        return result

    def test_runs_the_preparer_on_the_folder_holding_the_exe(self):
        self.assertEqual(self.run_preparer(0)[1], [])

    def test_asks_for_the_language_until_the_answer_is_one_of_them(self):
        touch(self.src / "app" / "SILENT HILL 4.exe")
        with mock.patch("platform.system", return_value="Linux"), \
             mock.patch("platform.machine", return_value="x86_64"), \
             mock.patch("builtins.input", side_effect=["9", "German", "3"]), \
             mock.patch("urllib.request.urlretrieve", side_effect=lambda url, path: touch(Path(path))), \
             mock.patch("subprocess.run", return_value=mock.Mock(returncode=0)) as run:
            collect_sh4(self.src, self.out)
        self.assertEqual(run.call_args[0][0][-1], "German")

    def test_a_rejected_exe_stops_the_run(self):
        with self.assertRaises(SystemExit):
            self.run_preparer(1)

    def test_a_platform_without_a_preparer_stops_the_run(self):
        touch(self.src / "SILENT HILL 4.exe")
        with mock.patch("platform.system", return_value="Linux"), \
             mock.patch("platform.machine", return_value="aarch64"), self.assertRaises(SystemExit):
            collect_sh4(self.src, self.out)


class DetectGame(unittest.TestCase):
    def test_picks_the_profile_by_installer_name(self):
        self.assertEqual(detect_game("setup_diablo_1.09_hellfire_v4_(78466).exe")["port"], "DevilutionX")
        self.assertEqual(detect_game("setup_medal_of_honor_2.0.0.21.exe")["port"], "OpenMoHAA")
        self.assertEqual(detect_game("setup_silent_hill_4_the_room_1.0_gog_v5_(80750).exe")["port"], "sh4vita")
        self.assertEqual(detect_game("sh4")["port"], "sh4vita")
        self.assertIsNone(detect_game("setup_quake.exe"))


class NewestVpk(unittest.TestCase):
    def test_takes_the_newest_release_with_a_vpk_prereleases_included(self):
        def release(tag, *assets, draft=False):
            return {"tag_name": tag, "draft": draft, "prerelease": True,
                    "assets": [{"name": a, "browser_download_url": f"https://x/{tag}/{a}"} for a in assets]}

        releases = [
            release("v3", "OpenMoHAA.vpk", draft=True),
            release("v2", "OpenMoHAA-Vita-symbols.zip"),
            release("v1", "OpenMoHAA.vpk"),
        ]
        self.assertEqual(newest_vpk(releases, "OpenMoHAA.vpk"), ("v1", "https://x/v1/OpenMoHAA.vpk"))
        self.assertIsNone(newest_vpk([], "OpenMoHAA.vpk"))


if __name__ == "__main__":
    unittest.main()
