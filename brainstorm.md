Here is a comprehensive **Game Design Document (GDD)** and a **Technical Starter Model** for your project, "Dugout Dynasty" (working title).

This document is designed to be your "North Star." You can refer back to it whenever you get stuck on a feature.

# ---

**Part 1: Game Design Document (GDD)**

### **1\. High Concept**

A fast-paced, turn-based browser strategy game where you manage a baseball franchise from a sandlot scrub team to a legendary dynasty. You treat players like RPG characters, equipping them with loot and managing their stamina, while upgrading your stadium to fund the empire.

- **Tagline:** _Moneyball meets RPG._

### **2\. The Core Loop**

1. **Prepare:** Optimize your roster (swap tired players, equip items, upgrade stadium).
2. **Action:** Click **"Play Match"** (consumes Stamina, generates Cash/XP).
3. **Result:** View instant match summary (Win/Loss).
4. **Invest:** Spend Cash on Recruitment, Facilities, or Training.
5. **Advance:** Repeat until end of Season $\\rightarrow$ Promotion/Relegation.

### **3\. The "RPG" Stats System**

We replace complex simulation with 3 role-specific stats for each position.

**Batters:**

- **Power (PWR):** Home run and extra-base hitting power. Direct run generation.
- **Contact (CON):** Ability to get on base, hit singles. Reduces offensive variance and provides consistency.
- **Glove (GLV):** Fielding defense. Reduces error chance that could give opponent free runs.

**Pitchers:**

- **Velocity (VEL):** Fastball speed and strikeout power. Directly reduces opponent's run generation.
- **Control (CTL):** Strike accuracy and walk prevention. Reduces defensive variance and prevents blow-up innings.
- **Break (BRK):** Breaking ball movement and deception. Makes opponent's Contact less effective.

### **4\. Key Mechanics**

- **Stamina System:**
  - Players have 0-100% Energy.
  - Playing a match costs 15%.
  - Performance drops if Energy \< 50%.
  - **Recovery:** Players _only_ recover when sitting on the Bench during a match. This forces Roster Rotation.
- **The League Ladder:**
  - 5 Tiers (Sandlot $\\rightarrow$ Local $\\rightarrow$ Regional $\\rightarrow$ National $\\rightarrow$ World).
  - Top 2 promote; Bottom 2 relegate.
  - Promotion increases "Ticket Price" (Income) but also "Opponent Difficulty."
- **Itemization (Loot):**
  - You don't just "train" players; you equip them.
  - **Head:** Focus (Increases Glove).
  - **Bat:** Slugger (Increases Power).
  - **Shoes:** Speed (Chance to turn a Single into a Double).

### **5\. The Economy**

- **Cash ($):** The primary fuel. Earned from matches. Used for Wages and Buildings.
- **Fans (Hype):** A multiplier. Winning streaks increase Fans ($1.0x \\rightarrow 1.5x$ income). Losing streaks reset it.
- **Scout Points:** Earned slowly over seasons. Used to generate new "Draft Cards."

# ---

**Part 2: The Coding Model (Technical Starter)**

Since you want to focus on management/UI over graphics, the best approach is a **Web-App Architecture** (React, Vue, or Svelte). The "game" is essentially a beautiful interactive dashboard.

### **1\. The Data Structures (JSON Schema)**

These are the fundamental building blocks of your game state.

**A. The Player Card**

TypeScript

interface BatterStats {
power: number; // PWR - Home run/extra base hitting power
contact: number; // CON - Ability to get on base, hit singles
glove: number; // GLV - Fielding defense
}

interface PitcherStats {
velocity: number; // VEL - Fastball speed/strikeout power
control: number; // CTL - Strike accuracy/walk prevention
break: number; // BRK - Breaking ball movement/deception
}

type PlayerStats = BatterStats | PitcherStats;

interface Player {  
 id: string;  
 name: string;  
 age: number;  
 role: "Batter" | "Starter" | "Reliever";

// The RPG Stats (role-specific)
stats: PlayerStats;

// The Resource State  
 stamina: {  
 current: number; // 0-100  
 max: number; // Usually 100  
 };

// Progression  
 level: number;  
 xp: number;  
 potential: "F" | "D" | "C" | "B" | "A" | "S"; // Cap for stats

// Equipment (The "Loot")  
 equipment: {  
 slot1: Item | null; // e.g., "Lucky Bat"  
 slot2: Item | null;  
 };

salary: number; // Weekly cost  
}

**B. The Team State**

TypeScript

interface Team {  
 name: string;  
 cash: number;  
 fans: number; // Multiplier

roster: Player\[\]; // All owned cards  
 lineup: string\[\]; // IDs of the 9 active players  
 bench: string\[\]; // IDs of the inactive players (who recover stamina)

facilities: {  
 stadiumLevel: number; // Caps max fans  
 gymLevel: number; // Boosts XP gain  
 medicalLevel: number; // Boosts stamina recovery rate  
 };

leaguePosition: number;  
 wins: number;  
 losses: number;  
}

### **2\. The "Game Engine" Logic**

Since this is turn-based, you don't need a game loop (requestAnimationFrame). You just need a **State Transition Function**.

**The "Play Match" Function (Pseudocode):**

JavaScript

function playMatch(myTeam, enemyTeam) {

// 1\. Calculate Totals with Floor Mechanics
// Batters contribute Power + Contact to offense, with Contact providing consistency
const myOffense = {
power: sum(myBatters.map(p => p.stats.power + p.stats.contact)),
floor: avg(myBatters.map(p => p.stats.contact)) // Reduces bad RNG
};

// Pitchers contribute Velocity + Break to defense, with Control + Glove providing floor
const myDefense = {
power: sum(myPitchers.map(p => p.stats.velocity + p.stats.break)),
floor: avg(myPitchers.map(p => p.stats.control)) + avg(myBatters.map(p => p.stats.glove))
};

const enemyOffense = enemyTeam.offenseRating; // Simplified for AI  
 const enemyDefense = enemyTeam.defenseRating;

// 2\. Apply Stamina Penalty  
 // If a player is \< 50% stamina, their stats count for half.

// 3\. Determine Runs with Floor Mechanics
// Variance is a random float between 0.8 and 1.2
// Floor bonus provides consistency even with bad rolls  
 const myVariance = getRandomVariance();
const myBaseRuns = (myOffense.power / enemyDefense.power) _ 5;
const myFloorBonus = myOffense.floor _ 0.1;
const myRuns = Math.floor((myBaseRuns \* myVariance) + myFloorBonus);

const enemyRuns = Math.floor( (enemyOffense / myDefense.power) _ 5 _ getRandomVariance() );

// 4\. Determine Winner  
 const isWin = myRuns > enemyRuns;

// 5\. Update State (The "Consequences")  
 // Reduce stamina for active lineup  
 myTeam.lineup.forEach(p => p.stamina.current -= 15);

// Recover stamina for bench  
 myTeam.bench.forEach(p => p.stamina.current += 20);

// Give Rewards  
 if (isWin) {  
 myTeam.cash += (baseReward _ myTeam.fans);  
 myTeam.wins++;  
 generateLootDrop(); // Chance for item  
 } else {  
 myTeam.cash += (baseReward _ 0.5); // Consolation prize  
 myTeam.losses++;  
 }

return { myRuns, enemyRuns, isWin };  
}

### **3\. The Generator (Procedural Generation)**

You need a function to spit out endless unique players.

JavaScript

function generateRookie(tier) {  
 const names = ["Slugger", "Ace", "Lefty", "Tiny", "Rocket"];  
 const surnames = ["Jones", "Smith", "Rodriguez", "Tanaka"];

const role = getRandom(["Batter", "Starter", "Reliever"]);
const isPitcher = role === "Starter" || role === "Reliever";

// Generate role-specific stats
const stats = isPitcher
? {
velocity: getRandom(20, 40) _ (tier / 5), // VEL
control: getRandom(15, 35) _ (tier / 5), // CTL
break: getRandom(15, 35) _ (tier / 5), // BRK
}
: {
power: getRandom(20, 40) _ (tier / 5), // PWR
contact: getRandom(15, 35) _ (tier / 5), // CON
glove: getRandom(15, 35) _ (tier / 5), // GLV
};

return {  
 id: uuid(),  
 name: getRandom(names) + " " + getRandom(surnames),  
 age: 18,  
 role,
stats,
potential: rollPotential(), // 1% chance of 'S' rank  
 salary: 500 \* tier  
 };  
}

# ---

**Part 3: Development Roadmap**

If you are coding this yourself, here is the order I recommend building in to keep it fun/testable:

**Phase 1: The Spreadsheet (Day 1-2)**

- Build the Player and Team data structures.
- Create a simple button "Generate Team" that logs a team to the console.
- Create a button "Sim Match" that logs the score to the console.
- _Goal:_ Verify the math feels fair (you win \~50% of the time against equal opponents).

**Phase 2: The Dashboard (Day 3-5)**

- Set up your UI (HTML/CSS).
- Left Panel: Your Roster (List of names).
- Right Panel: The "Play" button and Match Log.
- _Goal:_ Make it clickable. See your cash go up when you win.

**Phase 3: The Mechanics (Day 6-10)**

- Implement Stamina (The "Brake"). Add visual bars (Green/Yellow/Red).
- Implement Drag-and-Drop (or simple Up/Down arrows) to move players from Bench to Lineup.
- _Goal:_ Create the "Strategy Loop" where you are forced to rotate players.

**Phase 4: The Progression (Day 11+)**

- Add the Shop (Spend cash to upgrade Stadium).
- Add the League Table (Track wins/losses over 20 games).
- Add Save/Load (Save state to LocalStorage).

### **Next Step for You**

Do you have a preferred tech stack (e.g., vanilla JS, React, Python/Flask)? If you tell me what you are comfortable with, I can write the **"Hello World"** code snippet to get that first "Play Match" button working for you.
