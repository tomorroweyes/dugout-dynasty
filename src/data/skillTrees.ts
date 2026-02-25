import type { SkillTree, PlayerClass } from "@/types/ability";

/**
 * Skill Tree Layouts
 *
 * Each class has a skill tree with nodes positioned in a 3-column grid.
 * Connections represent prerequisites (must unlock X before unlocking Y).
 *
 * Grid layout: 3 columns (x: 0, 1, 2) × 4 rows (y: 0, 1, 2, 3)
 *
 * Standard layout pattern:
 *   Row 0: Core starter (center)
 *   Row 1: Two branching choices (left + right, often conflicting)
 *   Row 2: Advanced (left/right) + Passive/Utility (opposite side)
 *   Row 3: Ultimate capstone (center)
 */

// ============================================
// SLUGGER SKILL TREE
// ============================================

export const SLUGGER_SKILL_TREE: SkillTree = {
  className: "Slugger",
  nodes: [
    // Row 0: Core (Lv 5)
    { abilityId: "moonshot", position: { x: 1, y: 0 }, connections: [] },
    // Row 1: Branching choices (Lv 7)
    { abilityId: "intimidation_factor", position: { x: 0, y: 1 }, connections: [] },
    { abilityId: "opposite_field", position: { x: 2, y: 1 }, connections: [] },
    // Row 2: Advanced (Lv 10) + Passive (Lv 12)
    { abilityId: "home_run_threat", position: { x: 0, y: 2 }, connections: ["moonshot"] },
    { abilityId: "uppercut_swing", position: { x: 2, y: 2 }, connections: [] },
    // Row 3: Ultimate (Lv 15)
    { abilityId: "gorilla_ball", position: { x: 1, y: 3 }, connections: ["moonshot"] },
  ],
};

// ============================================
// CONTACT HITTER SKILL TREE
// ============================================

export const CONTACT_HITTER_SKILL_TREE: SkillTree = {
  className: "Contact Hitter",
  nodes: [
    // Row 0: Core (Lv 5)
    { abilityId: "two_strike_assassin", position: { x: 1, y: 0 }, connections: [] },
    // Row 1: Branching choices (Lv 7-8)
    { abilityId: "patience", position: { x: 0, y: 1 }, connections: [] },
    { abilityId: "gold_glove", position: { x: 2, y: 1 }, connections: [] },
    // Row 2: Advanced (Lv 10) + Passive (Lv 12)
    { abilityId: "spray_chart", position: { x: 0, y: 2 }, connections: [] },
    { abilityId: "battle_mode", position: { x: 2, y: 2 }, connections: [] },
    // Row 3: Ultimate (Lv 15)
    { abilityId: "rally_igniter", position: { x: 1, y: 3 }, connections: ["two_strike_assassin"] },
  ],
};

// ============================================
// SPEED DEMON SKILL TREE
// ============================================

export const SPEED_DEMON_SKILL_TREE: SkillTree = {
  className: "Speed Demon",
  nodes: [
    // Row 0: Core (Lv 5)
    { abilityId: "crazy_bunt", position: { x: 1, y: 0 }, connections: [] },
    // Row 1: Branching choices (Lv 7)
    { abilityId: "slap_hitter", position: { x: 0, y: 1 }, connections: [] },
    { abilityId: "pest", position: { x: 2, y: 1 }, connections: [] },
    // Row 2: Advanced (Lv 10) + Passive (Lv 12)
    { abilityId: "havoc", position: { x: 0, y: 2 }, connections: [] },
    { abilityId: "hit_and_run", position: { x: 2, y: 2 }, connections: [] },
    // Row 3: Ultimate (Lv 15)
    { abilityId: "steal_the_show", position: { x: 1, y: 3 }, connections: ["crazy_bunt"] },
  ],
};

// ============================================
// FLAMETHROWER SKILL TREE
// ============================================

export const FLAMETHROWER_SKILL_TREE: SkillTree = {
  className: "Flamethrower",
  nodes: [
    // Row 0: Core (Lv 5)
    { abilityId: "heat_up", position: { x: 1, y: 0 }, connections: [] },
    // Row 1: Branching choices (Lv 7)
    { abilityId: "intimidation", position: { x: 0, y: 1 }, connections: [] },
    { abilityId: "setup_pitch", position: { x: 2, y: 1 }, connections: [] },
    // Row 2: Advanced (Lv 10) + Passive (Lv 12)
    { abilityId: "untouchable", position: { x: 0, y: 2 }, connections: ["heat_up"] },
    { abilityId: "iron_arm", position: { x: 2, y: 2 }, connections: [] },
    // Row 3: Ultimate (Lv 15)
    { abilityId: "inferno", position: { x: 1, y: 3 }, connections: [] },
  ],
};

// ============================================
// PAINTER SKILL TREE
// ============================================

export const PAINTER_SKILL_TREE: SkillTree = {
  className: "Painter",
  nodes: [
    // Row 0: Core (Lv 5)
    { abilityId: "pinpoint", position: { x: 1, y: 0 }, connections: [] },
    // Row 1: Branching choices (Lv 7)
    { abilityId: "pitch_to_contact_painter", position: { x: 0, y: 1 }, connections: [] },
    { abilityId: "nibbler", position: { x: 2, y: 1 }, connections: [] },
    // Row 2: Advanced (Lv 10) + Passive (Lv 12)
    { abilityId: "surgeons_precision", position: { x: 0, y: 2 }, connections: ["pinpoint"] },
    { abilityId: "economizer", position: { x: 2, y: 2 }, connections: [] },
    // Row 3: Ultimate (Lv 15)
    { abilityId: "masterclass", position: { x: 1, y: 3 }, connections: [] },
  ],
};

// ============================================
// TRICKSTER SKILL TREE
// ============================================

export const TRICKSTER_SKILL_TREE: SkillTree = {
  className: "Trickster",
  nodes: [
    // Row 0: Core (Lv 5)
    { abilityId: "vanishing_act", position: { x: 1, y: 0 }, connections: [] },
    // Row 1: Branching choices (Lv 7)
    { abilityId: "changeup_trickster", position: { x: 0, y: 1 }, connections: [] },
    { abilityId: "knuckleball", position: { x: 2, y: 1 }, connections: [] },
    // Row 2: Advanced (Lv 10) + Passive (Lv 12)
    { abilityId: "phantom_pitch", position: { x: 0, y: 2 }, connections: ["vanishing_act"] },
    { abilityId: "repertoire", position: { x: 2, y: 2 }, connections: [] },
    // Row 3: Ultimate (Lv 15)
    { abilityId: "total_eclipse", position: { x: 1, y: 3 }, connections: [] },
  ],
};

// ============================================
// AGGREGATE ALL SKILL TREES
// ============================================

export const SKILL_TREES: Record<PlayerClass, SkillTree> = {
  "Contact Hitter": CONTACT_HITTER_SKILL_TREE,
  Slugger: SLUGGER_SKILL_TREE,
  "Speed Demon": SPEED_DEMON_SKILL_TREE,
  Flamethrower: FLAMETHROWER_SKILL_TREE,
  Painter: PAINTER_SKILL_TREE,
  Trickster: TRICKSTER_SKILL_TREE,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get skill tree for a specific class
 */
export function getSkillTreeForClass(
  className: PlayerClass
): SkillTree | undefined {
  return SKILL_TREES[className];
}

/**
 * Get all prerequisite ability IDs for an ability
 */
export function getPrerequisites(
  className: PlayerClass,
  abilityId: string
): string[] {
  const skillTree = SKILL_TREES[className];
  if (!skillTree) return [];

  const node = skillTree.nodes.find((n) => n.abilityId === abilityId);
  return node?.connections || [];
}

/**
 * Check if an ability has prerequisites
 */
export function hasPrerequisites(
  className: PlayerClass,
  abilityId: string
): boolean {
  return getPrerequisites(className, abilityId).length > 0;
}
