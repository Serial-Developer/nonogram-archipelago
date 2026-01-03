"""
Nonopelagram Options

Defines all YAML options for world generation.
"""

from dataclasses import dataclass
from Options import (
    Choice,
    DefaultOnToggle,
    PerGameCommonOptions,
    Range,
    Toggle,
)


class StartingLives(Range):
    """Number of lives you start each puzzle with."""
    display_name = "Starting Lives"
    range_start = 1
    range_end = 10
    default = 3


class StartingCoins(Range):
    """Number of coins you start with."""
    display_name = "Starting Coins"
    range_start = 0
    range_end = 50
    default = 5


class StartingHints(Range):
    """Number of row/column hints revealed at the start of each puzzle."""
    display_name = "Starting Hints"
    range_start = 0
    range_end = 5
    default = 1


class CoinsPerBundle(Range):
    """Number of coins received from each Coin Bundle item."""
    display_name = "Coins Per Bundle"
    range_start = 1
    range_end = 20
    default = 5


class ExtraLivesInPool(Range):
    """Number of Extra Life items in the item pool."""
    display_name = "Extra Lives in Pool"
    range_start = 0
    range_end = 10
    default = 5


class HintRevealsInPool(Range):
    """Number of Hint Reveal items in the item pool."""
    display_name = "Hint Reveals in Pool"
    range_start = 0
    range_end = 20
    default = 10


class CoinBundlesInPool(Range):
    """Number of Coin Bundle items in the item pool."""
    display_name = "Coin Bundles in Pool"
    range_start = 0
    range_end = 30
    default = 15


class CellSolvesInPool(Range):
    """Number of Random Cell Solve items in the item pool."""
    display_name = "Random Cell Solves in Pool"
    range_start = 0
    range_end = 10
    default = 3


class GoalPuzzles(Range):
    """Number of puzzles required to complete the goal."""
    display_name = "Goal Puzzles"
    range_start = 1
    range_end = 100
    default = 64


class DeathLink(Toggle):
    """When you lose all lives, everyone with DeathLink enabled dies.
    When you receive a DeathLink, you lose a life."""
    display_name = "Death Link"


@dataclass
class NonogramOptions(PerGameCommonOptions):
    """Options for Nonogram."""
    starting_lives: StartingLives
    starting_coins: StartingCoins
    starting_hints: StartingHints
    coins_per_bundle: CoinsPerBundle
    extra_lives_in_pool: ExtraLivesInPool
    hint_reveals_in_pool: HintRevealsInPool
    coin_bundles_in_pool: CoinBundlesInPool
    cell_solves_in_pool: CellSolvesInPool
    goal_puzzles: GoalPuzzles
    death_link: DeathLink
