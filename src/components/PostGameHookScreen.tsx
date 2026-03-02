import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PostGameHook } from "@/engine/postGameHooks";

interface PostGameHookScreenProps {
  isWin: boolean;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  hooks: PostGameHook[];
  onContinue: () => void;
}

const URGENCY_STYLES: Record<PostGameHook["urgency"], string> = {
  high: "border-yellow-500/40 bg-yellow-500/5",
  medium: "border-blue-500/30 bg-blue-500/5",
  low: "border-border/40 bg-muted/5",
};

export function PostGameHookScreen({
  isWin,
  myScore,
  opponentScore,
  opponentName,
  hooks,
  onContinue,
}: PostGameHookScreenProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onContinue]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="max-w-md w-full mx-auto p-8 space-y-6">
        {/* Result header */}
        <div className="text-center space-y-2">
          <div
            className={`text-3xl font-bold ${
              isWin ? "text-green-400" : "text-red-400"
            }`}
          >
            {isWin ? "Victory" : "Defeat"}
          </div>
          <div className="text-4xl font-mono font-bold tracking-tight">
            {myScore}
            <span className="text-muted-foreground mx-2">–</span>
            {opponentScore}
          </div>
          <div className="text-sm text-muted-foreground">vs. {opponentName}</div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* Forward-looking hooks */}
        {hooks.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              What&apos;s next
            </h3>
            {hooks.map((hook, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 flex items-start gap-3 transition-colors ${
                  URGENCY_STYLES[hook.urgency]
                }`}
              >
                <span className="text-xl leading-none mt-0.5 flex-shrink-0">
                  {hook.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-snug">
                    {hook.headline}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {hook.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Button onClick={onContinue} className="w-full" size="lg">
          Back to League
          <span className="ml-2 text-[10px] font-mono opacity-50 bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5">
            Space
          </span>
        </Button>
      </Card>
    </div>
  );
}
