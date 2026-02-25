# Dugout Dynasty: RPG Transformation Roadmap

## Current State Summary

The game has a solid foundation:
- Full 9-inning baseball simulation with pitcher rotation
- Graduated stamina system (no cliff effect)
- 5-tier league progression (Sandlot → World)
- Player generation with quality tiers
- Roster management (lineup/bench)
- Zustand state with localStorage persistence
- ~16k lines of well-tested TypeScript/React

**What's Missing (from Vision):**
- XP and leveling system
- Equipment/loot with rarity tiers
- Special abilities (Mojo/mana)
- RPG class archetypes
- Dynamic narrative text ("Tectonic Blast!")
- Status effects (On Fire, Cold Streak)
- Economy (shops, crafting, gacha)
- NES.css retro polish

---

## Roadmap: 7 Playable Phases

Each phase delivers a **playable game** with new RPG depth. Players can enjoy the game at any checkpoint.

---

## Phase 1: XP & Leveling System
**Theme: "Every At-Bat Matters"**

### Goal
Transform passive stat blocks into growing characters. Players should feel progression every few minutes of gameplay.

### Features
1. **Add XP to Player model**
   - `level: number` (1-99)
   - `xp: number` (current)
   - `xpToNextLevel: number` (calculated from curve)

2. **XP Curve (from vision)**
   ```
   XP_required = 100 × Level^1.5
   Level 1→2: 100 XP
   Level 5→6: ~1,100 XP
   Level 10→11: ~3,200 XP
   ```

3. **XP Sources**
   | Action | XP Reward |
   |--------|-----------|
   | Single | 10 XP |
   | Double | 20 XP |
   | Triple | 35 XP |
   | Home Run | 50 XP |
   | Walk | 5 XP |
   | Strikeout (pitcher) | 15 XP |
   | Inning pitched | 25 XP |
   | Win (team bonus) | 100 XP to all |
   | Loss (consolation) | 25 XP to all |

4. **Level-Up Rewards**
   - Stat growth based on role (batters get more Power/Contact, pitchers get Velocity/Control)
   - Free stat points for user allocation (1-2 per level)
   - Unlock thresholds for future systems (Level 5: Equipment, Level 10: Skills)

5. **UI Updates**
   - XP bar on PlayerCard
   - Level-up toast notification
   - "Level Up!" animation on character sheet

### Playable Checkpoint
After a match, players see XP gains per player. Leveling up feels rewarding. Early levels fly by (hooking the player), later levels require sustained play.

### Files to Modify
- `src/types/game.ts` - Add XP fields to Player
- `src/engine/xpSystem.ts` - NEW: XP curve calculations
- `src/engine/matchEngine.ts` - Award XP after at-bats
- `src/store/gameStore.ts` - Handle level-ups
- `src/components/PlayerCard.tsx` - XP bar display
- `src/components/ui/LevelUpToast.tsx` - NEW: Celebration UI

### Estimated Scope
~800-1000 lines of new/modified code

---

## Phase 2: Equipment & Loot System
**Theme: "Gear Up for Glory"**

### Goal
Introduce the slot machine psychology of loot drops. Every hit could drop something cool.

### Features
1. **Equipment Slots (5 per player)**
   - Main Hand: Bat (hitters) / Ball (pitchers)
   - Off Hand: Glove
   - Head: Cap / Helmet
   - Feet: Cleats
   - Accessory: Sunglasses, Chains, Gum

2. **Rarity Tiers (from vision)**
   | Color | Rarity | Drop Weight | Stat Multiplier |
   |-------|--------|-------------|-----------------|
   | Gray | Junk | 40% | 0.5x |
   | White | Common | 30% | 1.0x |
   | Green | Uncommon | 15% | 1.25x |
   | Blue | Rare | 10% | 1.5x |
   | Purple | Epic | 4% | 2.5x |
   | Orange | Legendary | 1% | 5.0x |

3. **Procedural Item Generation**
   ```
   [Prefix] + [Base] + [Suffix]
   "Furious Aluminum Bat of Storms"
   ```
   - Prefixes: Heavy (+Power), Light (+Contact), Quick (+Speed)
   - Bases: Ash Bat, Maple Bat, Aluminum Bat, etc.
   - Suffixes: of the Hawk (+Accuracy), of the Bull (+Stamina), of the Vampire (Life Steal)

4. **Loot Drop Triggers**
   - Home Run: 80% drop chance
   - Extra-base hit: 50% drop chance
   - Single: 20% drop chance
   - Win bonus: 1 guaranteed drop

5. **Inventory System**
   - 50-slot inventory grid
   - Equip/unequip items
   - Stat comparison tooltip
   - Sell for gold

6. **UI Updates**
   - Inventory panel (new tab or sidebar)
   - Equipment slots on character sheet
   - Color-coded item names
   - "LEGENDARY DROP!" toast with special animation

### Playable Checkpoint
Players hunt for better gear. The loop becomes: Play → Get Loot → Equip → Play Better → Get Better Loot. Orange items feel magical.

### Files to Create/Modify
- `src/types/item.ts` - NEW: Item interfaces
- `src/engine/lootGenerator.ts` - NEW: Procedural generation
- `src/engine/lootTables.ts` - NEW: Prefixes, bases, suffixes
- `src/store/inventoryStore.ts` - NEW: Inventory state
- `src/components/InventoryPanel.tsx` - NEW: Inventory UI
- `src/components/EquipmentSlots.tsx` - NEW: Paper doll UI
- `src/components/ItemTooltip.tsx` - NEW: Stat comparison

### Estimated Scope
~1500-2000 lines of new code

---

## Phase 3: Dynamic Narrative Text
**Theme: "Moneyball Meets D&D"**

### Goal
Transform boring play-by-play into epic RPG combat descriptions. Make text the star.

### Features
1. **Narrative Stat Scaling**
   - Power < 50: "Jones hits a single to left."
   - Power 50-80: "Jones SMASHES the ball into the gap!"
   - Power 80-100: "Jones DEMOLISHES the pitch! The ball screams into orbit!"
   - Power 100+: "TECTONIC BLAST! The stadium shakes as the ball exits Earth's atmosphere!"

2. **Dynamic Verb/Adjective Pools**
   ```typescript
   const powerVerbs = {
     low: ["hits", "pokes", "taps"],
     mid: ["drives", "smashes", "crushes"],
     high: ["OBLITERATES", "DEMOLISHES", "ANNIHILATES"],
     legendary: ["ATOMIZES", "DISINTEGRATES", "ERASES FROM EXISTENCE"]
   };
   ```

3. **Situational Flavor**
   - Errors: "The shortstop trips over his own shoelaces. A tragic display of Dexterity failure."
   - Strikeouts: "The batter swings at air molecules. The pitcher's ego swells."
   - Home Runs: "That ball had a family! It's gone!"

4. **Item Description Lore**
   ```
   "The Contract of Bad Value"
   Effect: +10 Wealth, -5 Team Morale
   "You get paid, but the fans boo you every time you touch the ball."
   ```

5. **Critical Hit System**
   - Roll a secondary "crit" check on big hits
   - Crits get extra-hyperbolic text
   - "+50 XP CRITICAL HIT!" feedback

### Playable Checkpoint
The game feels alive. Reading play-by-play becomes entertainment. Players share screenshots of absurd descriptions.

### Files to Create/Modify
- `src/engine/narrativeEngine.ts` - NEW: Text generation
- `src/engine/textPools.ts` - NEW: Verb/adjective pools
- `src/engine/matchEngine.ts` - Integrate narrative
- `src/components/PlayByPlay.tsx` - Styled narrative text
- `src/components/ui/CriticalHitText.tsx` - NEW: Animated text

### Estimated Scope
~800-1200 lines of new code

---

## Phase 4: Special Abilities (Mojo System)
**Theme: "Unleash Your Skills"**

### Goal
Add tactical depth with active abilities. Transform at-bats from passive rolls to strategic decisions.

### Features
1. **Mojo Resource (Mana)**
   - Each player has `mojo: { current: number, max: number }`
   - Regenerates between games
   - Spent on abilities

2. **Batter Abilities**
   | Ability | Mojo Cost | Effect |
   |---------|-----------|--------|
   | Precision Strike | 5 | +30 Contact for this at-bat |
   | Power Swing | 10 | +50 Power, -20 Contact |
   | Moonshot | 25 | Guarantees fly ball. If contact, auto-HR check |
   | Crazy Bunt | 15 | Ball moves erratically, -50 fielder accuracy |

3. **Pitcher Abilities**
   | Ability | Mojo Cost | Effect |
   |---------|-----------|--------|
   | Fireball | 5 | +20 Velocity |
   | Ice Shard | 8 | Freezes batter timing, -15 Contact |
   | Meteor Sinker | 12 | Forces ground ball |
   | Time Warp | 15 | 50% chance batter swings early |

4. **Class-Based Skill Trees (Unlock via Level)**
   - **Tank (Catcher/1B)**: Defensive passives, stamina buffs
   - **DPS (OF/DH)**: Power skills, glass cannon
   - **Rogue (SS/CF)**: Speed skills, steal buffs
   - **Caster (Pitcher)**: Full spell arsenal

5. **Skill Point Allocation**
   - 1 skill point per level
   - Unlock new abilities or upgrade existing ones

6. **UI Updates**
   - Mojo bar on PlayerCard
   - Skill selection menu during at-bats
   - Skill tree panel on character sheet

### Playable Checkpoint
Players make tactical decisions each at-bat. "Do I burn mojo now or save for the clutch moment?" Builds become personalized.

### Files to Create/Modify
- `src/types/abilities.ts` - NEW: Ability interfaces
- `src/engine/abilitySystem.ts` - NEW: Ability execution
- `src/engine/skillTrees.ts` - NEW: Class skill trees
- `src/store/gameStore.ts` - Mojo management
- `src/components/AbilityMenu.tsx` - NEW: At-bat skill selection
- `src/components/SkillTree.tsx` - NEW: Skill tree UI

### Estimated Scope
~2000-2500 lines of new code

---

## Phase 5: Status Effects & Combat Feel
**Theme: "Momentum Swings"**

### Goal
Add dynamic buffs/debuffs that create drama and narrative tension.

### Features
1. **Positive Status Effects**
   | Status | Trigger | Effect | Duration |
   |--------|---------|--------|----------|
   | On Fire | 3 consecutive hits | +20% all stats, flames in UI | Until out |
   | Locked In | 2 XBH in game | +15% Contact | Rest of game |
   | Clutch | Bases loaded | +25% all stats | This at-bat |
   | Rally Cap | Down by 3+ runs late | Team +10% stats | Rest of game |

2. **Negative Status Effects**
   | Status | Trigger | Effect | Duration |
   |--------|---------|--------|----------|
   | Cold Streak | 0-for-4 | -10% all stats | Until hit |
   | Rattled | Give up HR | -15% Control | 2 innings |
   | Butterfingers | Commit error | +25% error chance | Rest of game |
   | Gassed | 0 stamina | -30% all stats | Until rested |

3. **Visual Feedback**
   - Fire particle effect on "On Fire" players
   - Snowflake icon for "Cold Streak"
   - Status icons on PlayerCard
   - Combat log announces status changes

4. **Near-Miss Psychology**
   - "The ball hits the top of the wall! So close to a Home Run!"
   - "Strike three... but the catcher drops it! You're safe!"
   - Creates "just one more try" urge

### Playable Checkpoint
Games feel dynamic. Momentum swings create stories. "My pitcher got Rattled but we activated Rally Cap and came back!"

### Files to Create/Modify
- `src/types/statusEffects.ts` - NEW: Status interfaces
- `src/engine/statusManager.ts` - NEW: Status logic
- `src/engine/matchEngine.ts` - Status triggers
- `src/components/StatusIcons.tsx` - NEW: Status display
- `src/components/PlayerCard.tsx` - Status integration

### Estimated Scope
~1000-1500 lines of new code

---

## Phase 6: Economy & Crafting
**Theme: "Build Your Empire"**

### Goal
Create a meta-game economy that gives meaning to gold and junk items.

### Features
1. **Currency Renamed**
   - Cash → "Cap Space" (fits baseball theme)
   - Or keep gold for RPG feel

2. **The Shop**
   - Daily rotating inventory (4-6 items)
   - Random rarity distribution
   - Prices scale with rarity
   - "Gacha Packs" (random item for fixed price)

3. **Crafting System**
   - 3 Common items → 1 Uncommon
   - 3 Uncommon → 1 Rare
   - 3 Rare → 1 Epic
   - 3 Epic → 1 Legendary
   - Ensures junk has value

4. **Consumables**
   | Item | Effect | Price |
   |------|--------|-------|
   | Energy Drink | Restore 50 stamina | $200 |
   | Pep Talk | Remove Cold Streak | $150 |
   | Nachos of Destiny | +10% stats for 1 game | $500 |
   | Lucky Charm | +5% loot drop rate for 3 games | $1000 |

5. **Salary Cap Integration**
   - Higher level players demand higher salaries
   - Create roster building tension

### Playable Checkpoint
Players engage with the economy. Grinding junk items feels productive. Shop visits become daily rituals.

### Files to Create/Modify
- `src/types/economy.ts` - NEW: Shop/crafting interfaces
- `src/engine/shopGenerator.ts` - NEW: Daily shop logic
- `src/engine/craftingSystem.ts` - NEW: Item merging
- `src/store/economyStore.ts` - NEW: Economy state
- `src/components/ShopPanel.tsx` - NEW: Shop UI
- `src/components/CraftingPanel.tsx` - NEW: Crafting UI

### Estimated Scope
~1200-1500 lines of new code

---

## Phase 7: Boss Battles & Prestige
**Theme: "The Endgame"**

### Goal
Provide long-term goals and infinite replayability.

### Features
1. **Boss Teams**
   - End-of-season "Boss Fight" in playoffs
   - Special teams with cheat abilities:
     - "The Robots" - Never tire (infinite stamina)
     - "The Aliens" - Random stat spikes
     - "The Legends" - All players Level 50+
   - Unique legendary drops

2. **Prestige System (New Game+)**
   - Win World League championship → Can "Prestige"
   - Reset: Roster, Level, League progress
   - Keep: "Legacy Items" (1-3 legendaries), Prestige Points
   - Prestige bonuses: +5% XP gain per prestige level

3. **Hall of Fame**
   - Track career achievements
   - Unlock cosmetics/titles
   - Leaderboard (if multiplayer later)

4. **Astral League (Post-Game)**
   - Unlocks after first prestige
   - Moon stadium (low gravity = +30% HR distance)
   - Alien opponents
   - Unique legendary tier: "Cosmic" (rainbow color)

5. **Achievements System**
   - "First Blood" - Win your first game
   - "Grand Slam Artist" - Hit 10 grand slams
   - "Perfect Game" - Pitch 9 innings, 0 hits
   - "Collector" - Own 100 unique items

### Playable Checkpoint
The game has infinite depth. Prestige creates "just one more run" mentality. Boss fights are memorable challenges.

### Files to Create/Modify
- `src/types/prestige.ts` - NEW: Prestige interfaces
- `src/engine/bossGenerator.ts` - NEW: Boss team creation
- `src/engine/prestigeSystem.ts` - NEW: Prestige logic
- `src/store/careerStore.ts` - NEW: Career/achievements
- `src/components/PrestigePanel.tsx` - NEW: Prestige UI
- `src/components/HallOfFame.tsx` - NEW: Career stats
- `src/components/AchievementsPanel.tsx` - NEW: Achievement UI

### Estimated Scope
~1500-2000 lines of new code

---

## Parallel Track: Visual Polish (NES.css)
**Can be done alongside any phase**

### Features
1. **NES.css Integration**
   - Pixel-art buttons
   - Chunky progress bars (HP/XP/Mojo)
   - RPG window borders
   - 8-bit fonts

2. **Sound Effects (Optional)**
   - Level-up jingle
   - Legendary drop fanfare
   - Critical hit sound
   - Home run crack

3. **Animations**
   - XP bar filling
   - Item rarity glow
   - Critical hit text shake
   - Fire effect on "On Fire" players

### Files
- Already have `src/components/ui/8bit/` foundation
- Add NES.css to dependencies
- Create animation utilities

---

## Implementation Priority Matrix

| Phase | Engagement Impact | Complexity | Dependency |
|-------|------------------|------------|------------|
| 1. XP/Leveling | HIGH | LOW | None |
| 2. Equipment | HIGH | MEDIUM | None |
| 3. Narrative | MEDIUM | LOW | None |
| 4. Abilities | HIGH | HIGH | Phase 1 |
| 5. Status Effects | MEDIUM | MEDIUM | None |
| 6. Economy | MEDIUM | MEDIUM | Phase 2 |
| 7. Boss/Prestige | HIGH | HIGH | Phases 1-6 |

**Recommended Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

Phases 1-3 can be done relatively quickly and dramatically change the feel. Phase 4 is the biggest lift but adds the most tactical depth.

---

## Success Metrics

### Phase 1 Complete When:
- [ ] Players gain XP from at-bats
- [ ] Level-up triggers stat growth
- [ ] XP bar visible on UI
- [ ] Level 5 reachable in ~20 minutes

### Phase 2 Complete When:
- [ ] Items drop from hits
- [ ] 5 equipment slots functional
- [ ] Procedural names generate correctly
- [ ] Rarity colors display properly
- [ ] Equipped items modify stats

### Phase 3 Complete When:
- [ ] Play-by-play reads like RPG combat log
- [ ] Text scales with player stats
- [ ] Critical hits have special descriptions
- [ ] Items have humorous lore text

### Phase 4 Complete When:
- [ ] Mojo resource visible and spendable
- [ ] At least 4 batter abilities work
- [ ] At least 4 pitcher abilities work
- [ ] Skill tree panel exists

### Phase 5 Complete When:
- [ ] "On Fire" triggers and displays
- [ ] "Cold Streak" triggers and displays
- [ ] Near-miss messages appear
- [ ] Status icons visible

### Phase 6 Complete When:
- [ ] Shop generates daily inventory
- [ ] Items purchasable with gold
- [ ] Crafting merges 3 items → 1 higher
- [ ] Consumables usable

### Phase 7 Complete When:
- [ ] Boss team appears in playoffs
- [ ] Prestige resets correctly
- [ ] Legacy items persist
- [ ] Hall of Fame tracks career stats

---

## Total Estimated New Code

| Phase | Lines |
|-------|-------|
| 1. XP/Leveling | ~1,000 |
| 2. Equipment | ~2,000 |
| 3. Narrative | ~1,000 |
| 4. Abilities | ~2,500 |
| 5. Status Effects | ~1,500 |
| 6. Economy | ~1,500 |
| 7. Boss/Prestige | ~2,000 |
| **Total** | **~11,500** |

Current codebase: ~16,000 lines
Final codebase: ~27,500 lines

---

## Quick Wins (Do First)

If you want immediate impact with minimal effort:

1. **Narrative Text (2-3 hours)**
   - Just modify `matchEngine.ts` to use dynamic verbs
   - Instant "feel" improvement

2. **XP Display (1-2 hours)**
   - Add XP fields to Player type
   - Show XP bar (even if not earning yet)
   - Visual hook for future system

3. **Item Tooltips (2-3 hours)**
   - Create Item type with rarity
   - Generate placeholder items
   - Show colored names in UI

These create the *perception* of RPG depth while you build the real systems.
