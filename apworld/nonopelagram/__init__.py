"""
Nonopelagram Archipelago World

A picross/nonogram puzzle game for Archipelago multiworld randomizer.
"""

from typing import Dict, Any, ClassVar
from BaseClasses import Item, ItemClassification, Location, Region, Tutorial
from worlds.AutoWorld import World, WebWorld
from .Items import NonogramItem, item_table, item_groups
from .Locations import NonogramLocation, location_table
from .Options import NonogramOptions
from .Regions import create_regions


# === Wallet economy — MUST stay in sync with app/composables/useArchipelagoItems.ts
# (WALLET_CAPS ~l.105, WALLET_PRICES ~l.107). ===
WALLET_CAPS = [49, 99, 999, 4999, 9999]   # coin capacity at each wallet level (index = level)
WALLET_PRICES = [0, 30, 90, 900, 3333]    # shop price to obtain each wallet level (index = level)


def _wallet_level_for_cost(cost: int):
    """Smallest wallet level whose capacity can hold `cost` coins, or None if cost > max cap."""
    for level, cap in enumerate(WALLET_CAPS):
        if cap >= cost:
            return level
    return None


def _wallets_required(cost: int, start_level: int, wallets_in_pool: int):
    """Number of Wallet Upgrade items that must be RECEIVED to afford `cost` coins.

    S = start_level, P = wallets_in_pool. Wallet levels at or below P live in the multiworld
    pool and must be received; levels above P are auto-bought in-shop with coins (never gated).
    Returns None when `cost` exceeds the highest wallet capacity (unaffordable at any level).
    """
    level = _wallet_level_for_cost(cost)
    if level is None:
        return None
    return max(0, min(level, wallets_in_pool) - start_level)


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

    # Universal Tracker: allow regenerating this slot purely from its slot_data (no YAML on the
    # tracker's side). Works together with interpret_slot_data / generate_early's passthrough path.
    ut_can_gen_without_yaml = True

    def create_item(self, name: str) -> NonogramItem:
        """Create an item for this world.

        Wallet Upgrade is promoted to progression only when a wallet gate actually bites this
        seed (computed in generate_early as self._wallet_gates); otherwise it stays useful.
        Every other item keeps its static classification from the item table.
        """
        item_data = item_table[name]
        classification = item_data.classification
        if name == "Wallet Upgrade" and getattr(self, "_wallet_gates", False):
            classification = ItemClassification.progression
        return NonogramItem(name, classification, item_data.code, self.player)

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

    @staticmethod
    def _heart_step_cost(mode: str, custom: int, m: int) -> int:
        """Coin cost of the m-th shop heart (1-based) under a heart_cost mode (mirror of client)."""
        if mode == "free":
            return 0
        if mode == "low":
            return 30
        if mode == "high":
            return 300
        if mode == "progressive":
            return min(9999, 50 * m)
        if mode == "custom":
            return custom
        return 100  # normal (default)

    def _wallets_needed(self, cost: int):
        """Wallet Upgrades to receive to afford `cost` coins, for this world's S and P."""
        return _wallets_required(
            cost,
            self.options.starting_wallet_level.value,
            self.options.wallets_in_pool.value,
        )

    def wallet_access_rule(self, cost: int):
        """Access rule for a location/connection guarded by needing `cost` coins.

        Returns None when no Wallet Upgrade is required (affordable from the start), or a
        `lambda state: state.has("Wallet Upgrade", player, n)` rule. Raises ValueError when
        `cost` can never be afforded (exceeds the max wallet capacity) — an unbeatable seed.
        """
        n = self._wallets_needed(cost)
        if n is None:
            raise ValueError(
                f"Nonopelagram: a required coin cost of {cost} exceeds the highest wallet "
                f"capacity ({WALLET_CAPS[-1]}), so the seed would be unbeatable. This only "
                f"happens with an aberrant custom cost — lower it."
            )
        if n == 0:
            return None
        player = self.player
        return lambda state, n=n, player=player: state.has("Wallet Upgrade", player, n)

    def difficulty_access_rule(self, target_size: int):
        """Wallet rule for the connection that reaches the `target_size` tier."""
        return self.wallet_access_rule(
            self._difficulty_step_cost(self.options.difficulty_cost.current_key, target_size)
        )

    def wallet_shop_access_rule(self, k: int):
        """Wallet rule for claiming the level-`k` wallet shop check (costs WALLET_PRICES[k])."""
        return self.wallet_access_rule(WALLET_PRICES[k])

    def heart_shop_access_rule(self, m: int):
        """Wallet rule for claiming the m-th heart shop check (costs the m-th heart's price)."""
        return self.wallet_access_rule(
            self._heart_step_cost(
                self.options.heart_cost.current_key,
                self.options.heart_cost_custom.value,
                m,
            )
        )

    def interpret_slot_data(self, slot_data: dict) -> dict:
        """Universal Tracker hook. Returning the slot_data triggers a passthrough re-gen so
        generate_early can restore the exact gating state (the grid preset and per-slot options
        are not otherwise recoverable during tracking)."""
        return slot_data

    def _restore_from_slot_data(self, sd: dict) -> None:
        """Restore generation-affecting state from slot_data (Universal Tracker re-gen)."""
        self.grid_counts = {
            "5x5": sd.get("puzzles_5x5", 0),
            "10x10": sd.get("puzzles_10x10", 0),
            "15x15": sd.get("puzzles_15x15", 0),
            "20x20": sd.get("puzzles_20x20", 0),
        }
        o = self.options
        o.starting_wallet_level.value = sd.get("starting_wallet_level", o.starting_wallet_level.value)
        o.wallets_in_pool.value = sd.get("wallets_in_pool", o.wallets_in_pool.value)
        dc = sd.get("difficulty_cost")
        if dc is not None:
            o.difficulty_cost.value = type(o.difficulty_cost).options[str(dc)]
        o.shop_hearts.value = int(sd.get("shop_hearts", o.shop_hearts.value))
        o.unlimited_lives.value = int(sd.get("unlimited_lives", o.unlimited_lives.value))
        o.hearts_in_pool.value = sd.get("hearts_in_pool", o.hearts_in_pool.value)
        hc = sd.get("heart_cost")
        if hc is not None:
            o.heart_cost.value = type(o.heart_cost).options[str(hc)]
        o.heart_cost_custom.value = sd.get("heart_cost_custom", o.heart_cost_custom.value)
        o.flawless_checks.value = int(sd.get("flawless_checks", o.flawless_checks.value))
        o.require_tier_completion.value = int(sd.get("require_tier_completion", o.require_tier_completion.value))

    def generate_early(self) -> None:
        """Resolve the effective per-size puzzle counts from the preset/custom options.

        Under Universal Tracker re-generation, multiworld.re_gen_passthrough carries this slot's
        slot_data, from which we restore grid_counts and the gating options exactly (the preset
        isn't sent, so it can't be re-derived otherwise)."""
        passthrough = getattr(self.multiworld, "re_gen_passthrough", None)
        if passthrough and self.game in passthrough:
            self._restore_from_slot_data(passthrough[self.game])
        else:
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

        # Wallet gating. This replaces the old, over-strict guard that summed starting_wallet_level
        # + wallets_in_pool into a single reachable cap and rejected any step costing more than it.
        # That guard ignored that wallet levels above the pool are auto-bought in-shop with coins,
        # so it wrongly rejected winnable seeds (e.g. difficulty_cost=normal with wallets_in_pool=0,
        # where every level is simply bought with coins).
        #
        # Now we only (a) reject a truly unbeatable seed — a required coin cost above the highest
        # wallet capacity (9999), which the built-in modes never reach (max 1999) and only an
        # aberrant custom cost could hit — and (b) record whether any wallet gate actually bites,
        # which drives the Wallet Upgrade classification (create_item) and the rules (Regions.py).
        start = self.options.starting_wallet_level.value
        pool = self.options.wallets_in_pool.value
        cost_mode = self.options.difficulty_cost.current_key
        active = [s for s in (5, 10, 15, 20) if self.grid_counts[f"{s}x{s}"] > 0]

        self._wallet_gates = False

        def _check_gate(cost: int) -> None:
            n = _wallets_required(cost, start, pool)
            if n is None:
                raise ValueError(
                    f"Nonopelagram: a required coin cost of {cost} exceeds the highest wallet "
                    f"capacity ({WALLET_CAPS[-1]}), making the seed unbeatable. Lower the cost "
                    f"(only an aberrant custom heart cost can reach this)."
                )
            if n > 0:
                self._wallet_gates = True

        # Difficulty steps required to reach each tier above the start tier (these gate the goal).
        for target in active[1:]:
            _check_gate(self._difficulty_step_cost(cost_mode, target))

        # Mandatory wallet shop checks (levels 1..pool): their purchase price must be affordable.
        for k in range(1, pool + 1):
            _check_gate(WALLET_PRICES[k])

        # Heart shop checks (1..hearts_in_pool), only with finite lives + shop hearts.
        if self.options.shop_hearts.value and not self.options.unlimited_lives.value:
            heart_mode = self.options.heart_cost.current_key
            heart_custom = self.options.heart_cost_custom.value
            for m in range(1, self.options.hearts_in_pool.value + 1):
                _check_gate(self._heart_step_cost(heart_mode, heart_custom, m))

        # Invariant (always holds): the goal never needs more Wallet Upgrades than the pool size,
        # since required = max(0, min(L, P) - S) <= P. Kept as a defensive check.
        goal_reqs = [
            _wallets_required(self._difficulty_step_cost(cost_mode, t), start, pool) or 0
            for t in active[1:]
        ]
        assert all(r <= pool for r in goal_reqs), (
            "Nonopelagram: goal needs more Wallet Upgrades than the pool provides"
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
        """Set the completion condition.

        Per-tier and per-location access rules live in Regions.py: wallet gates on the tier
        connections and on the wallet/heart shop checks. When no gate bites (self._wallet_gates
        is False) the world is fully open — every location is reachable from the start, so a
        Universal Tracker "all in logic" pass is expected. When a gate bites, real spheres form:
        the goal and the gated tiers require the corresponding received Wallet Upgrade items.
        """
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
