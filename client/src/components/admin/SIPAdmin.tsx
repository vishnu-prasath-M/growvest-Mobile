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
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" />
            SIP Management (Systematic Investment Plans)
          </h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            Monitor all user recurring investment plans, contribution histories, and withdrawal claims.
          </p>
        </div>
        <Button
          onClick={fetchSIPData}
          variant="outline"
          className="rounded-xl font-body gap-2 self-start"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Total SIPs</p>
              <h3 className="text-xl font-heading font-bold text-foreground mt-1">{stats.totalSIPs}</h3>
              <p className="text-xs font-body text-emerald-600 font-medium mt-0.5">{stats.activeSIPs} Active Plans</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Total Contributed</p>
              <h3 className="text-xl font-heading font-bold text-foreground mt-1">{formatCurrency(stats.totalSIPAmount)}</h3>
              <p className="text-xs font-body text-muted-foreground mt-0.5">Across all plans</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Completed Plans</p>
              <h3 className="text-xl font-heading font-bold text-foreground mt-1">{stats.completedSIPs}</h3>
              <p className="text-xs font-body text-amber-600 font-medium mt-0.5">{stats.cancelledSIPs} Cancelled</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Installments Pending</p>
              <h3 className="text-xl font-heading font-bold text-foreground mt-1">{stats.pendingPayments}</h3>
              <p className="text-xs font-body text-purple-600 font-medium mt-0.5">Scheduled dues</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by User, Email, or SIP ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-input rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* SIP Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
              <tr>
                <th className="p-4">SIP ID</th>
                <th className="p-4">User</th>
                <th className="p-4">Frequency & Amount</th>
                <th className="p-4">Schedule</th>
                <th className="p-4">Progress</th>
                <th className="p-4">Total Paid</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading SIP plans...
                  </td>
                </tr>
              ) : filteredSIPs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
                    <tr key={s._id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono font-semibold text-primary">{s.sipId}</td>
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{s.userName}</div>
                        <div className="text-xs text-muted-foreground">{s.userEmail}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-foreground">{formatCurrency(s.amount)}</div>
                        <div className="text-xs text-muted-foreground capitalize">{s.frequency || "Monthly"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-medium text-foreground">
                          {s.frequency === "daily"
                            ? "Every Day"
                            : s.frequency === "weekly"
                            ? `Every ${s.sipDayName || "Week"}`
                            : `${s.sipDate}th of month`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.totalContributions} total installments
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {s.contributionsCompleted}/{s.totalContributions}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-emerald-600">{formatCurrency(s.totalPaidAmount)}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            s.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : s.status === "completed"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {s.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSIP(s)}
                          className="h-8 rounded-xl text-xs font-body gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    SIP Details: {selectedSIP.sipId}
                  </h3>
                  <p className="text-xs font-body text-muted-foreground mt-0.5">
                    User: {selectedSIP.userName} ({selectedSIP.userEmail})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSIP(null)}
                  className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/30 p-4 rounded-xl border border-border">
                  <div>
                    <span className="text-xs font-body text-muted-foreground">Contribution</span>
                    <p className="text-base font-heading font-bold text-foreground">{formatCurrency(selectedSIP.amount)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-body text-muted-foreground">Total Planned</span>
                    <p className="text-base font-heading font-bold text-foreground">{formatCurrency(selectedSIP.totalPlannedAmount)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-body text-muted-foreground">Total Paid</span>
                    <p className="text-base font-heading font-bold text-emerald-600">{formatCurrency(selectedSIP.totalPaidAmount)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-body text-muted-foreground">Withdrawn</span>
                    <p className="text-base font-heading font-bold text-foreground">{formatCurrency(selectedSIP.withdrawnAmount)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-body text-muted-foreground">Start Date</span>
                    <p className="text-sm font-body font-semibold text-foreground">{formatDate(selectedSIP.startDate)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-body text-muted-foreground">End Date</span>
                    <p className="text-sm font-body font-semibold text-foreground">{formatDate(selectedSIP.endDate)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">SIP Overview</h4>
                  <div className="p-3 bg-muted/20 rounded-xl border border-border text-xs font-body text-foreground space-y-1.5">
                    <p>• Frequency: <span className="font-semibold capitalize">{selectedSIP.frequency || "Monthly"}</span></p>
                    <p>• Schedule: <span className="font-semibold">
                      {selectedSIP.frequency === "daily"
                        ? "Every Day"
                        : selectedSIP.frequency === "weekly"
                        ? `Every ${selectedSIP.sipDayName || "Week"}`
                        : `Every ${selectedSIP.sipDate}th of the month`}
                    </span></p>
                    <p>• Status: <span className="font-bold text-emerald-600">{selectedSIP.status.toUpperCase()}</span></p>
                    <p>• Completed Contributions: <span className="font-bold">{selectedSIP.contributionsCompleted}</span> of {selectedSIP.totalContributions}</p>
                    <p>• Next Contribution Due: <span className="font-semibold">{formatDate(selectedSIP.nextContributionDate)}</span></p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border flex justify-end">
                <Button onClick={() => setSelectedSIP(null)} variant="outline" className="rounded-xl font-body">
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

