import type { Player } from "@/types/game";
import type { ActiveAbilityContext, AbilityEffect } from "@/types/ability";
import {
  canActivateAbility,
  getPlayerAbilities,
  getScaledAbilityEffects,
} from "./abilitySystem";
import type { RandomProvider } from "./randomProvider";

/**
 * Ability AI System
 *
 * Handles two types of ability application during matches:
 * 1. Passive abilities (isPassive: true) — always active, no spirit cost, no activation roll
 * 2. Active abilities — random activation chance based on spirit level
 */

interface AbilityActivationContext {
  player: Player;
  random?: RandomProvider;
}

/**
 * Build an ActiveAbilityContext that merges all passive ability effects.
 * Passive abilities are always active — no spirit cost, no activation roll.
 */
export function getPassiveAbilityContext(
  player: Player
): ActiveAbilityContext | null {
  if (!player.class || !player.abilities || player.abilities.length === 0) {
    return null;
  }

  const passiveEffects: AbilityEffect[] = [];

  for (const playerAbility of player.abilities) {
    const scaled = getScaledAbilityEffects(
      playerAbility.abilityId,
      playerAbility.rank
    );
    if (!scaled || !scaled.isPassive) continue;

    passiveEffects.push(...scaled.effects);
  }

  if (passiveEffects.length === 0) return null;

  return {
    playerId: player.id,
    abilityId: "__passive_bundle__",
    effects: passiveEffects,
    activatedAt: "pre_at_bat",
  };
}

/**
 * Merge a passive ability context with an optional active ability context.
 * Returns undefined if neither exists.
 */
export function mergeAbilityContexts(
  passive: ActiveAbilityContext | null,
  active: ActiveAbilityContext | null
): ActiveAbilityContext | undefined {
  if (!passive && !active) return undefined;
  if (!passive) return active ?? undefined;
  if (!active) return passive;
  // Merge: use active's ID but combine effects from both
  return {
    ...active,
    effects: [...passive.effects, ...active.effects],
  };
}

/**
 * Decide whether to activate an active ability for a batter.
 * Passive abilities are excluded — they are handled by getPassiveAbilityContext().
 * Returns ActiveAbilityContext if ability should be activated, null otherwise.
 */
export function decideBatterAbility(
  context: AbilityActivationContext
): ActiveAbilityContext | null {
  const { player, random } = context;
  const rng = random ? () => random.random() : Math.random;

  // No abilities available
  if (!player.class || !player.abilities || player.abilities.length === 0) {
    return null;
  }

  // Check if player has enough spirit to activate anything
  if (!player.spirit || player.spirit.current < 5) {
    return null;
  }

  // Get all available abilities
  const abilities = getPlayerAbilities(player);

  // Filter to only ACTIVE abilities the player can activate right now
  const activatableAbilities = abilities.filter((ability) => {
    if (ability.isPassive) return false; // Passives handled separately
    const { canActivate } = canActivateAbility(player, ability.id);
    return canActivate;
  });

  if (activatableAbilities.length === 0) {
    return null;
  }

  // Sort by spirit cost (prefer lower cost abilities)
  activatableAbilities.sort((a, b) => a.spiritCost - b.spiritCost);

  // Activation chance based on current spirit percentage
  const spiritPercent = player.spirit.current / player.spirit.max;
  let activationChance = 0;

  if (spiritPercent > 0.8) {
    activationChance = 0.4;
  } else if (spiritPercent > 0.5) {
    activationChance = 0.25;
  } else if (spiritPercent > 0.3) {
    activationChance = 0.1;
  } else {
    return null;
  }

  // Roll for activation
  if (rng() > activationChance) {
    return null;
  }

  // Choose first available ability (lowest cost)
  const chosenAbility = activatableAbilities[0];
  const playerAbility = player.abilities.find(
    (a) => a.abilityId === chosenAbility.id
  );

  if (!playerAbility) {
    return null;
  }

  // Get scaled effects based on rank
  const scaledAbility = getScaledAbilityEffects(
    chosenAbility.id,
    playerAbility.rank
  );

  if (!scaledAbility) {
    return null;
  }

  return {
    playerId: player.id,
    abilityId: chosenAbility.id,
    effects: scaledAbility.effects,
    activatedAt: "pre_at_bat",
  };
}

/**
 * Decide whether to activate an active ability for a pitcher.
 * Passive abilities are excluded — they are handled by getPassiveAbilityContext().
 * Returns ActiveAbilityContext if ability should be activated, null otherwise.
 */
export function decidePitcherAbility(
  context: AbilityActivationContext
): ActiveAbilityContext | null {
  const { player, random } = context;
  const rng = random ? () => random.random() : Math.random;

  // No abilities available
  if (!player.class || !player.abilities || player.abilities.length === 0) {
    return null;
  }

  // Check if player has enough spirit to activate anything
  if (!player.spirit || player.spirit.current < 5) {
    return null;
  }

  // Get all available abilities
  const abilities = getPlayerAbilities(player);

  // Filter to only ACTIVE abilities the player can activate right now
  const activatableAbilities = abilities.filter((ability) => {
    if (ability.isPassive) return false; // Passives handled separately
    const { canActivate } = canActivateAbility(player, ability.id);
    return canActivate;
  });

  if (activatableAbilities.length === 0) {
    return null;
  }

  // Sort by spirit cost (prefer lower cost abilities)
  activatableAbilities.sort((a, b) => a.spiritCost - b.spiritCost);

  // Activation chance based on current spirit percentage
  const spiritPercent = player.spirit.current / player.spirit.max;
  let activationChance = 0;

  if (spiritPercent > 0.8) {
    activationChance = 0.3;
  } else if (spiritPercent > 0.5) {
    activationChance = 0.2;
  } else if (spiritPercent > 0.3) {
    activationChance = 0.08;
  } else {
    return null;
  }

  // Roll for activation
  if (rng() > activationChance) {
    return null;
  }

  // Choose first available ability (lowest cost)
  const chosenAbility = activatableAbilities[0];
  const playerAbility = player.abilities.find(
    (a) => a.abilityId === chosenAbility.id
  );

  if (!playerAbility) {
    return null;
  }

  // Get scaled effects based on rank
  const scaledAbility = getScaledAbilityEffects(
    chosenAbility.id,
    playerAbility.rank
  );

  if (!scaledAbility) {
    return null;
  }

  return {
    playerId: player.id,
    abilityId: chosenAbility.id,
    effects: scaledAbility.effects,
    activatedAt: "pre_at_bat",
  };
}

/**
 * Process ability activation (deduct spirit cost)
 * Returns updated player with spirit deducted
 */
export function processAbilityActivation(
  player: Player,
  ability: ActiveAbilityContext
): Player {
  // Find the ability definition to get spirit cost
  const scaledAbility = getScaledAbilityEffects(
    ability.abilityId,
    player.abilities.find((a) => a.abilityId === ability.abilityId)?.rank || 1
  );

  if (!scaledAbility) {
    return player;
  }

  // Deduct spirit cost
  return {
    ...player,
    spirit: {
      ...player.spirit,
      current: Math.max(0, player.spirit.current - scaledAbility.spiritCost),
    },
    abilities: player.abilities.map((a) =>
      a.abilityId === ability.abilityId
        ? { ...a, timesUsed: a.timesUsed + 1 }
        : a
    ),
  };
}
