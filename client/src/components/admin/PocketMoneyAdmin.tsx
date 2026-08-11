import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Play,
  ArrowRight,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:5000" : "https://growvest-mobile.onrender.com");

interface PocketMoneyAdminProps {
  token: string | null;
}

export default function PocketMoneyAdmin({ token }: PocketMoneyAdminProps) {
  const [stats, setStats] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggering, setTriggering] = useState(false);

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/pocket-money/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching admin pocket money stats:", err);
    }
  };

  const fetchList = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/pocket-money/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching admin pocket money list:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunScheduler = async () => {
    if (!token || triggering) return;
    try {
      setTriggering(true);
      const res = await fetch(`${API_URL}/api/pocket-money/admin/trigger-payouts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(`Scheduler complete! Processed ${data.processedCount} payouts.`);
      fetchStats();
      fetchList();
    } catch (err) {
      console.error("Error running scheduler manually:", err);
      alert("Failed to run scheduler");
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchList();
  }, [token]);

  const filteredList = list.filter((item) => {
    const matchesSearch =
      item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mobileNumber?.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const today = new Date();
  const todayPayoutsList = list.filter(
    (item) => item.status === "active" && new Date(item.nextPayoutDate) <= today
  );

  const fmt = (num: number) => {
    return (num || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Pocket Money Control Center</h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            Manage user pocket money release schedules and trigger cron payouts.
          </p>
        </div>
        <Button
          onClick={handleRunScheduler}
          disabled={triggering}
          className="rounded-xl font-body flex items-center gap-2 h-11"
        >
          <RefreshCw className={`h-4 w-4 ${triggering ? "animate-spin" : ""}`} />
          Run Payouts Scheduler
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Invested",
              val: `₹${fmt(stats.totalInvested)}`,
              desc: `${stats.totalInvestments} Total Plans`,
              icon: DollarSign,
              color: "text-primary bg-primary/10",
            },
            {
              label: "Total Released",
              val: `₹${fmt(stats.totalReleased)}`,
              desc: "Credited to User Wallets",
              icon: CheckCircle,
              color: "text-emerald-600 bg-emerald-50",
            },
            {
              label: "Remaining Pool",
              val: `₹${fmt(stats.remainingAmount)}`,
              desc: "Scheduled for Release",
              icon: Wallet,
              color: "text-amber-600 bg-amber-50",
            },
            {
              label: "Active / Completed",
              val: `${stats.activeCount} / ${stats.completedCount}`,
              desc: `${stats.todayPayoutsDue} Payouts Due Today`,
              icon: Clock,
              color: "text-blue-600 bg-blue-50",
            },
          ].map((card, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <h3 className="text-xl font-heading font-bold text-foreground mt-1">{card.val}</h3>
                <p className="text-xs font-body text-muted-foreground mt-0.5">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's Due Payouts */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground">Today's Due Payouts</h2>
            <p className="text-xs font-body text-muted-foreground mt-0.5">
              Pocket money payouts waiting for scheduler release check today.
            </p>
          </div>
          <span className="text-xs font-body font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            {todayPayoutsList.length} Due
          </span>
        </div>

        {todayPayoutsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Release Payout</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm font-body">
                {todayPayoutsList.map((item) => (
                  <tr key={item._id} className="hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{item.userName}</div>
                      <div className="text-xs text-muted-foreground">{item.userEmail}</div>
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold">{item.frequency}</td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">₹{fmt(item.payoutAmount)}</td>
                    <td className="py-3 px-4">₹{fmt(item.remainingAmount)}</td>
                    <td className="py-3 px-4 text-amber-600 font-semibold">
                      {new Date(item.nextPayoutDate).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/20 border border-dashed border-border rounded-xl">
            <CheckCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-body text-muted-foreground">All pocket money payouts are up to date.</p>
          </div>
        )}
      </div>

      {/* Main List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground">Pocket Money Investment History</h2>
            <p className="text-xs font-body text-muted-foreground mt-0.5">
              Full registry of user pocket money records.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-background text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-xl bg-background text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
            <p className="text-sm font-body text-muted-foreground">Loading registry...</p>
          </div>
        ) : filteredList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Invested Amount</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Released / Remaining</th>
                  <th className="py-3 px-4">Next Release</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm font-body">
                {filteredList.map((item) => (
                  <tr key={item._id} className="hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{item.userName}</div>
                      <div className="text-xs text-muted-foreground">{item.userEmail}</div>
                      {item.mobileNumber && <div className="text-xs text-muted-foreground">{item.mobileNumber}</div>}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">₹{fmt(item.investedAmount)}</td>
                    <td className="py-3 px-4 capitalize font-semibold">{item.frequency}</td>
                    <td className="py-3 px-4">
                      <div className="text-emerald-600 font-bold">Released: ₹{fmt(item.totalPaidOut)}</div>
                      <div className="text-muted-foreground text-xs">Remaining: ₹{fmt(item.remainingAmount)}</div>
                    </td>
                    <td className="py-3 px-4">
                      {item.status === "active" ? (
                        <>
                          <div className="font-semibold">₹{fmt(item.payoutAmount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.nextPayoutDate).toLocaleDateString("en-IN")}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                          item.status === "active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : item.status === "completed"
                            ? "bg-gray-100 text-gray-600 border-gray-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {item.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-body text-muted-foreground">No pocket money investments found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
