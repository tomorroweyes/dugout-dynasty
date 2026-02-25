# Technique System - Adding More Choices

This guide shows you how to easily add more player choices to the technique system.

## Quick Reference: Choice Types

| Choice Type | What It Does | How to Add |
|-------------|--------------|------------|
| **Mutually Exclusive** | Pick Path A OR Path B (never both) | Add `conflictsWith: ["other_id"]` |
| **Cross-Archetype** | Any archetype can learn this | Add `allowCrossArchetype: true` |
| **Passive vs Active** | Always-on vs spirit-activated | Add `isPassive: true` + `spiritCost: 0` |
| **Rank Upgrades** | Deepen existing OR learn new | Already works - just use skill points |
| **Path Grouping** | Organize by playstyle | Add `path: "Power Path"` |
| **Tags** | Categorize for filtering | Add `tags: ["offensive", "clutch"]` |

---

## Adding Mutually Exclusive Techniques

**Use Case:** Force players to choose between two playstyles.

### Example: Power Path vs Balanced Path

```typescript
// In /src/data/techniques.ts

{
  id: "pull_hitter",
  name: "Pull Hitter",
  description: "Dead pull for maximum power",
  conflictsWith: ["opposite_field"], // ← Add this!
  requiredClass: "Slugger",
  requiredLevel: 7,
  path: "Power Path",
  // ... rest of definition
}

{
  id: "opposite_field",
  name: "Opposite Field",
  description: "Hit to all fields",
  conflictsWith: ["pull_hitter"], // ← Add this!
  requiredClass: "Slugger",
  requiredLevel: 7,
  path: "Balanced Path",
  // ... rest of definition
}
```

**Result:** Players at level 7 must choose:
- Pull Hitter → High risk, high reward, pure power
- Opposite Field → Consistent, versatile, harder to defend

**To add more:** Just add new techniques with `conflictsWith` arrays!

---

## Adding Cross-Archetype Techniques

**Use Case:** Allow hybrid builds by letting archetypes dip into other trees.

### Example: Patience for All Archetypes

```typescript
{
  id: "patience",
  name: "Patience",
  description: "Wait for your pitch",
  requiredClass: "Contact Hitter", // ← Still owned by Contact Hitter
  allowCrossArchetype: true, // ← But anyone can learn it!
  requiredLevel: 7,
  tags: ["cross-archetype", "utility"],
  // ... rest of definition
}
```

**Result:**
- Slugger with Patience = Power hitter who draws walks
- Speed Demon with Patience = Patient speedster who gets on base
- **Limit:** Max 2 cross-archetype techniques per player

**To add more:**
1. Add `allowCrossArchetype: true` to any technique
2. System automatically limits to 2 cross-archetype techniques
3. Tag with `"cross-archetype"` for UI filtering

---

## Adding Passive Techniques

**Use Case:** Always-active bonuses vs situational spirit-activated abilities.

### Example: Passive Discipline

```typescript
{
  id: "plate_discipline",
  name: "Plate Discipline",
  description: "Natural eye for the strike zone",
  isPassive: true, // ← Always active
  spiritCost: 0, // ← No spirit cost for passive
  requiredClass: "Contact Hitter",
  requiredLevel: 10,
  tags: ["passive", "defensive"],
  effects: [
    {
      type: "stat_modifier",
      contact: 15,
      duration: "game", // ← Always on
    },
  ],
}
```

**vs Active Technique:**

```typescript
{
  id: "clutch_bomb",
  name: "Clutch Bomb",
  description: "Activate for massive power in late innings",
  isPassive: false, // ← Requires activation
  spiritCost: 30, // ← Spirit cost
  effects: [
    {
      type: "stat_modifier",
      power: 60,
      duration: "at_bat", // ← Only when activated
    },
  ],
}
```

**Trade-off for players:**
- Passive: Consistent, always works, no management
- Active: Powerful but situational, requires spirit management

---

## Adding New Paths (Build Variants)

**Use Case:** Give each archetype 2-3 distinct playstyle variants.

### Example: Slugger Paths

```typescript
// Power Path - Maximum home runs, high strikeouts
const POWER_PATH: Technique[] = [
  { id: "pull_hitter", path: "Power Path", ... },
  { id: "uppercut", path: "Power Path", prerequisiteAbilityId: "pull_hitter", ... },
  { id: "wall_scraper", path: "Power Path", prerequisiteAbilityId: "uppercut", ... },
];

// Balanced Path - Consistent power, lower strikeouts
const BALANCED_PATH: Technique[] = [
  { id: "opposite_field", path: "Balanced Path", ... },
  { id: "gap_power", path: "Balanced Path", prerequisiteAbilityId: "opposite_field", ... },
  { id: "five_tool", path: "Balanced Path", prerequisiteAbilityId: "gap_power", ... },
];

// Clutch Path - Situational dominance
const CLUTCH_PATH: Technique[] = [
  { id: "clutch_gene", path: "Clutch Path", ... },
  { id: "ice_in_veins", path: "Clutch Path", prerequisiteAbilityId: "clutch_gene", ... },
];
```

**Result:** Every Slugger plays differently based on path chosen!

---

## Adding Tags for Filtering

**Use Case:** Help players find techniques that fit their playstyle.

### Common Tags

```typescript
tags: ["offensive", "power"] // Pure damage
tags: ["defensive", "utility"] // Support/defense
tags: ["clutch", "situational"] // Late-game impact
tags: ["passive"] // Always active
tags: ["cross-archetype"] // Available to other archetypes
tags: ["risky"] // High reward, high risk
tags: ["consistent"] // Reliable, safe
```

### Example: Tag-Based Filtering UI

```typescript
// UI can filter by tags
Available Techniques:
  [Offensive] [Clutch] [Passive] [All]

// Click "Clutch" → Shows only clutch techniques
- Clutch Gene (Slugger)
- Ice in Veins (All archetypes)
- Rally Starter (Speed Demon)
```

---

## Adding New Archetype Techniques

### Template for New Technique

```typescript
{
  // Identity
  id: "unique_snake_case_id",
  name: "Display Name",
  description: "Short description of what it does",
  flavorText: "Optional flavor text for immersion",

  // Costs
  spiritCost: 15, // 0 for passive, 10-30 for active
  slotCost: 1, // 1 for normal, 2-3 for elite

  // Requirements
  requiredClass: "Slugger", // Which archetype owns it
  requiredLevel: 7, // When it unlocks
  prerequisiteAbilityId: "power_swing", // Optional: must have this first

  // Choice System (SCALABLE - add as needed!)
  conflictsWith: ["other_technique_id"], // Mutually exclusive
  allowCrossArchetype: true, // Let others learn it
  isPassive: false, // Always active vs spirit-activated

  // Organization (for UI/filtering)
  path: "Power Path", // Which build path
  tags: ["offensive", "power"], // Categories

  // Game Effects
  effects: [
    {
      type: "stat_modifier",
      power: 30,
      duration: "at_bat",
    },
  ],

  // Progression
  maxRank: 3, // How many times can upgrade
  currentRank: 1, // Starting rank

  // Visual
  iconEmoji: "💪", // Emoji for UI
}
```

---

## Examples: Adding More Choices

### Example 1: Three-Way Choice

```typescript
// Level 10: Choose your specialization

{
  id: "home_run_specialist",
  conflictsWith: ["gap_power", "small_ball"],
  path: "Power",
  // Max power, low average
}

{
  id: "gap_power",
  conflictsWith: ["home_run_specialist", "small_ball"],
  path: "Balanced",
  // Doubles/triples, high average
}

{
  id: "small_ball",
  conflictsWith: ["home_run_specialist", "gap_power"],
  path: "Speed",
  // Bunts, steals, manufactured runs
}
```

### Example 2: Prestige Techniques

```typescript
{
  id: "legend",
  name: "Legend",
  requiredLevel: 25,
  prerequisiteAbilityId: "clutch_gene",
  slotCost: 3, // Very expensive!
  tags: ["elite", "endgame"],
  // Ultimate technique for late game
}
```

### Example 3: Conditional Techniques

```typescript
{
  id: "rivalry_boost",
  name: "Rivalry Boost",
  tags: ["situational", "conditional"],
  effects: [
    {
      type: "stat_modifier",
      power: 40,
      duration: "game",
      // Could add condition: only vs certain teams
    },
  ],
}
```

---

## Validation System (Already Built-In!)

The system automatically validates:
- ✅ Level requirements
- ✅ Archetype restrictions
- ✅ Prerequisites
- ✅ Mutually exclusive (conflictsWith)
- ✅ Cross-archetype limits (max 2)
- ✅ Slot availability

**No extra code needed** - just add fields to technique definitions!

---

## Adding New Choice Types (Future)

The system is designed to be extensible. To add a new choice type:

1. **Add field to Technique interface** (`/src/types/ability.ts`)
2. **Add validation to `canEquipTechnique()`** (`/src/engine/techniqueSlots.ts`)
3. **Add UI display** (skill tree panel)

### Example: Adding "Synergy" System

```typescript
// 1. Add to Technique interface
export interface Ability {
  // ... existing fields
  synergizesWith?: string[]; // New field!
}

// 2. Add validation in techniqueSlots.ts
// Check if player has synergy partner → grant bonus

// 3. Add UI indicator
// Show "SYNERGY!" badge when both techniques equipped
```

---

## Best Practices

1. **Mutually Exclusive Pairs**: Use for either/or choices (Power vs Finesse)
2. **Cross-Archetype**: Use for utility techniques any build wants
3. **Passive Techniques**: Use for "always on" bonuses to reduce micromanagement
4. **Paths**: Group related techniques for coherent build identity
5. **Tags**: Use for filtering and discovering techniques
6. **Slot Costs**: 1 = normal, 2 = strong, 3 = ultimate (forces tough choices)

---

## Summary

**To add more choices**, just edit `/src/data/techniques.ts` and add:
- `conflictsWith` for either/or decisions
- `allowCrossArchetype` for hybrid builds
- `isPassive` for always-on bonuses
- `path` for build organization
- `tags` for categorization

**No code changes needed** - the validation system handles everything automatically!

**Every new technique = more build diversity = more replay value**
