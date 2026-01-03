# Archipelago Nonogram

A web-based Nonogram (Picross) puzzle game with [Archipelago](https://archipelago.gg/) multiworld randomizer integration.

## Playable online at:
https://stefanducharme.github.io/nonogram-archipelago/

## Features

- **Nonogram Puzzles**: Classic logic puzzle gameplay
- **Archipelago Integration**: Connect to Archipelago multiworld servers to receive items and send checks
- **Progressive Unlocks**: Start with limited Hint Visibility
- **Resource System**: Manage lives and coins as you solve puzzles
- **Difficulty Progression**: Start at 5x5 grids and unlock larger puzzles
- **Shop System**: Spend coins on temporary hints and other powerups

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)
- Archipelago (only required to generate or host a game) https://github.com/ArchipelagoMW/Archipelago

## Getting Started

### 1. Get the code

**Option A: Clone with Git**
```bash
git clone https://github.com/yourusername/nonogram-archipelago.git
cd nonogram-archipelago/nuxt-nonogram
```

**Option B: Download without Git**
1. Go to the GitHub repository page
2. Click the green **Code** button
3. Select **Download ZIP**
4. Extract the ZIP file to a folder on your computer
5. Open a terminal/command prompt and navigate to the `nuxt-nonogram` folder:
   ```bash
   cd path/to/nonogram-archipelago/nuxt-nonogram
   ```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`


## Archipelago Local Testing & Setup

### 1. Build the APWorld file

Open a terminal and run:

```powershell
cd E:\repo\personal\nonogram-archipelago\apworld
python build_apworld.py
```

This creates `nonogram.apworld` in the `apworld` folder.

### 2. Install the APWorld in Archipelago

1. Open `ArchipelagoLauncher.exe`
2. Click **"Install APWorld"**
3. Select the `nonogram.apworld` file you just built
4. Restart the Launcher if prompted

### 3. Create a Test YAML

Copy the example YAML to the Archipelago `Players` folder:

```powershell
copy apworld\Nonogram.yaml <ARCHIPELAGO_PATH>\Players\
```

Or create `Players/Nonogram.yaml` with:

```yaml
name: TestPlayer
game: Nonogram
Nonogram:
  starting_lives: 3
  starting_coins: 5
  starting_hints: 1
  coins_per_bundle: 5
  extra_lives_in_pool: 5
  hint_reveals_in_pool: 10
  coin_bundles_in_pool: 15
  cell_solves_in_pool: 3
  goal_puzzles: 16
  death_link: false
```

### 4. Generate a Game

1. In the Archipelago Launcher, click **"Generate"**
2. It will use YAML files from your Players folder
3. The generated `.archipelago` file appears in the `output/` folder

### 5. Start the Server

**Using the Launcher:**
1. Open `ArchipelagoLauncher.exe`
2. Click "Host"
3. Select your generated `.archipelago` file from `output/`



The server will display:
```
Server running on port 38281
```

### 6. Start the Nonogram Client

In a new terminal:

```powershell
cd E:\repo\personal\nonogram-archipelago
npm run dev
```

Open http://localhost:3000 in your browser.

### 7. Connect

1. Click on the **Archipelago** tab in the right panel
2. Enter connection details:
   - **Host**: `localhost`
   - **Port**: `38281`
   - **Slot**: `TestPlayer` (must match your YAML `name` field)
   - **Password**: (leave empty unless you set one)
3. Click **Connect**

### Game Options

| Option                | Range   | Default | Description                        |
|-----------------------|---------|---------|------------------------------------|
| `starting_lives`      | 1-10    | 3       | Lives per puzzle                   |
| `starting_coins`      | 0-50    | 5       | Starting coins                     |
| `starting_hints`      | 0-5     | 1       | Hints revealed per puzzle          |
| `coins_per_bundle`    | 1-50    | 5       | Coins per Coin Bundle item         |
| `extra_lives_in_pool` | 0-50    | 5       | Extra Life items in pool           |
| `hint_reveals_in_pool`| 0-50    | 10      | Hint Reveal items in pool          |
| `coin_bundles_in_pool`| 0-50    | 15      | Coin Bundle items in pool          |
| `cell_solves_in_pool` | 0-50    | 3       | Cell Solve items in pool           |
| `goal_puzzles`        | 1-100   | 16      | Puzzles required to win            |
| `death_link`          | true/false | false | Share deaths with other players    |

## Usage

### Free Play Mode
By default, the game runs in Free Play mode with all features unlocked. You can adjust puzzle size, generate new puzzles, and play without any restrictions.

### Archipelago Mode
1. Click the **Archipelago** tab in the right panel
2. Enter your server details:
   - **Host**: The Archipelago server address (e.g., `archipelago.gg` or `localhost`)
   - **Port**: Server port (default: `38281`)
   - **Player Name**: Your slot name from the multiworld
   - **Password**: Room password (if required)
3. Click **Connect**

In Archipelago Mode:
- Features are locked until you receive them from other players
- Complete puzzles to send checks to the multiworld
- Resource settings come from your YAML configuration
- Receive items from other players in your multiworld

### Items You Can Receive
- **Hint Reveal** - See more row/column hints
- **Extra Life** - Increase max lives
- **Coin Bundle** - Get coins for the shop
- **Random Cell Solve** - Auto-solve one cell

### Controls
- **Left Click**: Fill a cell
- **Right Click**: Mark a cell with X
- **Shift + Click** or **Click again**: Erase a cell

## Development

### Tech Stack
- [Nuxt 4](https://nuxt.com/) - Vue.js framework
- [Vue 3](https://vuejs.org/) - Frontend framework
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [archipelago.js](https://github.com/ThePhar/archipelago.js) - Archipelago client library

### Project Structure
```
nonogram-archipelago/
├── app/                    # Nuxt application
│   ├── components/         # Vue components
│   ├── composables/        # Vue composables (game logic, AP integration)
│   ├── pages/              # Page components
│   └── plugins/            # Nuxt plugins (AP client setup)
├── apworld/                # Archipelago world files
│   ├── nonogram/           # Python world implementation
│   ├── build_apworld.py    # APWorld packaging script
│   └── Nonogram.yaml       # Example player YAML
└── README.md               # This file
```

### Scripts

```bash
# Start development server
npm run dev

# To generate static site for hosting
npm run generate

# Build APWorld
cd apworld && python build_apworld.py
```

## License

MIT
