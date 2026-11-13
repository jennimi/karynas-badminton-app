import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  Clock,
  Lock,
  LockOpen,
  Pencil,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { EmptyState } from "../../../shared/components/EmptyState";
import { cn } from "../../../shared/lib/cn";
import type {
  PaymentStatus,
  SessionWithParticipants,
} from "../../../shared/types";
import { Avatar } from "../../../shared/ui/avatar";
import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../shared/ui/card";
import { Input } from "../../../shared/ui/input";
import { CURRENCY_SYMBOL, formatMoney } from "../../../shared/utils/format";
import { bulkSetPaymentStatus, setPaymentStatus, setSessionCost } from "../api";
import { useAdmin } from "../useAdmin";
import { AdminDialog } from "./AdminDialog";

const statusInfo: Record<
  PaymentStatus,
  { label: string; variant: "neutral" | "butter" | "lime" }
> = {
  unpaid: { label: "Not paid", variant: "neutral" },
  pending: { label: "Paid, waiting approval", variant: "butter" },
  approved: { label: "Approved", variant: "lime" },
};

/**
 * Participants + payment checklist for one session.
 * Members tick themselves off as paid; the admin sets the cost and approves.
 */
export function PaymentPanel({
  session,
  onAddParticipants,
}: {
  session: SessionWithParticipants;
  onAddParticipants: () => void;
}) {
  const queryClient = useQueryClient();
  const admin = useAdmin(session.group_id);
  const [unlocking, setUnlocking] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const people = [...session.participants].sort((a, b) =>
    a.member.name.localeCompare(b.member.name),
  );
  const n = people.length;
  const total = session.total_cost;
  /** payments open only once the admin has set the cost */
  const costSet = total != null;
  const share = costSet && n > 0 ? total / n : null;
  const approved = people.filter((p) => p.payment_status === "approved").length;
  const pending = people.filter((p) => p.payment_status === "pending").length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["session", session.id] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["upcomingSessions"] });
  };
  const onAdminError = (e: Error) => {
    if (/passcode|admin/i.test(e.message)) admin.lock();
    toast.error(e.message);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      setPaymentStatus(id, status, admin.code),
    onSuccess: refresh,
    onError: onAdminError,
  });

  const costMutation = useMutation({
    mutationFn: (cost: number | null) =>
      setSessionCost(session.id, cost, admin.code!),
    onSuccess: () => {
      refresh();
      setEditingCost(false);
      toast.success("Cost saved");
    },
    onError: onAdminError,
  });

  type BulkAction = "approveAll" | "backToWaiting" | "resetAll";
  const bulkMutation = useMutation({
    mutationFn: async (action: BulkAction) => {
      const code = admin.code!;
      if (action === "approveAll")
        return bulkSetPaymentStatus(session.id, "pending", "approved", code);
      if (action === "backToWaiting")
        return bulkSetPaymentStatus(session.id, "approved", "pending", code);
      // resetAll: everyone who is approved or waiting goes back to Not paid
      const a = await bulkSetPaymentStatus(session.id, "approved", "unpaid", code);
      const w = await bulkSetPaymentStatus(session.id, "pending", "unpaid", code);
      return a + w;
    },
    onSuccess: (count, action) => {
      refresh();
      setConfirmReset(false);
      const s = count === 1 ? "" : "s";
      toast.success(
        action === "approveAll"
          ? `Approved ${count} payment${s}`
          : action === "backToWaiting"
            ? `${count} payment${s} moved back to waiting`
            : `${count} payment${s} reset to not paid`,
      );
    },
    onError: onAdminError,
  });

  const saveCost = (e: FormEvent) => {
    e.preventDefault();
    const value = costInput.trim() === "" ? null : Number(costInput);
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    costMutation.mutate(value);
  };

  const busyId = statusMutation.isPending
    ? statusMutation.variables?.id
    : undefined;

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2">
          Participants & payments <Badge variant="brand">{n}</Badge>
        </CardTitle>
        {admin.isAdmin ? (
          <Button size="sm" variant="secondary" onClick={admin.lock}>
            <LockOpen /> Admin on · Lock
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUnlocking(true)}
          >
            <Lock /> Admin
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cost + progress */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-muted/60 p-3">
          {editingCost ? (
            <form onSubmit={saveCost} className="flex items-center gap-2">
              <label htmlFor="cost" className="text-sm font-bold">
                Total cost
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {CURRENCY_SYMBOL}
                </span>
                <Input
                  id="cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  autoFocus
                  placeholder="150000"
                  className="w-36 pl-9"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={costMutation.isPending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingCost(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs font-bold text-muted-foreground">
                  Total cost
                </p>
                <p className="text-lg font-extrabold">
                  {total != null ? formatMoney(total) : "Not set"}
                </p>
              </div>
              {admin.isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit total cost"
                  onClick={() => {
                    setCostInput(total != null ? String(total) : "");
                    setEditingCost(true);
                  }}
                >
                  <Pencil />
                </Button>
              )}
            </div>
          )}
          {share != null && (
            <div>
              <p className="text-xs font-bold text-muted-foreground">
                Each person
              </p>
              <p className="text-lg font-extrabold">{formatMoney(share)}</p>
            </div>
          )}
          {n > 0 && costSet && (
            <div className="min-w-40 flex-1">
              <p className="text-xs font-bold text-muted-foreground">
                {approved}/{n} approved{pending > 0 && ` · ${pending} waiting`}
              </p>
              <div
                role="img"
                aria-label={`${approved} of ${n} payments approved, ${pending} waiting`}
                className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-card"
              >
                <div
                  className="h-full bg-lime transition-all"
                  style={{ width: `${(approved / n) * 100}%` }}
                />
                <div
                  className="h-full bg-butter transition-all"
                  style={{ width: `${(pending / n) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        {!costSet && n > 0 && (
          <p className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            {admin.isAdmin
              ? "Set the total cost to open payments. Members can tick themselves off after that."
              : "Payments open once the admin sets the cost for this session."}
          </p>
        )}

        {admin.isAdmin && costSet && n > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="lime"
              disabled={pending === 0 || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate("approveAll")}
            >
              <CheckCheck /> Approve all waiting ({pending})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={approved === 0 || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate("backToWaiting")}
            >
              <Undo2 /> Approved → waiting ({approved})
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={approved + pending === 0 || bulkMutation.isPending}
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw /> Reset to not paid ({approved + pending})
            </Button>
          </div>
        )}

        {n === 0 ? (
          <EmptyState
            emoji="👥"
            title="No participants yet"
            action={
              <Button size="sm" onClick={onAddParticipants}>
                <Pencil /> Add participants
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {people.map((p) => {
              const status = p.payment_status ?? "unpaid";
              const info = statusInfo[status];
              const busy = busyId === p.id;
              const set = (s: PaymentStatus) =>
                statusMutation.mutate({ id: p.id, status: s });
              const locked = status === "approved" && !admin.isAdmin;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 py-2.5"
                >
                  {/* the tick box: members tick themselves off as paid */}
                  {costSet && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={
                        status === "unpaid"
                          ? false
                          : status === "approved"
                            ? true
                            : "mixed"
                      }
                      aria-label={`${p.member.name} has paid`}
                      disabled={busy || locked}
                      onClick={() =>
                        set(
                          status === "unpaid"
                            ? "pending"
                            : status === "pending"
                              ? "unpaid"
                              : "pending",
                        )
                      }
                      title={locked ? "Approved by the admin" : undefined}
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
                        status === "unpaid" &&
                          "border-border bg-card hover:border-brand",
                        status === "pending" &&
                          "border-butter bg-butter-soft text-butter-strong",
                        status === "approved" && "border-lime bg-lime text-ink",
                      )}
                    >
                      {status === "approved" && (
                        <Check className="size-4" strokeWidth={3} />
                      )}
                      {status === "pending" && (
                        <Clock className="size-3.5" strokeWidth={3} />
                      )}
                    </button>
                  )}
                  <Avatar name={p.member.name} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {p.member.name}
                  </span>
                  {share != null && (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {formatMoney(share)}
                    </span>
                  )}
                  {costSet && (
                    <Badge variant={info.variant}>{info.label}</Badge>
                  )}
                  {costSet && admin.isAdmin && status !== "approved" && (
                    <Button
                      size="sm"
                      variant="lime"
                      disabled={busy}
                      onClick={() => set("approved")}
                    >
                      <Check /> Approve
                    </Button>
                  )}
                  {costSet && admin.isAdmin && status === "approved" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => set("pending")}
                    >
                      Undo
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => bulkMutation.mutate("resetAll")}
        isLoading={bulkMutation.isPending}
        title="Reset all payments?"
        description={`${approved} approved and ${pending} waiting payment${approved + pending === 1 ? "" : "s"} will go back to “Not paid”. Members will need to tick themselves off again.`}
        confirmLabel="Reset to not paid"
      />

      {unlocking && (
        <AdminDialog
          groupId={session.group_id}
          onClose={() => setUnlocking(false)}
        />
      )}
    </Card>
  );
}
