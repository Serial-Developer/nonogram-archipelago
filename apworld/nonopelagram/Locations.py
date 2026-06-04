"""
Nonopelagram Locations

Defines all locations (checks) that can be sent to Archipelago.
Location IDs must match the client's AP_LOCATIONS constants.
"""

from typing import Dict, NamedTuple, Optional
from BaseClasses import Location


class NonogramLocationData(NamedTuple):
    """Data structure for location definitions."""
    code: Optional[int]  # None for event locations
    region: str


class NonogramLocation(Location):
    """Custom location class for Nonopelagram."""
    game: str = "Nonopelagram"


# Location ID ranges (must match client's useArchipelagoItems.ts):
# Milestones: 9000001-9000009
# 5x5 puzzle completions: 9001001-9001026
# 10x10 puzzle completions: 9002001-9002015
# 15x15 puzzle completions: 9003001-9003010
# 20x20 puzzle completions: 9004001-9004005

location_table: Dict[str, NonogramLocationData] = {
    # === Coin Milestone Checks ===
    "Obtain 50 Coins": NonogramLocationData(
        code=9000001,
        region="Puzzle Area"
    ),
    "Obtain 100 Coins": NonogramLocationData(
        code=9000002,
        region="Puzzle Area"
    ),

    # === 5x5 Milestone ===
    "Complete First Line of a 5x5 Puzzle": NonogramLocationData(
        code=9000003,
        region="Puzzle Area"
    ),

    # === 10x10 Unlock & Milestone ===
    "Increased Difficulty to 10x10": NonogramLocationData(
        code=9000004,
        region="Puzzle Area"
    ),
    "Complete First Line of a 10x10 Puzzle": NonogramLocationData(
        code=9000005,
        region="Puzzle Area"
    ),

    # === 15x15 Unlock & Milestone ===
    "Increased Difficulty to 15x15": NonogramLocationData(
        code=9000006,
        region="Puzzle Area"
    ),
    "Complete First Line of a 15x15 Puzzle": NonogramLocationData(
        code=9000007,
        region="Puzzle Area"
    ),

    # === 20x20 Unlock & Milestone ===
    "Increased Difficulty to 20x20": NonogramLocationData(
        code=9000008,
        region="Puzzle Area"
    ),
    "Complete First Line of a 20x20 Puzzle": NonogramLocationData(
        code=9000009,
        region="Puzzle Area"
    ),
}

# Pre-declare 5x5 puzzle completion IDs (1-100); only the configured count is created in regions
for i in range(1, 101):
    location_table[f"Complete {i} 5x5 Puzzle{'s' if i > 1 else ''}"] = NonogramLocationData(
        code=9001000 + i,
        region="Puzzle Area"
    )

# Pre-declare 10x10 puzzle completion IDs (1-100); only the configured count is created in regions
for i in range(1, 101):
    location_table[f"Complete {i} 10x10 Puzzle{'s' if i > 1 else ''}"] = NonogramLocationData(
        code=9002000 + i,
        region="Puzzle Area"
    )

# Pre-declare 15x15 puzzle completion IDs (1-100); only the configured count is created in regions
for i in range(1, 101):
    location_table[f"Complete {i} 15x15 Puzzle{'s' if i > 1 else ''}"] = NonogramLocationData(
        code=9003000 + i,
        region="Puzzle Area"
    )

# Pre-declare 20x20 puzzle completion IDs (1-100); only the configured count is created in regions
for i in range(1, 101):
    location_table[f"Complete {i} 20x20 Puzzle{'s' if i > 1 else ''}"] = NonogramLocationData(
        code=9004000 + i,
        region="Puzzle Area"
    )

# Shop check locations (active only when the matching item is placed in the pool).
# Wallet levels 1-4 -> 9006001-9006004
WALLET_SHOP_LOCATION_NAMES = [f"Shop: Wallet Level {k}" for k in range(1, 5)]
for _k in range(1, 5):
    location_table[f"Shop: Wallet Level {_k}"] = NonogramLocationData(
        code=9006000 + _k,
        region="Puzzle Area"
    )

# Heart Container shop checks. IDs 9007001-9007010 (created in regions when shop hearts on,
# lives are finite, and hearts_in_pool > 0).
HEART_SHOP_LOCATION_NAMES = [f"Shop: Heart Container {k}" for k in range(1, 11)]
for _h in range(1, 11):
    location_table[f"Shop: Heart Container {_h}"] = NonogramLocationData(
        code=9007000 + _h,
        region="Puzzle Area"
    )

# Flawless checks (no-mistake clears). IDs 9005001-9005006.
# Created in regions only when reachable for the configured puzzle counts.
FLAWLESS_PER_SIZE_NAMES = {
    "5x5": "Clear a 5x5 Puzzle Flawlessly",
    "10x10": "Clear a 10x10 Puzzle Flawlessly",
    "15x15": "Clear a 15x15 Puzzle Flawlessly",
    "20x20": "Clear a 20x20 Puzzle Flawlessly",
}
FLAWLESS_STREAK_NAME = "Clear 5 Puzzles Flawlessly in a Row"
FLAWLESS_TOTAL_NAME = "Clear 10 Puzzles Flawlessly"
location_table[FLAWLESS_PER_SIZE_NAMES["5x5"]] = NonogramLocationData(code=9005001, region="Puzzle Area")
location_table[FLAWLESS_PER_SIZE_NAMES["10x10"]] = NonogramLocationData(code=9005002, region="Puzzle Area")
location_table[FLAWLESS_PER_SIZE_NAMES["15x15"]] = NonogramLocationData(code=9005003, region="Puzzle Area")
location_table[FLAWLESS_PER_SIZE_NAMES["20x20"]] = NonogramLocationData(code=9005004, region="Puzzle Area")
location_table[FLAWLESS_STREAK_NAME] = NonogramLocationData(code=9005005, region="Puzzle Area")
location_table[FLAWLESS_TOTAL_NAME] = NonogramLocationData(code=9005006, region="Puzzle Area")

# Add Victory event (no code)
location_table["Goal"] = NonogramLocationData(
    code=None,
    region="Puzzle Area"
)


def get_locations_by_region() -> Dict[str, list]:
    """Group locations by their region."""
    regions: Dict[str, list] = {}
    for name, data in location_table.items():
        if data.region not in regions:
            regions[data.region] = []
        regions[data.region].append(name)
    return regions
