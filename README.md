# Nonopelagram

A web-based Nonogram (Picross) puzzle game with [Archipelago](https://archipelago.gg/) multiworld randomizer integration.

This project is a fork and continuation of the original [Nonogram Archipelago](https://github.com/StefanDucharme/nonogram-archipelago) by **Stefan Ducharme**, expanded into a full, economy-driven multiworld experience.

## Play online

**[Play Nonopelagram in your browser](https://serial-developer.github.io/nonogram-archipelago/)** -- no install needed.

(Original by Stefan Ducharme: https://stefanducharme.github.io/nonogram-archipelago/)

## Features

- **Nonogram puzzles** -- classic logic puzzles across four grid sizes (5x5 to 20x20).
- **Archipelago integration** -- fully YAML / slot_data driven; receive items and send location checks.
- **Difficulty progression** -- unlock larger grids, optionally gated by tier completion or coin cost.
- **Lives system** -- per-puzzle lives, life-restore-on-clear, an optional unlimited-lives mode, and a shop heal.
- **Hearts** -- optional Zelda-style heart containers (quarter-heart purchases), up to 10 hearts.
- **Coin economy & wallet** -- earn coins, upgrade your wallet (coin cap), and spend in the shop.
- **Multiworld shop checks** -- pooled wallet upgrades and heart containers become location checks that display the scouted item.
- **Flawless tracking** -- no-mistake clears send checks, with an on-screen win-streak indicator.
- **Death Link** -- off / on (lose all lives) / damage (lose a single heart).
- **Server-synced economy** -- coins, lives, hearts, wallet level and streaks persist on the Archipelago server; they survive reconnects and follow you across devices.
- **Configurable goal** -- clear a chosen number of puzzles per grid size.
- **English & French** -- the whole interface is localized; switch language in Settings (it auto-detects your browser language on first load).
- **Responsive & mobile-ready** -- burger-menu navigation, an on-screen D-pad, and a board that always fits the screen with no scrolling.
- **Three cell states** -- fill, X, and a "?" maybe/template mark that never costs a life.
- **Navigation aids** -- the active row, column and their clues highlight while you move with the D-pad.

## Setting up an Archipelago game

You only need this section to **generate or host** a multiworld. To play in an existing room, jump straight to [Connect](#4-connect) and use the [online client](https://serial-developer.github.io/nonogram-archipelago/).

**Requirement:** [Archipelago](https://github.com/ArchipelagoMW/Archipelago/releases) 0.6.7 or newer.

### 1. Install the APWorld

1. Download `nonopelagram.apworld` from the [latest release](https://github.com/Serial-Developer/nonogram-archipelago/releases) (or build it from source -- see [Local development](#local-development)).
2. Open `ArchipelagoLauncher.exe`, click **Install APWorld**, and select the file.
3. Restart the Launcher if prompted.

### 2. Create a YAML

Use the Launcher's **Generate Template Options** (it writes a fully commented `Players/Templates/Nonopelagram.yaml`) or the in-Launcher **Options Creator**. Example YAMLs are also in `apworld/` (`Nonopelagram.yaml`, `Nonopelagram-adv.yaml`).

A minimal player YAML:

```yaml
name: TestPlayer
game: Nonopelagram
requires:
  version: 0.6.7
Nonopelagram:
  grid_preset: normal
  starting_lives: 3
  starting_coins: 5
  flawless_checks: true
  death_link: "off"
```

Place your YAML in the Archipelago `Players/` folder.

### 3. Generate & host

1. In the Launcher, click **Generate** (it uses the YAMLs in `Players/`).
2. **Host** the generated `.archipelago` file from `output/`.

### 4. Connect

Open the **[online client](https://serial-developer.github.io/nonogram-archipelago/)**, go to the **Archipelago** tab, and enter:

- **Host** -- e.g. `archipelago.gg` or `localhost`
- **Port** -- your room's port
- **Slot** -- your YAML `name`
- **Password** -- if the room has one

## Game options

All options are set in your YAML. Defaults are shown below; generate the template (**Generate Template Options**) for the authoritative, fully commented list.

### Start & item pool

| Option | Values | Default | Description |
|---|---|---|---|
| `starting_lives` | 1-10 | 3 | Lives per puzzle |
| `starting_coins` | 0-50 | 5 | Coins you start with |
| `starting_hints` | 0-5 | 1 | Hints revealed per puzzle |
| `starting_wallet_level` | 0-4 | 0 | Starting coin cap (0=49 ... 4=9999) |
| `coins_per_bundle` | low / normal / high / custom | normal | Coins per Coin Bundle (low=5, normal=50, high=100) |
| `coins_per_bundle_custom` | 0-999 | 50 | Coins per bundle when `coins_per_bundle` is custom |
| `extra_lives_in_pool` | 0-10 | 5 | Extra Life items in the pool |
| `wallets_in_pool` | 0-4 | 0 | Wallet upgrades placed in the multiworld (shop slots become checks) |
| `hearts_in_pool` | 0-10 | 0 | Heart containers placed in the shop as checks |

Hint Reveal, Coin Bundle and Random Cell Solve items are distributed automatically across the remaining checks (fixed 10:15:3 ratio), so they have no pool-size options.

### Grid & goal

| Option | Values | Default | Description |
|---|---|---|---|
| `grid_preset` | easy / normal / hard / evil / expedition_33 / custom | normal | Puzzle counts per size (goal = their sum) |
| `puzzles_5x5` | 0-100 | 10 | 5x5 puzzles (custom preset only) |
| `puzzles_10x10` | 0-100 | 10 | 10x10 puzzles (custom preset only) |
| `puzzles_15x15` | 0-100 | 10 | 15x15 puzzles (custom preset only) |
| `puzzles_20x20` | 0-100 | 10 | 20x20 puzzles (custom preset only) |
| `require_tier_completion` | true/false | true | Must clear a size before buying the next |
| `difficulty_cost` | free / low / normal / high / progressive | low | Coin cost to raise difficulty |

### Lives & hearts

| Option | Values | Default | Description |
|---|---|---|---|
| `unlimited_lives` | true/false | false | Play without losing lives on mistakes |
| `show_mistakes` | true/false | true | Highlight wrong cells (forced on when using lives) |
| `life_restore_on_clear` | none / one / full / custom | full | Lives restored after a clear |
| `life_restore_custom` | 0-20 | 3 | Lives restored when set to custom |
| `shop_healing` | true/false | false | Offer a heal purchase |
| `healing_cost` | free / low / normal / high / progressive / custom | normal | Cost of one heal |
| `healing_cost_custom` | 0-9999 | 30 | Flat heal cost when set to custom |
| `zelda_heart_mode` | true/false | false | Buy quarter-hearts (4 = +1 max heart) |
| `shop_hearts` | true/false | false | Offer heart-container purchases |
| `heart_cost` | free / low / normal / high / progressive / custom | normal | Cost per heart purchase |
| `heart_cost_custom` | 0-9999 | 100 | Flat heart cost when set to custom |

### Misc

| Option | Values | Default | Description |
|---|---|---|---|
| `death_link` | off / on / damage | off | on = lose all lives; damage = lose a single heart |
| `auto_x` | true/false | true | Auto-X the rest of a completed line |
| `grey_completed_hints` | true/false | true | Grey out satisfied hint numbers |
| `flawless_checks` | true/false | true | Send checks for no-mistake clears |
| `debug_mode` | true/false | false | Show the in-client Debug tab |

Standard Archipelago options (`progression_balancing`, `accessibility`, item/location plando, etc.) are also supported.

## Items you can receive

- **Hint Reveal** -- reveal another row/column hint
- **Extra Life** -- increase your lives
- **Coin Bundle** -- coins for the shop
- **Random Cell Solve** -- auto-solve one cell
- **Wallet Upgrade** -- raise your coin cap (when seeded in the pool)
- **Heart Container** -- raise your max hearts (when seeded in the pool)

## Controls

- **Left click**: fill a cell
- **Right click**: mark a cell with X
- **Middle click**: mark a cell as "?" (maybe / template -- never costs a life)
- **Shift + click** / **click again**: erase a cell
- **Mobile**: move the cursor with the on-screen D-pad and place marks with the Mode toggle (fill / ? / X)

## Usage modes

- **Free play** -- all features unlocked; pick any size and play with no restrictions.
- **Archipelago** -- features and difficulty come from your YAML; complete puzzles to send checks and receive items from the multiworld. Your economy is saved on the server and restored on reconnect.

## Hosting your own copy (GitHub Pages)

The client is a static (SPA) Nuxt build and ships with a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys it to GitHub Pages on every push to `master`.

To enable it on your fork:

1. **Actions** tab -> enable workflows (forks have Actions disabled by default).
2. **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
3. **Actions** tab -> **Deploy to GitHub Pages** -> **Run workflow** (or just push to `master`).

Your site will then be live at `https://<your-account>.github.io/nonogram-archipelago/`. The base path is provided by the `NUXT_APP_BASE_URL` env var in the workflow (defaults to `/nonogram-archipelago/`, matching the repo name).

## Local development

Only needed to work on the client or build the APWorld from source -- **playing does not require any of this** (use the [online client](https://serial-developer.github.io/nonogram-archipelago/)).

**Prerequisites:** [Node.js](https://nodejs.org/) v20+ and npm. ([Archipelago](https://github.com/ArchipelagoMW/Archipelago/releases) 0.6.7+ is only needed to generate or host games.)

### Run the client locally

```bash
git clone https://github.com/Serial-Developer/nonogram-archipelago.git
cd nonogram-archipelago
npm install
npm run dev
```

The dev server runs at http://localhost:3000.

### Build the APWorld from source

```bash
cd apworld
python build_apworld.py
```

This creates `nonopelagram.apworld` in the `apworld` folder.

### Tech stack

- [Nuxt 4](https://nuxt.com/) + [Vue 3](https://vuejs.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [archipelago.js](https://github.com/ThePhar/archipelago.js)

### Project structure

```
nonogram-archipelago/
  app/                    # Nuxt web client
    components/           # Vue components (NonogramBoard, ThemePicker, ...)
    composables/          # game logic + Archipelago integration
    pages/                # page components
  apworld/                # Archipelago world (Python)
    nonopelagram/         # world: Options, Items, Locations, Regions, __init__
    build_apworld.py      # APWorld packaging script
    Nonopelagram.yaml     # example player YAML
  .github/workflows/      # GitHub Pages deploy workflow
  CHANGELOG.md
  README.md
```

### Scripts

```bash
npm run dev        # start the dev server
npm run generate   # build the static site (for hosting)
cd apworld && python build_apworld.py   # build the APWorld
```

## Credits

- Original **Nonogram** game & Archipelago integration: **Stefan Ducharme**
- Fork additions (economy, hearts, wallets, flawless, multiworld shop checks, server sync, Death Link modes, UX): see the commit history and [`CHANGELOG.md`](./CHANGELOG.md).

## License

MIT