"""
Nonopelagram Archipelago World

A picross/nonogram puzzle game for Archipelago multiworld randomizer.
"""

from typing import Dict, Any, ClassVar
from BaseClasses import Item, Location, Region, Tutorial
from worlds.AutoWorld import World, WebWorld
from .Items import NonogramItem, item_table, item_groups
from .Locations import NonogramLocation, location_table
from .Options import NonogramOptions
from .Regions import create_regions


class NonogramWebWorld(WebWorld):
    """Web world for Nonopelagram - provides tutorial and theme info."""

    theme = "partyTime"

    tutorials = [
        Tutorial(
            tutorial_name="Setup Guide",
            description="A guide to setting up the Nonopelagram client for Archipelago.",
            language="English",
            file_name="setup_en.md",
            link="setup/en",
            authors=["StefanDucharme"]
        )
    ]


class NonogramWorld(World):
    """
    Nonopelagram (Picross) is a picture logic puzzle where you fill in cells
    based on number clues to reveal a hidden image. This Archipelago
    integration adds progression items that unlock game features.
    """

    game = "Nonopelagram"
    web = NonogramWebWorld()

    options_dataclass = NonogramOptions
    options: NonogramOptions

    # Item and location ID ranges
    item_name_to_id: ClassVar[Dict[str, int]] = {
        name: data.code for name, data in item_table.items() if data.code is not None
    }
    location_name_to_id: ClassVar[Dict[str, int]] = {
        name: data.code for name, data in location_table.items() if data.code is not None
    }

    item_name_groups = item_groups

    def create_item(self, name: str) -> NonogramItem:
        """Create an item for this world."""
        item_data = item_table[name]
        return NonogramItem(name, item_data.classification, item_data.code, self.player)

    def create_regions(self) -> None:
        """Create and connect all regions for this world."""
        create_regions(self)

    def create_items(self) -> None:
        """Create all items for the item pool."""
        item_count = 0

        # Create progression items (one of each unlock)
        for item_name, item_data in item_table.items():
            if item_data.code is not None:
                # For stackable items, create multiple based on options
                if item_name == "Extra Life":
                    count = self.options.extra_lives_in_pool.value
                elif item_name == "Hint Reveal":
                    count = self.options.hint_reveals_in_pool.value
                elif item_name == "Coin Bundle":
                    count = self.options.coin_bundles_in_pool.value
                elif item_name == "Random Cell Solve":
                    count = self.options.cell_solves_in_pool.value
                else:
                    count = 1

                for _ in range(count):
                    self.multiworld.itempool.append(self.create_item(item_name))
                    item_count += 1

        # Calculate how many locations we have (excluding Victory event)
        location_count = len([loc for loc in location_table.values() if loc.code is not None])

        # Fill remaining locations with Coin Bundle (filler)
        filler_count = location_count - item_count
        for _ in range(filler_count):
            self.multiworld.itempool.append(self.create_item("Coin Bundle"))

    def set_rules(self) -> None:
        """Set access rules for locations."""
        # Most locations just require completing puzzles, no special rules needed
        # Goal is to complete enough puzzles
        self.multiworld.completion_condition[self.player] = lambda state: (
            state.has("Victory", self.player)
        )

    def fill_slot_data(self) -> Dict[str, Any]:
        """Return slot data to be sent to the client."""
        return {
            "starting_lives": self.options.starting_lives.value,
            "starting_coins": self.options.starting_coins.value,
            "starting_hints": self.options.starting_hints.value,
            "coins_per_bundle": self.options.coins_per_bundle.value,
            "goal_puzzles": self.options.goal_puzzles.value,
        }
