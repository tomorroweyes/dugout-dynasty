import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BatterApproach, PitchStrategy } from "@/types/approach";

const MAX_DECISION_EVENTS = 500;

export interface AtBatDecisionTelemetryEvent {
  timestamp: number;
  inning: number;
  isTop: boolean;
  decisionMs: number;
  approach?: BatterApproach;
  strategy?: PitchStrategy;
  approachRepeatStreak: number;
  strategyRepeatStreak: number;
  adaptationPenaltyExposure: number;
}

export interface PostMatchInsightTelemetryEvent {
  timestamp: number;
  type: "viewed" | "expanded" | "collapsed" | "post_loss_continue";
  isLossContext: boolean;
}

interface TelemetryState {
  atBatDecisionEvents: AtBatDecisionTelemetryEvent[];
  postMatchInsightEvents: PostMatchInsightTelemetryEvent[];
  trackAtBatDecision: (event: AtBatDecisionTelemetryEvent) => void;
  trackPostMatchInsight: (event: PostMatchInsightTelemetryEvent) => void;
  clearTelemetry: () => void;
}

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set) => ({
      atBatDecisionEvents: [],
      postMatchInsightEvents: [],

      trackAtBatDecision: (event) =>
        set((state) => ({
          atBatDecisionEvents: [...state.atBatDecisionEvents, event].slice(
            -MAX_DECISION_EVENTS,
          ),
        })),

      trackPostMatchInsight: (event) =>
        set((state) => ({
          postMatchInsightEvents: [...state.postMatchInsightEvents, event].slice(
            -MAX_DECISION_EVENTS,
          ),
        })),

      clearTelemetry: () =>
        set({ atBatDecisionEvents: [], postMatchInsightEvents: [] }),
    }),
    {
      name: "dustycleats-telemetry",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        atBatDecisionEvents: state.atBatDecisionEvents,
        postMatchInsightEvents: state.postMatchInsightEvents,
      }),
    },
  ),
);
