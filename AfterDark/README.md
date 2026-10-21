GitHub repo link: https://github.com/Manasa95307/AIML-DAA_Microproject.git
Deployment link: https://afterdark-nu.vercel.app/


# Nightfall Survival — AIML + DAA Microproject

A small top-down zombie survival game made with only HTML, CSS and Vanilla JavaScript.

## Run

Open `index.html` directly in a modern browser. No build tools, server, React, Python, APIs or external libraries are required.

## Gameplay

- WASD: move
- Left mouse click: shoot
- R: reload
- SPACE: dash
- Collect medkits, ammo and energy
- Survive the opening phase
- Reach the extraction zone when it opens
- Survive later waves of faster zombies

## AIML Integration

### Intelligent Agent
Every zombie periodically perceives the player/environment, evaluates its state and chooses an action.

### State Space
Zombie decisions use the current player position/health/energy, zombie position/health, resources and wave.

### Knowledge Representation
The agent has a representation of the map graph, visible resources, the player's visible location and its own state.

### Rule-Based Reasoning
Examples:
- Low health → retreat/search for safer route.
- Player within attack range → attack.
- Player detected → chase using shortest safe route.
- Player not detected → search the last known region.

### Heuristic Evaluation
Candidate graph nodes are scored using player distance, relative danger and nearby resource value.

## DAA Integration

### Graph
The city navigation layer is stored as an adjacency list.

### BFS
BFS finds a shortest route through the navigation graph and supplies player distance information to zombie decisions.

### DFS
DFS explores reachable graph regions. The implementation keeps a real DFS traversal available for the AI system and viva demonstration.

### Best-First Search
Best-First Search prioritizes promising graph nodes using a heuristic and directly influences zombie movement.

### Data Structures
- BFS → queue + visited set
- DFS → stack + visited set
- Best-First → ordered open list
- Graph → adjacency list

## Why the integration is genuine

The algorithms are not only shown in a panel. They influence actual zombie movement:

1. Zombie observes current game state.
2. Rule engine determines its behavioral mode.
3. BFS calculates route/distance.
4. Best-First Search selects a promising direction.
5. Heuristic scores candidate movement.
6. Zombie moves/attacks in the game world.

The optional AI Analysis panel exposes this reasoning so it can be demonstrated during a viva without taking over the main gameplay UI.

## UI/UX

The visual direction is a dark neon survival-game HUD:
- cinematic dark map
- cyan player
- red zombies
- red/blue/yellow status bars
- compact objective tracker
- mini-map
- optional AI analysis panel
- combat buttons
- event feed
- start, help and game-over screens

## Important note

This is an educational microproject. The game uses a simplified graph navigation model and lightweight rule/heuristic agent rather than a machine-learning model or external AI service.


## Version 3 changes

- Restores the complete playable map/gameplay from the original working version.
- Adds 3 sequential levels: Easy, Medium, Hard.
- Clears all zombies + reaches extraction to complete each level.
- Shows a centered AI congratulations screen with animated confetti before the next level.
- Adds Arrow Keys alongside WASD.
- Adds a touch-friendly lower-right movement pad and dash button.


## Version 5 stability fix

- Rebuilt from the working gameplay build.
- Removed stale AI/map controls that caused the JavaScript startup crash.
- Ensured there is exactly one mini-map canvas.
- Objective, Map and AI are right-aligned collapsible bars.
- Spacebar pauses/resumes with a visible pause overlay.
- Arrow keys + WASD and phone controls are supported.
- Extraction unlocks once all zombies are eliminated, so the gameplay loop is clear.


## Version 5 final stability

The project was rebuilt from the working gameplay base and checked for:
- JavaScript syntax errors
- duplicate HTML IDs
- missing JavaScript-to-HTML element references
- stale references to removed controls
- duplicate minimap canvases

Gameplay includes the original map, zombies, combat and AI, plus the requested right-side collapsible utility stack, pause system, levels, keyboard and phone controls.


Celebration update: replaced the old stripe-style effect with a colorful radial confetti burst around the centered congratulations card.
