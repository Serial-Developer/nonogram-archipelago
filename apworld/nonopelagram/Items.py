"""
Nonopelagram Items

Defines all items that can be received from Archipelago.
Item IDs must match the client's AP_ITEMS constants.
"""

from typing import Dict, NamedTuple, Optional, Set
from BaseClasses import Item, ItemClassification


class NonogramItemData(NamedTuple):
    """Data structure for item definitions."""
    code: Optional[int]  # None for event items
    classification: ItemClassification


class NonogramItem(Item):
    """Custom item class for Nonopelagram."""
    game: str = "Nonopelagram"


# Item ID ranges (must match client's useArchipelagoItems.ts):
# Settings Unlocks: 8000001-8000005
# Hint Visibility:  8001001
# Lives:           8002001
# Coins:           8003001
# Consumables:     8004001

item_table: Dict[str, NonogramItemData] = {

    # === Hint Reveals (Progression - needed to solve harder puzzles) ===
    "Hint Reveal": NonogramItemData(
        code=8001001,
        classification=ItemClassification.progression
    ),

    # === Lives (Useful) ===
    "Extra Life": NonogramItemData(
        code=8002001,
        classification=ItemClassification.useful
    ),

    # === Coins (Filler) ===
    "Coin Bundle": NonogramItemData(
        code=8003001,
        classification=ItemClassification.filler
    ),

    # === Consumables (Useful) ===
    "Random Cell Solve": NonogramItemData(
        code=8004001,
        classification=ItemClassification.useful
    ),

    # === Wallet (Useful - progressive coin capacity) ===
    "Wallet Upgrade": NonogramItemData(
        code=8005001,
        classification=ItemClassification.useful
    ),

    # === Heart Container (Useful - max-heart expansion; pooled heart shop checks) ===
    "Heart Container": NonogramItemData(
        code=8006001,
        classification=ItemClassification.useful
    ),

    # === Event Items (no code, used for logic) ===
    "Victory": NonogramItemData(
        code=None,
        classification=ItemClassification.progression
    ),
}


# Item groups for hint system
item_groups: Dict[str, Set[str]] = {
    "Progression": {
        "Hint Reveal",
    },
    "Consumables": {
        "Extra Life",
        "Coin Bundle",
        "Random Cell Solve",
    },
}
