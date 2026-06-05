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


class CoinsPerBundle(Choice):
    """Coins received from each Coin Bundle item.
    low=5, normal=50 (default), high=100, custom=coins_per_bundle_custom."""
    display_name = "Coins Per Bundle"
    option_low = 0
    option_normal = 1
    option_high = 2
    option_custom = 3
    default = 1


class CoinsPerBundleCustom(Range):
    """Coins received from each Coin Bundle item when coins_per_bundle is 'custom'."""
    display_name = "Coins Per Bundle (custom)"
    range_start = 0
    range_end = 999
    default = 50


class ExtraLivesInPool(Range):
    """Number of Extra Life items in the item pool."""
    display_name = "Extra Lives in Pool"
    range_start = 0
    range_end = 10
    default = 5


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


class DeathLink(Choice):
    """How Death Link affects you when another linked player dies:
    off: Death Link is disabled.
    on: you lose all your lives (and your own death also sends a Death Link).
    damage: you lose a single heart instead of all your lives."""
    display_name = "Death Link"
    option_off = 0
    option_on = 1
    option_damage = 2
    default = 0


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


class HeartsInPool(Range):
    """Number of Heart Container checks placed in the shop (0-10). Their shop slots become
    multiworld location checks instead of coin purchases; the max-heart increase arrives as a
    Heart Container item (a quarter in Zelda Heart Mode, a whole heart otherwise). Requires
    Offer Heart Containers in Shop, and is ignored under Unlimited Lives."""
    display_name = "Heart Containers in Pool"
    range_start = 0
    range_end = 10
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


class ZeldaHeartMode(Toggle):
    """Shop heart purchases come as quarter-heart pieces (4 = +1 max heart, Zelda-style)
    instead of whole hearts. Forming a new heart fully heals you. Damage and healing always
    use whole hearts. Ignored when Unlimited Lives is on."""
    display_name = "Zelda Heart Mode (quarter hearts)"


class ShopHearts(Toggle):
    """Offer max-heart expansion in the shop (buy a whole heart, or a quarter in Zelda Heart
    Mode), up to 10 hearts. Ignored when Unlimited Lives is on."""
    display_name = "Offer Heart Containers in Shop"


class HeartCost(Choice):
    """Coin cost per shop heart purchase (one whole heart, or one quarter in Zelda Heart Mode).
    free=0, low=30, normal=100 (default), high=300,
    progressive (50, +50 per purchase, capped 9999), custom=heart_cost_custom."""
    display_name = "Heart Cost"
    option_free = 0
    option_low = 1
    option_normal = 2
    option_high = 3
    option_progressive = 4
    option_custom = 5
    default = 2


class HeartCostCustom(Range):
    """Flat coin cost per heart purchase when heart_cost is 'custom'."""
    display_name = "Heart Cost (custom)"
    range_start = 0
    range_end = 9999
    default = 100


class FlawlessChecks(DefaultOnToggle):
    """Send location checks for clearing puzzles without any mistakes: one per played grid size,
    one for a 5-in-a-row flawless streak, and one for 10 flawless clears total. Only the checks
    that are actually reachable for your configured puzzle counts are created."""
    display_name = "Flawless Checks"


class DebugMode(Toggle):
    """Show the in-client Debug tab (slot_data simulator and debug tools) for connected players.
    Off by default; turn on only when you need to debug a seed."""
    display_name = "Debug Mode"


@dataclass
class NonogramOptions(PerGameCommonOptions):
    """Options for Nonogram."""
    starting_lives: StartingLives
    starting_coins: StartingCoins
    starting_hints: StartingHints
    coins_per_bundle: CoinsPerBundle
    coins_per_bundle_custom: CoinsPerBundleCustom
    extra_lives_in_pool: ExtraLivesInPool
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
    hearts_in_pool: HeartsInPool
    require_tier_completion: RequireTierCompletion
    difficulty_cost: DifficultyCost
    life_restore_on_clear: LifeRestoreOnClear
    life_restore_custom: LifeRestoreCustom
    shop_healing: ShopHealing
    healing_cost: HealingCost
    healing_cost_custom: HealingCostCustom
    zelda_heart_mode: ZeldaHeartMode
    shop_hearts: ShopHearts
    heart_cost: HeartCost
    heart_cost_custom: HeartCostCustom
    flawless_checks: FlawlessChecks
    debug_mode: DebugMode
