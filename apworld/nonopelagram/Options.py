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


class GridPreset(Choice):
    """Preset distribution of puzzles per grid size (the goal is their sum).
    Choose 'custom' to set each size yourself with the puzzles_* options.
    easy=10/8/5/2, normal=10/10/10/10, hard=10/15/20/20, evil=0/0/0/66,
    expedition_33=0/33/33/33 (sizes 5x5/10x10/15x15/20x20)."""
    display_name = "Grid Count Preset"
    option_easy = 0
    option_normal = 1
    option_hard = 2
    option_evil = 3
    option_expedition_33 = 4
    option_custom = 5
    default = 1


class Puzzles5x5(Range):
    """Number of 5x5 puzzles toward the goal (only used when grid_preset is custom)."""
    display_name = "5x5 Puzzles (custom)"
    range_start = 0
    range_end = 100
    default = 10


class Puzzles10x10(Range):
    """Number of 10x10 puzzles toward the goal (only used when grid_preset is custom)."""
    display_name = "10x10 Puzzles (custom)"
    range_start = 0
    range_end = 100
    default = 10


class Puzzles15x15(Range):
    """Number of 15x15 puzzles toward the goal (only used when grid_preset is custom)."""
    display_name = "15x15 Puzzles (custom)"
    range_start = 0
    range_end = 100
    default = 10


class Puzzles20x20(Range):
    """Number of 20x20 puzzles toward the goal (only used when grid_preset is custom)."""
    display_name = "20x20 Puzzles (custom)"
    range_start = 0
    range_end = 100
    default = 10


class DeathLink(Toggle):
    """When you lose all lives, everyone with DeathLink enabled dies.
    When you receive a DeathLink, you lose a life."""
    display_name = "Death Link"


class AutoX(DefaultOnToggle):
    """Automatically place an X on the remaining cells of a completed row/column.
    Fixed by the YAML for everyone playing this Archipelago game."""
    display_name = "Auto-X Completed Rows/Columns"


class GreyCompletedHints(DefaultOnToggle):
    """Grey out hint numbers once they have been satisfied.
    Fixed by the YAML for everyone playing this Archipelago game."""
    display_name = "Grey Out Completed Hints"


class UnlimitedLives(Toggle):
    """Play without losing lives on mistakes. When disabled (default), mistakes cost a
    life and Show Mistakes is forced on."""
    display_name = "Unlimited Lives"


class ShowMistakes(DefaultOnToggle):
    """Highlight incorrect cells in real-time. This is forced on and locked whenever you
    play with lives (Unlimited Lives disabled); it is only freely configurable when
    Unlimited Lives is enabled."""
    display_name = "Show Mistakes in Real-Time"


class StartingWalletLevel(Range):
    """Wallet level you start with (coin capacity). 0 = 49 max coins, 1 = 99,
    2 = 999, 3 = 4999, 4 = 9999. Set to 4 to effectively play without a coin cap."""
    display_name = "Starting Wallet Level"
    range_start = 0
    range_end = 4
    default = 0


class WalletsInPool(Range):
    """Number of progressive Wallet Upgrade items placed in the multiworld pool (0-4).
    Levels added to the pool are received as multiworld items; their shop slots become
    multiworld location checks instead of coin purchases."""
    display_name = "Wallets in Pool"
    range_start = 0
    range_end = 4
    default = 0


class RequireTierCompletion(DefaultOnToggle):
    """Require completing every puzzle of your current grid size before you can buy the
    next difficulty in the shop. When disabled, difficulty can be bought with coins alone."""
    display_name = "Require Tier Completion to Advance"


class DifficultyCost(Choice):
    """Coin cost to increase difficulty in the shop, indexed on the size you reach.
    free=0; low=30; normal=250; high=500 (flat per step);
    progressive=99/999/1999 to reach 10x10/15x15/20x20. Held coins are capped by your wallet,
    so expensive modes require wallet upgrades or generation rejects an unbeatable seed."""
    display_name = "Difficulty Increase Cost"
    option_free = 0
    option_low = 1
    option_normal = 2
    option_high = 3
    option_progressive = 4
    default = 1


class LifeRestoreOnClear(Choice):
    """How many lives are restored when you clear a puzzle (applied on the next puzzle).
    none=0, one=+1, full=refill to your maximum (default), custom=+life_restore_custom.
    Ignored when Unlimited Lives is on. Failing a puzzle always refills fully."""
    display_name = "Life Restore on Clear"
    option_none = 0
    option_one = 1
    option_full = 2
    option_custom = 3
    default = 2


class LifeRestoreCustom(Range):
    """Lives restored on clear when life_restore_on_clear is 'custom'."""
    display_name = "Life Restore Amount (custom)"
    range_start = 0
    range_end = 20
    default = 3


class ShopHealing(Toggle):
    """Offer a 'heal one life' purchase in the shop (up to your maximum).
    Ignored when Unlimited Lives is on."""
    display_name = "Offer Healing in Shop"


class HealingCost(Choice):
    """Coin cost of one heal in the shop (only when shop_healing is on).
    free=0, low=10, normal=30 (default), high=100,
    progressive (10, +10 per heal already bought, capped at 9999), custom=healing_cost_custom."""
    display_name = "Healing Cost"
    option_free = 0
    option_low = 1
    option_normal = 2
    option_high = 3
    option_progressive = 4
    option_custom = 5
    default = 2


class HealingCostCustom(Range):
    """Flat coin cost of one heal when healing_cost is 'custom'."""
    display_name = "Healing Cost (custom)"
    range_start = 0
    range_end = 9999
    default = 30


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
    grid_preset: GridPreset
    puzzles_5x5: Puzzles5x5
    puzzles_10x10: Puzzles10x10
    puzzles_15x15: Puzzles15x15
    puzzles_20x20: Puzzles20x20
    death_link: DeathLink
    auto_x: AutoX
    grey_completed_hints: GreyCompletedHints
    unlimited_lives: UnlimitedLives
    show_mistakes: ShowMistakes
    starting_wallet_level: StartingWalletLevel
    wallets_in_pool: WalletsInPool
    require_tier_completion: RequireTierCompletion
    difficulty_cost: DifficultyCost
    life_restore_on_clear: LifeRestoreOnClear
    life_restore_custom: LifeRestoreCustom
    shop_healing: ShopHealing
    healing_cost: HealingCost
    healing_cost_custom: HealingCostCustom
