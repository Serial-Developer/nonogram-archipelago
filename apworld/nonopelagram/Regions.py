"""
Nonogram Regions

Defines the region structure for the world.
Nonopelagram is simple - just one main region with all locations.
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


def create_regions(world: "NonogramWorld") -> None:
    """Create all regions and connect them."""

    multiworld = world.multiworld
    player = world.player

    # Create Menu region (starting point)
    menu_region = Region("Menu", player, multiworld)
    multiworld.regions.append(menu_region)

    # Create main Puzzle Area region
    puzzle_region = Region("Puzzle Area", player, multiworld)
    multiworld.regions.append(puzzle_region)

    # Connect Menu to Puzzle Area (no requirements)
    menu_region.connect(puzzle_region)

    def add_location(name: str) -> None:
        data = location_table[name]
        puzzle_region.locations.append(
            NonogramLocation(player, name, data.code, puzzle_region)
        )

    counts = world.grid_counts
    tiers = ["5x5", "10x10", "15x15", "20x20"]
    active_tiers = [t for t in tiers if counts.get(t, 0) > 0]
    start_tier = active_tiers[0] if active_tiers else "5x5"
    unlock_names = {
        "10x10": "Increased Difficulty to 10x10",
        "15x15": "Increased Difficulty to 15x15",
        "20x20": "Increased Difficulty to 20x20",
    }

    # Coin milestones are always reachable.
    add_location("Obtain 50 Coins")
    add_location("Obtain 100 Coins")

    # Per-size locations (only for sizes that are actually played).
    flawless_enabled = world.options.flawless_checks.value
    total_puzzles = sum(counts.get(t, 0) for t in tiers)
    for tier in tiers:
        n = counts.get(tier, 0)
        if n <= 0:
            continue
        add_location(f"Complete First Line of a {tier} Puzzle")
        # The starting size is not "unlocked"; every later played size is.
        if tier != start_tier and tier in unlock_names:
            add_location(unlock_names[tier])
        for i in range(1, n + 1):
            add_location(f"Complete {i} {tier} Puzzle{'s' if i > 1 else ''}")
        if flawless_enabled:
            add_location(FLAWLESS_PER_SIZE_NAMES[tier])

    # Flawless aggregate checks: only when enough puzzles exist for them to be reachable.
    if flawless_enabled:
        if total_puzzles >= 5:
            add_location(FLAWLESS_STREAK_NAME)
        if total_puzzles >= 10:
            add_location(FLAWLESS_TOTAL_NAME)

    # Conditionally add wallet shop check locations (first N levels, N = wallets_in_pool).
    wallets_in_pool = world.options.wallets_in_pool.value
    for location_name in WALLET_SHOP_LOCATION_NAMES[:wallets_in_pool]:
        add_location(location_name)

    # Heart Container shop checks (first N = hearts_in_pool); only with finite lives + shop hearts.
    if world.options.shop_hearts.value and not world.options.unlimited_lives.value:
        hearts_in_pool = world.options.hearts_in_pool.value
        for location_name in HEART_SHOP_LOCATION_NAMES[:hearts_in_pool]:
            add_location(location_name)

    # Add victory event location
    victory_location = NonogramLocation(
        player,
        "Goal",
        None,  # Event location
        puzzle_region
    )
    victory_location.place_locked_item(world.create_item("Victory"))
    puzzle_region.locations.append(victory_location)

    # Victory requires reaching the final puzzle of the highest played size.
    last_tier = active_tiers[-1] if active_tiers else start_tier
    final_count = counts.get(last_tier, 0) or 1
    goal_location_name = f"Complete {final_count} {last_tier} Puzzle{'s' if final_count > 1 else ''}"
    victory_location.access_rule = lambda state, loc=goal_location_name: state.can_reach(
        loc, "Location", player
    )
