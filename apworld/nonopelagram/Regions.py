"""
Nonogram Regions

Defines the region structure for the world.
Nonopelagram is simple - just one main region with all locations.
"""

from typing import TYPE_CHECKING
from BaseClasses import Region
from .Locations import NonogramLocation, location_table

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

    # Add all locations to the puzzle region
    for location_name, location_data in location_table.items():
        if location_data.code is not None:  # Skip event locations for now
            location = NonogramLocation(
                player,
                location_name,
                location_data.code,
                puzzle_region
            )
            puzzle_region.locations.append(location)

    # Add victory event location
    victory_location = NonogramLocation(
        player,
        "Goal",
        None,  # Event location
        puzzle_region
    )
    victory_location.place_locked_item(world.create_item("Victory"))
    puzzle_region.locations.append(victory_location)

    # Set victory condition based on goal_puzzles option
    goal_puzzles = world.options.goal_puzzles.value

    # Victory requires completing the goal number of 5x5 puzzles (default)
    # The location name is "Complete X 5x5 Puzzles"
    goal_location_name = f"Complete {goal_puzzles} 5x5 Puzzles" if goal_puzzles > 1 else "Complete 1 5x5 Puzzle"
    victory_location.access_rule = lambda state, loc=goal_location_name: state.can_reach(
        loc, "Location", player
    )
