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

    # Effective puzzle counts per grid size, resolved from the preset/custom options.
    grid_counts: Dict[str, int]

    GRID_PRESETS: ClassVar[Dict[str, Dict[str, int]]] = {
        "easy": {"5x5": 10, "10x10": 8, "15x15": 5, "20x20": 2},
        "normal": {"5x5": 10, "10x10": 10, "15x15": 10, "20x20": 10},
        "hard": {"5x5": 10, "10x10": 15, "15x15": 20, "20x20": 20},
        "evil": {"5x5": 0, "10x10": 0, "15x15": 0, "20x20": 66},
        "expedition_33": {"5x5": 0, "10x10": 33, "15x15": 33, "20x20": 33},
    }

    @staticmethod
    def _difficulty_step_cost(mode: str, target: int) -> int:
        """Coin cost to reach `target` grid size under a difficulty_cost mode (mirror of client)."""
        if mode == "free":
            return 0
        if mode == "normal":
            return 250
        if mode == "high":
            return 500
        if mode == "progressive":
            return {10: 99, 15: 999, 20: 1999}.get(target, 0)
        return 30  # low (default)

    def generate_early(self) -> None:
        """Resolve the effective per-size puzzle counts from the preset/custom options."""
        preset = self.options.grid_preset
        if preset.current_key == "custom":
            self.grid_counts = {
                "5x5": self.options.puzzles_5x5.value,
                "10x10": self.options.puzzles_10x10.value,
                "15x15": self.options.puzzles_15x15.value,
                "20x20": self.options.puzzles_20x20.value,
            }
        else:
            self.grid_counts = dict(self.GRID_PRESETS[preset.current_key])
        # Safety: never allow an empty goal (would make the seed unwinnable).
        if sum(self.grid_counts.values()) <= 0:
            self.grid_counts["5x5"] = 1

        # Beatability guard: held coins are capped by the wallet, so a difficulty step costing
        # more than the highest reachable cap can never be bought, making higher tiers (and the
        # goal) unreachable. Reject such seeds.
        wallet_caps = [49, 99, 999, 4999, 9999]
        max_level = min(4, self.options.starting_wallet_level.value + self.options.wallets_in_pool.value)
        max_cap = wallet_caps[max_level]
        cost_mode = self.options.difficulty_cost.current_key
        active = [s for s in (5, 10, 15, 20) if self.grid_counts[f"{s}x{s}"] > 0]
        for target in active[1:]:
            cost = self._difficulty_step_cost(cost_mode, target)
            if cost > max_cap:
                raise ValueError(
                    f"Nonopelagram: difficulty_cost '{cost_mode}' makes the {target}x{target} tier "
                    f"unreachable (step costs {cost} but the highest wallet capacity you can reach "
                    f"is {max_cap}). Increase starting_wallet_level / wallets_in_pool or choose a "
                    f"cheaper difficulty_cost."
                )

    def create_regions(self) -> None:
        """Create and connect all regions for this world."""
        create_regions(self)

    def create_items(self) -> None:
        """Create all items for the item pool."""
        item_count = 0

        # Items distributed proportionally across non-wallet / non-heart checks.
        # Ratio derived from the historical defaults (Hint 10 : Coin 15 : Cell 3).
        RATIO_ITEMS = (("Hint Reveal", 10), ("Coin Bundle", 15), ("Random Cell Solve", 3))
        ratio_names = {name for name, _ in RATIO_ITEMS}

        # Create fixed-count items (everything except the ratio-distributed pool).
        for item_name, item_data in item_table.items():
            if item_data.code is None or item_name in ratio_names:
                continue
            if item_name == "Extra Life":
                count = self.options.extra_lives_in_pool.value
            elif item_name == "Wallet Upgrade":
                count = self.options.wallets_in_pool.value
            elif item_name == "Heart Container":
                count = (
                    self.options.hearts_in_pool.value
                    if self.options.shop_hearts.value and not self.options.unlimited_lives.value
                    else 0
                )
            else:
                count = 1

            for _ in range(count):
                self.multiworld.itempool.append(self.create_item(item_name))
                item_count += 1

        # Count real locations for this player (excluding events). Counted from the
        # created regions, because some locations are added conditionally (shop checks),
        # so the static table would over-count.
        location_count = len([
            loc for loc in self.multiworld.get_locations(self.player)
            if loc.address is not None
        ])

        # Distribute the remaining locations across hint / coin / cell by fixed ratio.
        # Wallet and heart checks are already matched by their own items above, so they
        # are naturally excluded from this remainder.
        remaining = max(0, location_count - item_count)
        total_ratio = sum(weight for _, weight in RATIO_ITEMS)
        pool_counts = {}
        assigned = 0
        for name, weight in RATIO_ITEMS:
            n = remaining * weight // total_ratio
            pool_counts[name] = n
            assigned += n
        # Any rounding remainder goes to Coin Bundle (largest share / general filler).
        pool_counts["Coin Bundle"] += remaining - assigned
        for name, n in pool_counts.items():
            for _ in range(n):
                self.multiworld.itempool.append(self.create_item(name))

    def set_rules(self) -> None:
        """Set access rules for locations."""
        # Most locations just require completing puzzles, no special rules needed
        # Goal is to complete enough puzzles
        self.multiworld.completion_condition[self.player] = lambda state: (
            state.has("Victory", self.player)
        )

    def fill_slot_data(self) -> Dict[str, Any]:
        """Return slot data to be sent to the client."""
        unlimited_lives = bool(self.options.unlimited_lives.value)
        coins_per_bundle_map = {"low": 5, "normal": 50, "high": 100}
        coins_per_bundle = coins_per_bundle_map.get(
            self.options.coins_per_bundle.current_key,
            self.options.coins_per_bundle_custom.value,
        )
        return {
            "starting_lives": self.options.starting_lives.value,
            "starting_coins": self.options.starting_coins.value,
            "starting_hints": self.options.starting_hints.value,
            "coins_per_bundle": coins_per_bundle,
            "goal_puzzles": sum(self.grid_counts.values()),
            "puzzles_5x5": self.grid_counts["5x5"],
            "puzzles_10x10": self.grid_counts["10x10"],
            "puzzles_15x15": self.grid_counts["15x15"],
            "puzzles_20x20": self.grid_counts["20x20"],
            "starting_wallet_level": self.options.starting_wallet_level.value,
            "wallets_in_pool": self.options.wallets_in_pool.value,
            "hearts_in_pool": self.options.hearts_in_pool.value,
            "require_tier_completion": bool(self.options.require_tier_completion.value),
            "difficulty_cost": self.options.difficulty_cost.current_key,
            "life_restore_on_clear": self.options.life_restore_on_clear.current_key,
            "life_restore_custom": self.options.life_restore_custom.value,
            "shop_healing": bool(self.options.shop_healing.value),
            "healing_cost": self.options.healing_cost.current_key,
            "healing_cost_custom": self.options.healing_cost_custom.value,
            "zelda_heart_mode": bool(self.options.zelda_heart_mode.value),
            "shop_hearts": bool(self.options.shop_hearts.value),
            "heart_cost": self.options.heart_cost.current_key,
            "heart_cost_custom": self.options.heart_cost_custom.value,
            "flawless_checks": bool(self.options.flawless_checks.value),
            "debug_mode": bool(self.options.debug_mode.value),
            "auto_x": bool(self.options.auto_x.value),
            "grey_completed_hints": bool(self.options.grey_completed_hints.value),
            "unlimited_lives": unlimited_lives,
            "death_link": int(self.options.death_link.value),
            # With finite lives, mistakes must be shown in real-time (locked on the client).
            "show_mistakes": True if not unlimited_lives else bool(self.options.show_mistakes.value),
        }
