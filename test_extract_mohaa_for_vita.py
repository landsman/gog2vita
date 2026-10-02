import tempfile
import unittest
from pathlib import Path

from extract_mohaa_for_vita import copy_required_files


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


if __name__ == "__main__":
    unittest.main()
