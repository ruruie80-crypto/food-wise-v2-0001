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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>使ったぶんを減らしますか</DialogTitle>
          <DialogDescription>
            この献立で使う食材を、冷蔵庫から先に減らします。味噌やわかめは減らしません。減らさなければ、在庫はそのままです。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
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
