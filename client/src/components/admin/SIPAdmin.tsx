import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  DollarSign,
  TrendingUp,
  X,
  Eye,
  Calendar,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://growvest-mobile.onrender.com");

interface SIPAdminProps {
  token: string | null;
}

export default function SIPAdmin({ token }: SIPAdminProps) {
  const [stats, setStats] = useState<any>(null);
  const [sips, setSips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Detail Modal
  const [selectedSIP, setSelectedSIP] = useState<any | null>(null);

  const fetchSIPData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/sip/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setSips(data.sips || []);
      }
    } catch (err) {
      console.error("Error fetching admin SIP data:", err);
      toast.error("Failed to load SIP records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSIPData();
  }, [token]);

  const filteredSIPs = sips.filter((s) => {
    const matchesSearch =
      (s.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.sipId || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val: number) => `₹${Number(val || 0).toLocaleString("en-IN")}`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-emerald-400" />
            SIP Management (Systematic Investment Plans)
          </h2>
          <p className="text-sm text-slate-400">
            Monitor all user recurring investment plans, contribution histories, and withdrawal claims.
          </p>
        </div>
        <Button
          onClick={fetchSIPData}
          variant="outline"
          className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 gap-2 self-start"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total SIPs</p>
              <h3 className="text-2xl font-bold text-white">{stats.totalSIPs}</h3>
              <p className="text-xs text-emerald-400 mt-0.5">{stats.activeSIPs} Active</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Contributed</p>
              <h3 className="text-2xl font-bold text-white">{formatCurrency(stats.totalSIPAmount)}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Across all plans</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Plans</p>
              <h3 className="text-2xl font-bold text-white">{stats.completedSIPs}</h3>
              <p className="text-xs text-amber-400 mt-0.5">{stats.cancelledSIPs} Cancelled</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Installments Pending</p>
              <h3 className="text-2xl font-bold text-white">{stats.pendingPayments}</h3>
              <p className="text-xs text-purple-400 mt-0.5">Scheduled dues</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by User, Email, or SIP ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* SIP Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">SIP ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Monthly Amount</th>
                <th className="p-4">Schedule</th>
                <th className="p-4">Progress</th>
                <th className="p-4">Total Paid</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading SIP plans...
                  </td>
                </tr>
              ) : filteredSIPs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No SIP plans found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredSIPs.map((s) => {
                  const progress =
                    s.totalContributions > 0
                      ? Math.round((s.contributionsCompleted / s.totalContributions) * 100)
                      : 0;

                  return (
                    <tr key={s._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono font-medium text-emerald-400">{s.sipId}</td>
                      <td className="p-4">
                        <div className="font-medium text-white">{s.userName}</div>
                        <div className="text-xs text-slate-400">{s.userEmail}</div>
                      </td>
                      <td className="p-4 font-semibold text-white">{formatCurrency(s.amount)}</td>
                      <td className="p-4">
                        <div className="text-xs font-medium text-slate-200">{s.sipDate}th of month</div>
                        <div className="text-xs text-slate-400">{s.durationMonths} Months duration</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-300">
                            {s.contributionsCompleted}/{s.totalContributions}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-emerald-400">{formatCurrency(s.totalPaidAmount)}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            s.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : s.status === "completed"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedSIP(s)}
                          className="text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIP Details Modal */}
      <AnimatePresence>
        {selectedSIP && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-emerald-400" />
                    SIP Details: {selectedSIP.sipId}
                  </h3>
                  <p className="text-xs text-slate-400">
                    User: {selectedSIP.userName} ({selectedSIP.userEmail})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSIP(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
                  <div>
                    <span className="text-xs text-slate-500">Monthly Contribution</span>
                    <p className="text-base font-bold text-white">{formatCurrency(selectedSIP.amount)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Total Planned</span>
                    <p className="text-base font-bold text-white">{formatCurrency(selectedSIP.totalPlannedAmount)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Total Paid</span>
                    <p className="text-base font-bold text-emerald-400">{formatCurrency(selectedSIP.totalPaidAmount)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Withdrawn</span>
                    <p className="text-base font-bold text-slate-300">{formatCurrency(selectedSIP.withdrawnAmount)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Start Date</span>
                    <p className="text-sm font-semibold text-slate-200">{formatDate(selectedSIP.startDate)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">End Date</span>
                    <p className="text-sm font-semibold text-slate-200">{formatDate(selectedSIP.endDate)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SIP Overview</h4>
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
                    <p>• Recurring Date: Every {selectedSIP.sipDate}th of the month</p>
                    <p>• Status: <span className="font-semibold text-emerald-400">{selectedSIP.status}</span></p>
                    <p>• Completed Contributions: {selectedSIP.contributionsCompleted} of {selectedSIP.totalContributions}</p>
                    <p>• Next Contribution Due: {formatDate(selectedSIP.nextContributionDate)}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 flex justify-end">
                <Button onClick={() => setSelectedSIP(null)} variant="outline" className="border-slate-700 text-slate-300">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
