import tempfile
import unittest
from pathlib import Path

from extract_mohaa_for_vita import copy_required_files, newest_vpk


def touch(path, text=""):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


class CopyRequiredFiles(unittest.TestCase):
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

        copied, missing = copy_required_files(self.src, self.out)

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

        copied, missing = copy_required_files(self.src, self.out)

        self.assertEqual(missing, ["Pak5*.pk3"])
        self.assertEqual(copied, [])
        self.assertTrue((self.out / "previous.pk3").exists())


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
        self.assertEqual(newest_vpk(releases), ("v1", "https://x/v1/OpenMoHAA.vpk"))
        self.assertIsNone(newest_vpk([]))


if __name__ == "__main__":
    unittest.main()
