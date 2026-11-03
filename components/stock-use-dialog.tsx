"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StockUseDialog({
  open,
  onOpenChange,
  onUse,
  onKeep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: () => void;
  onKeep?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>使ったぶんを減らしますか</DialogTitle>
          <DialogDescription>
            作った日の食材を、冷蔵庫から先に減らします。味噌やわかめは減らしません。献立を作っただけでは減らしません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              onKeep?.();
              onOpenChange(false);
            }}
          >
            在庫はそのまま
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              onUse();
              onOpenChange(false);
            }}
          >
            使ったぶんを減らす
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
