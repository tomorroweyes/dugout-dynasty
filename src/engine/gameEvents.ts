/**
 * Game Event System
 * Provides pub/sub pattern for game events like hits, strikeouts, wins, etc.
 * Enables decoupled features like achievements, animations, sound effects
 */

import { Player, PlayOutcome } from "@/types/game";

/**
 * All possible game events
 */
export type GameEvent =
  | { type: "at_bat_start"; batter: Player; pitcher: Player; inning: number; isTop: boolean }
  | { type: "at_bat_result"; batter: Player; pitcher: Player; outcome: PlayOutcome; rbi: number; inning: number; isTop: boolean }
  | { type: "strikeout"; batter: Player; pitcher: Player; inning: number }
  | { type: "walk"; batter: Player; pitcher: Player; inning: number }
  | { type: "single"; batter: Player; pitcher: Player; inning: number }
  | { type: "double"; batter: Player; pitcher: Player; inning: number }
  | { type: "triple"; batter: Player; pitcher: Player; inning: number }
  | { type: "homerun"; batter: Player; pitcher: Player; rbi: number; inning: number }
  | { type: "out"; batter: Player; pitcher: Player; inning: number }
  | { type: "inning_start"; inning: number; isTop: boolean }
  | { type: "inning_end"; inning: number; isTop: boolean; runs: number; hits: number }
  | { type: "pitcher_change"; oldPitcher: Player; newPitcher: Player; inning: number }
  | { type: "game_start"; homeTeam: Player[]; awayTeam: Player[]; seed?: number }
  | { type: "game_end"; homeRuns: number; awayRuns: number; isWin: boolean }
  | { type: "match_start" }
  | { type: "match_end"; isWin: boolean; cashEarned: number };

/**
 * Event listener function type
 */
export type EventListener<T extends GameEvent = GameEvent> = (event: T) => void;

/**
 * Event emitter for game events
 */
export class GameEventEmitter {
  private listeners: Map<GameEvent["type"], Set<EventListener>> = new Map();
  private debugMode = false;

  /**
   * Subscribe to a specific event type
   */
  on<T extends GameEvent["type"]>(
    eventType: T,
    listener: EventListener<Extract<GameEvent, { type: T }>>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener as EventListener);

    // Return unsubscribe function
    return () => this.off(eventType, listener);
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends GameEvent["type"]>(
    eventType: T,
    listener: EventListener<Extract<GameEvent, { type: T }>>
  ): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener as EventListener);
    }
  }

  /**
   * Subscribe to event once (auto-unsubscribes after first trigger)
   */
  once<T extends GameEvent["type"]>(
    eventType: T,
    listener: EventListener<Extract<GameEvent, { type: T }>>
  ): () => void {
    const wrappedListener = (event: GameEvent) => {
      listener(event as Extract<GameEvent, { type: T }>);
      this.off(eventType, wrappedListener as EventListener<Extract<GameEvent, { type: T }>>);
    };

    return this.on(eventType, wrappedListener as EventListener<Extract<GameEvent, { type: T }>>);
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T extends GameEvent>(event: T): void {
    if (this.debugMode) {
      console.log("[GameEvent]", event.type, event);
    }

    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event type, or all listeners if no type specified
   */
  clear(eventType?: GameEvent["type"]): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Enable/disable debug logging of all events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Get count of listeners for an event type
   */
  listenerCount(eventType: GameEvent["type"]): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }
}

/**
 * Global game event emitter instance
 */
export const gameEvents = new GameEventEmitter();
