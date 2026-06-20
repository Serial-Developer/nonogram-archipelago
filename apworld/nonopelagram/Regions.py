"""
Nonogram Regions

Defines the region structure for the world.

There is a Menu region plus one region per active grid size (tier). Each later tier is
reached from the previous one through an entrance whose access rule encodes the wallet
upgrades needed to afford that difficulty step (see __init__.py:_wallets_required). Tier
puzzle locations live inside their tier region, so their reachability follows the chain;
coin milestones, flawless aggregates and the shop checks live in Menu with their own rules.
"""

from typing import TYPE_CHECKING
from BaseClasses import Region
from .Locations import (
    NonogramLocation,
    location_table,
    WALLET_SHOP_LOCATION_NAMES,
    HEART_SHOP_LOCATION_NAMES,
    FLAWLESS_PER_SIZE_NAMES,
    FLAWLESS_STREAK_NAME,
    FLAWLESS_TOTAL_NAME,
)

if TYPE_CHECKING:
    from . import NonogramWorld


# Grid-size tiers, smallest first, with their numeric size.
TIERS = ["5x5", "10x10", "15x15", "20x20"]
TIER_SIZE = {"5x5": 5, "10x10": 10, "15x15": 15, "20x20": 20}
UNLOCK_NAMES = {
    "10x10": "Increased Difficulty to 10x10",
    "15x15": "Increased Difficulty to 15x15",
    "20x20": "Increased Difficulty to 20x20",
}


def create_regions(world: "NonogramWorld") -> None:
    """Create all regions and connect them, applying wallet gates where they bite."""

    multiworld = world.multiworld
    player = world.player
    counts = world.grid_counts

    active_tiers = [t for t in TIERS if counts.get(t, 0) > 0]
    if not active_tiers:
        # generate_early guarantees at least one puzzle, but stay defensive.
        active_tiers = ["5x5"]
    start_tier = active_tiers[0]
    last_tier = active_tiers[-1]

    # Menu (starting point) + one region per active tier.
    menu_region = Region("Menu", player, multiworld)
    multiworld.regions.append(menu_region)

    tier_regions = {}
    for tier in active_tiers:
        region = Region(f"Tier {tier}", player, multiworld)
        multiworld.regions.append(region)
        tier_regions[tier] = region

    # Menu -> start tier with no condition; each later tier is gated behind the wallet
    # upgrades needed to afford its difficulty step. Chaining is sequential, which also
    # encodes require_tier_completion (a later tier is only reached through the earlier one).
    menu_region.connect(tier_regions[start_tier])
    for prev_tier, cur_tier in zip(active_tiers, active_tiers[1:]):
        rule = world.difficulty_access_rule(TIER_SIZE[cur_tier])
        tier_regions[prev_tier].connect(tier_regions[cur_tier], rule=rule)

    def add(region: Region, name: str) -> None:
        data = location_table[name]
        region.locations.append(NonogramLocation(player, name, data.code, region))

    def add_gated(region: Region, name: str, rule) -> None:
        data = location_table[name]
        loc = NonogramLocation(player, name, data.code, region)
        if rule is not None:
            loc.access_rule = rule
        region.locations.append(loc)

    flawless_enabled = world.options.flawless_checks.value
    total_puzzles = sum(counts.get(t, 0) for t in TIERS)

    # Coin milestones live in Menu: they track total coins EARNED (never capped by the
    # wallet), so they are always reachable.
    add(menu_region, "Obtain 50 Coins")
    add(menu_region, "Obtain 100 Coins")

    # Per-tier locations live in their tier region (reachability follows the tier chain).
    for tier in active_tiers:
        region = tier_regions[tier]
        n = counts.get(tier, 0)
        add(region, f"Complete First Line of a {tier} Puzzle")
        if tier != start_tier and tier in UNLOCK_NAMES:
            add(region, UNLOCK_NAMES[tier])
        for i in range(1, n + 1):
            add(region, f"Complete {i} {tier} Puzzle{'s' if i > 1 else ''}")
        if flawless_enabled:
            add(region, FLAWLESS_PER_SIZE_NAMES[tier])

    # Flawless aggregates track totals earned, not capped by the wallet -> Menu, no rule.
    if flawless_enabled:
        if total_puzzles >= 5:
            add(menu_region, FLAWLESS_STREAK_NAME)
        if total_puzzles >= 10:
            add(menu_region, FLAWLESS_TOTAL_NAME)

    # Wallet shop checks (levels 1..P) live in Menu; each is gated by the coins needed to buy it.
    pool = world.options.wallets_in_pool.value
    for k in range(1, pool + 1):
        add_gated(menu_region, WALLET_SHOP_LOCATION_NAMES[k - 1], world.wallet_shop_access_rule(k))

    # Heart shop checks (1..hearts_in_pool) live in Menu; gated by the m-th heart's cost.
    if world.options.shop_hearts.value and not world.options.unlimited_lives.value:
        hearts_in_pool = world.options.hearts_in_pool.value
        for m in range(1, hearts_in_pool + 1):
            add_gated(menu_region, HEART_SHOP_LOCATION_NAMES[m - 1], world.heart_shop_access_rule(m))

    # Victory event in the highest tier's region: reaching the final puzzle of that tier.
    # The tier chain already requires the wallet upgrades to get there, so the goal inherits
    # them and real spheres form when a gate bites.
    last_region = tier_regions[last_tier]
    final_count = counts.get(last_tier, 0) or 1
    goal_location_name = f"Complete {final_count} {last_tier} Puzzle{'s' if final_count > 1 else ''}"
    victory_location = NonogramLocation(player, "Goal", None, last_region)
    victory_location.access_rule = lambda state, loc=goal_location_name: state.can_reach(
        loc, "Location", player
    )
    victory_location.place_locked_item(world.create_item("Victory"))
    last_region.locations.append(victory_location)
