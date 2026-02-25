import { Player } from "@/types/game";
import { PlayerClass, CLASS_INFO } from "@/types/ability";
import { getAvailableClasses } from "@/engine/classSelection";
import { Button } from "@/components/ui/8bit/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/8bit/dialog";
import { Badge } from "@/components/ui/8bit/badge";
import { Separator } from "@/components/ui/8bit/separator";

interface ClassSelectionDialogProps {
  player: Player;
  open: boolean;
  onSelectClass: (playerId: string, playerClass: PlayerClass) => void;
  onClose: () => void;
}

export function ClassSelectionDialog({
  player,
  open,
  onSelectClass,
  onClose,
}: ClassSelectionDialogProps) {
  // Get available classes based on player role (no duplicates)
  const availableClassNames = getAvailableClasses(player);
  const availableClasses = availableClassNames.map((className) => CLASS_INFO[className]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Choose Your Class
          </DialogTitle>
          <DialogDescription>
            {player.name} is ready to specialize! Choose a class to unlock special
            abilities and define your playstyle. This choice is permanent.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {availableClasses.map((classInfo) => (
              <div
                key={classInfo.name}
                className="border rounded-lg p-4 hover:bg-accent/50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Class Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">{classInfo.iconEmoji}</span>
                      <div>
                        <h3 className="text-lg font-semibold">
                          {classInfo.displayName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {classInfo.description}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Strengths */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Strengths
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {classInfo.strengths.map((strength) => (
                          <Badge key={strength} variant="outline">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Select Button */}
                  <Button
                    onClick={() => {
                      onSelectClass(player.id, classInfo.name);
                      onClose();
                    }}
                    className="shrink-0"
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogBody>

        <DialogFooter>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Once you choose a class, you cannot change
              it. Each class has unique abilities that fit different playstyles.
              Choose wisely!
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
