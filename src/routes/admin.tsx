import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Growora — Admin" }] }),
  component: AdminPage,
});

type Deposit = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  status: string;
  submitted_at: string;
};
type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  fee_amount: number;
  payout_amount: number;
  currency: string;
  network: string;
  destination: string;
  status: string;
  requested_at: string;
  payout_reference?: string | null;
};
type Transaction = {
  id: string;
  user_id: string;
  kind: string;
  wallet: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
const date = (value: string) => new Date(value).toLocaleString();

function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [playTotal, setPlayTotal] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [busyRequest, setBusyRequest] = useState("");
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setIsAdmin(false);
        setError("Sign in with the administrator account to open this page.");
        return;
      }
      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (adminError) throw adminError;
      if (!admin) {
        setIsAdmin(false);
        setError("This account does not have administrator access.");
        return;
      }
      setIsAdmin(true);

      const [profilesRes, savesRes, depositsRes, withdrawalsRes, txRes] = await Promise.all([
        supabase.from("player_profiles").select("id", { count: "exact", head: true }),
        supabase.from("game_saves").select("save_data"),
        supabase.from("deposit_requests").select("id,user_id,amount,currency,payment_method,payment_reference,status,submitted_at").order("submitted_at", { ascending: false }).limit(30),
        supabase.from("withdrawal_requests").select("id,user_id,amount,fee_amount,payout_amount,currency,network,destination,status,requested_at").order("requested_at", { ascending: false }).limit(30),
        supabase.from("wallet_transactions").select("id,user_id,kind,wallet,amount,currency,status,created_at").order("created_at", { ascending: false }).limit(30),
      ]);
      for (const result of [profilesRes, savesRes, depositsRes, withdrawalsRes, txRes]) {
        if (result.error) throw result.error;
      }
      setPlayerCount(profilesRes.count ?? 0);
      const saves = savesRes.data ?? [];
      setPlayTotal(saves.reduce((sum, row) => sum + Number(row.save_data?.playBalance ?? 0), 0));
      setSalesTotal(saves.reduce((sum, row) => sum + Number(row.save_data?.salesBalance ?? 0), 0));
      setDeposits((depositsRes.data ?? []) as Deposit[]);
      setWithdrawals((withdrawalsRes.data ?? []) as Withdrawal[]);
      setTransactions((txRes.data ?? []) as Transaction[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load administrator data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (action: string, requestId: string, reference?: string) => {
    setError("");
    setBusyRequest(requestId);
    try {
      const args = action === "admin_mark_withdrawal_paid"
        ? { p_request_id: requestId, p_payout_reference: reference?.trim() ?? "" }
        : { p_request_id: requestId, p_admin_note: null };
      const { error: actionError } = await supabase.rpc(action, args);
      if (actionError) throw actionError;
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The admin action failed.");
    } finally {
      setBusyRequest("");
    }
  };

  const pendingDeposits = deposits.filter((item) => item.status === "pending").length;
  const pendingWithdrawals = withdrawals.filter((item) => item.status === "pending").length;

  return (
    <main className="min-h-screen bg-ocean p-4 text-foreground sm:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl text-primary">GROWORA · ADMIN</h1>
            <p className="mt-1 text-sm opacity-70">Players, balances and payment review</p>
          </div>
          <div className="flex gap-2">
            <button className="hud-chip px-3 py-2 text-sm" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <a href={import.meta.env.BASE_URL} className="hud-chip px-3 py-2 text-sm underline">Back to game</a>
          </div>
        </header>

        {error && <section role="alert" className="hud-chip border border-destructive/50 p-4 text-sm">{error}</section>}

        {isAdmin && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Registered players" value={String(playerCount)} />
              <Metric label="Play balances" value={`$${money(playTotal)}`} />
              <Metric label="Sales balances" value={`$${money(salesTotal)}`} />
              <Metric label="Pending requests" value={String(pendingDeposits + pendingWithdrawals)} detail={`${pendingDeposits} deposits · ${pendingWithdrawals} withdrawals`} />
            </section>

            <section className="hud-chip space-y-3 p-4">
              <h2 className="font-display text-sm text-primary">Automatically verified deposits</h2>
              {deposits.length === 0 ? <p className="text-sm opacity-70">No deposit requests yet.</p> : (
                <div className="space-y-2">
                  {deposits.map((item) => (
                    <article key={item.id} className="rounded border border-wood/40 p-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>${money(Number(item.amount))} {item.currency}</strong>
                        <span className="capitalize">{item.status}</span>
                      </div>
                      <p className="break-all opacity-70">Player: {item.user_id}</p>
                      <p>Method: {item.payment_method} · {date(item.submitted_at)}</p>
                      {item.payment_reference && <p className="break-all">Reference: {item.payment_reference}</p>}
                      {item.status === "pending" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="text-xs opacity-70">Legacy pending request — not credited until a valid on-chain transaction is verified.</span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="hud-chip space-y-3 p-4">
              <h2 className="font-display text-sm text-primary">Withdrawal requests</h2>
              {withdrawals.length === 0 ? <p className="text-sm opacity-70">No withdrawal requests yet.</p> : (
                <div className="space-y-2">
                  {withdrawals.map((item) => (
                    <article key={item.id} className="rounded border border-wood/40 p-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>${money(Number(item.amount))} requested · ${money(Number(item.payout_amount))} net</strong>
                        <span className="capitalize">{item.status}</span>
                      </div>
                      <p className="break-all opacity-70">Player: {item.user_id}</p>
                      <p>Fee: ${money(Number(item.fee_amount))} · {item.network} · {date(item.requested_at)}</p>
                      <p className="break-all">Destination: {item.destination}</p>
                      {item.status === "pending" && (
                        <button className="hud-chip mt-3 px-3 py-2 text-xs" disabled={busyRequest === item.id} onClick={() => void runAction("admin_approve_withdrawal", item.id)}>Approve withdrawal for payout</button>
                      )}
                      {item.status === "approved" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <input className="min-w-0 flex-1 rounded border border-wood/50 bg-background px-3 py-2 text-xs" placeholder="Payout transaction hash" value={payoutRefs[item.id] ?? ""} onChange={(event) => setPayoutRefs((old) => ({ ...old, [item.id]: event.target.value }))} />
                          <button className="hud-chip px-3 py-2 text-xs" disabled={busyRequest === item.id || (payoutRefs[item.id] ?? "").trim().length < 8} onClick={() => void runAction("admin_mark_withdrawal_paid", item.id, payoutRefs[item.id])}>Mark paid</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="hud-chip space-y-3 p-4">
              <h2 className="font-display text-sm text-primary">Recent wallet operations</h2>
              {transactions.length === 0 ? <p className="text-sm opacity-70">No confirmed wallet operations recorded yet.</p> : (
                <div className="space-y-2">
                  {transactions.map((item) => (
                    <article key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-wood/40 py-2 text-sm">
                      <div>
                        <strong className="capitalize">{item.kind}</strong>
                        <p className="break-all text-xs opacity-70">{item.user_id}</p>
                      </div>
                      <div className="text-right">
                        <p>{money(Number(item.amount))} {item.currency}</p>
                        <p className="text-xs opacity-70">{item.status} · {date(item.created_at)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <p className="text-xs opacity-70">Deposits are verified and credited automatically after 12 BNB Smart Chain confirmations. Withdrawal amounts are reserved immediately when requested; send the net amount manually on BEP-20, then record the payout transaction hash to mark it paid.</p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="hud-chip space-y-1 p-4">
      <p className="text-xs opacity-70">{label}</p>
      <p className="font-display text-xl text-primary">{value}</p>
      {detail && <p className="text-xs opacity-70">{detail}</p>}
    </article>
  );
}
