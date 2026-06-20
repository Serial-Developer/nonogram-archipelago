# Changelog

All notable changes to Nonopelagram (the nonogram Archipelago world + web client) are documented here.

## [1.0.2]

Requires Archipelago 0.6.7 or newer.

### Fixed
- Multiworld logic: difficulty tiers and the goal are now gated behind the Wallet Upgrade items the player actually receives. Paid-difficulty seeds with wallets in the pool previously left the world fully open, which could place another world's progression behind locations the player could not yet afford and make a seed unwinnable.
- Replaced an over-strict beatability guard that rejected winnable seeds: it collapsed the starting wallet level and pooled wallets into a single cap and ignored that wallet levels above wallets_in_pool are bought in-shop with farmed coins.
- Localization: English (and other non-French) players no longer see hardcoded French text in the shop / purchase notices, the flawless-streak line, the items-sent / checks-unlocked counters and the difficulty-progression messages; these now resolve through the locale files.

### Changed
- Hint Reveal is reclassified from progression to useful (it never gated a location); its item group is renamed from "Progression" to "Hints".
- Wallet Upgrade is promoted to progression only when a wallet gate actually applies to the seed; otherwise it stays useful.

### Added
- Universal Tracker support: the world can be re-generated from slot_data alone (interpret_slot_data + ut_can_gen_without_yaml), so trackers report the correct in-logic locations and reveal the higher difficulty tiers as Wallet Upgrades are received.

### Internal
- Manifest world_version bumped to 1.0.2; Serial-Developer added to authors.

## [1.0.0]

First stable release. Requires Archipelago 0.6.7 or newer.

### Archipelago integration
- Full YAML/slot_data driven configuration: the client receives every world setting on connect, no manual client toggles.
- Built-in Options Creator compatible (no custom tooling required to generate a YAML).

### Locations (checks)
- Puzzle completions per grid size (5x5, 10x10, 15x15, 20x20).
- First-line-of-the-puzzle checks.
- Coin milestone checks.
- Flawless (no-mistake) clear checks: per size, a "in a row" streak check, and a flawless-total check.
- Wallet upgrade shop slots become multiworld checks (wallets_in_pool).
- Heart container shop slots become multiworld checks (hearts_in_pool).

### Items
- Hint reveals, Extra Lives, Coin Bundles, Solve-Random-Cell tokens, Wallet Upgrades, Heart Containers.

### Server-authoritative economy
- Coins, lives, hearts (incl. Zelda-style quarter hearts), wallet level, flawless streak/total and in-progress health are persisted to the Archipelago data storage.
- Balances survive reconnects and follow the player across devices; item-fed balances are replayed exactly once via a stored high-water-mark.

### Gameplay systems
- Difficulty progression 5x5 -> 20x20 with require_tier_completion and difficulty_cost (free or coins).
- Lives: starting lives, life restore on clear (none / one / custom / full), optional unlimited lives, and a shop heal.
- Hearts: optional Zelda-style heart containers (quarter-heart purchases), shop hearts, hearts in the multiworld pool.
- Wallets: coin-cap upgrades, optionally seeded into the multiworld pool.
- Flawless tracking with an on-screen win-streak indicator on the solved / game-over popups.
- Goal: clear the configured number of puzzles (collapsible per-size breakdown in the client).

### Death Link
- Single 3-way option: off / on (lose all lives) / damage (lose a single heart on a received link).

### Client UX
- Checks tab with collapsible per-size sections, a goal panel, wallet and heart check sections.
- Pooled shop slots display the scouted Archipelago item (icon, name, classification, recipient) from the moment of connection.
- Purchase / claim notifications.
- Coin icon shown on every shop price.
- Column / row clues aligned to the centres of their grid columns / rows.
- Debug tab exposing the slot_data simulator (and gated behind a debug_mode option when connected).

### Known limitations
- The client layout is not yet mobile-responsive (planned for the next release).
