"""One module per game. Each exports GAME: what its installer is called, where
the data goes on the Vita, which port's VPK to fetch, and collect(), which
copies the game data out of the extracted installer.

collect(source_dir, output_dir) returns (copied, missing). When anything
required is missing it returns ([], missing) and leaves output_dir alone.
"""
from games import diablo, mohaa

GAMES = [mohaa.GAME, diablo.GAME]
