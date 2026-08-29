import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Play,
  TrendingUp,
  DollarSign,
  X,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { generateUPILink } from "@/utils/upi";

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:5000" : "https://growvest-mobile.onrender.com");

interface PocketMoneyAdminProps {
  token: string | null;
}

export default function PocketMoneyAdmin({ token }: PocketMoneyAdminProps) {
  const [stats, setStats] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggering, setTriggering] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const fetchPendingRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/pocket-money/admin/pending-payouts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPendingRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching pending payouts:", err);
    }
  };

  // Modal State for UPI Pay Modal
  const [releaseModalData, setReleaseModalData] = useState<any | null>(null);
  const [modalUpiId, setModalUpiId] = useState("");
  const [fetchingUpi, setFetchingUpi] = useState(false);

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

  // Fetch user UPI details when opening the modal
  useEffect(() => {
    if (!releaseModalData || !token) return;
    const fetchUserUpi = async () => {
      try {
        setFetchingUpi(true);
        const res = await fetch(`${API_URL}/api/users/detail/${encodeURIComponent(releaseModalData.userEmail)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setModalUpiId(data.upiId || "");
        } else {
          setModalUpiId("");
        }
      } catch (err) {
        console.error("Error fetching user UPI ID:", err);
        setModalUpiId("");
      } finally {
        setFetchingUpi(false);
      }
    };
    fetchUserUpi();
  }, [releaseModalData, token]);

  const handleRunScheduler = async () => {
    if (!token || triggering) return;
    try {
      setTriggering(true);
      const res = await fetch(`${API_URL}/api/pocket-money/admin/trigger-payouts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Scheduler complete! Processed ${data.processedCount} payouts.`);
      } else {
        toast.error(data.message || "Failed to execute scheduler.");
      }
      fetchStats();
      fetchList();
    } catch (err) {
      console.error("Error running scheduler manually:", err);
      toast.error("Failed to run scheduler");
    } finally {
      setTriggering(false);
    }
  };

  const handleReleasePayout = async (id: string, userName: string) => {
    if (!token || releasingId) return;
    try {
      setReleasingId(id);
      const res = await fetch(`${API_URL}/api/pocket-money/admin/release/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        // Handle parsing HTML / non-json response
      }

      if (res.ok) {
        toast.success(`Released pocket money payout for ${userName}!`);
        setReleaseModalData(null);
        fetchStats();
        fetchList();
      } else {
        toast.error(data.message || `Failed to release payout (Status: ${res.status}). Ensure backend changes are deployed.`);
      }
    } catch (err) {
      console.error("Error releasing payout:", err);
      toast.error("Failed to release payout. Please check connection.");
    } finally {
      setReleasingId(null);
    }
  };

  const handleConfirmReleasePayout = async (payoutId: string, userName: string) => {
    if (!token || releasingId) return;
    try {
      setReleasingId(payoutId);
      const res = await fetch(`${API_URL}/api/pocket-money/admin/confirm-release/${payoutId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {}

      if (res.ok) {
        toast.success(`Released pocket money payout for ${userName}!`);
        setReleaseModalData(null);
        fetchStats();
        fetchList();
        fetchPendingRequests();
      } else {
        toast.error(data.message || `Failed to release payout (Status: ${res.status}).`);
      }
    } catch (err) {
      console.error("Error releasing payout:", err);
      toast.error("Failed to release payout. Please check connection.");
    } finally {
      setReleasingId(null);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchList();
    fetchPendingRequests();
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

  // Generate dynamic UPI link for QR
  let upiLink = "";
  if (releaseModalData && modalUpiId) {
    try {
      upiLink = generateUPILink(
        modalUpiId,
        releaseModalData.payoutAmount,
        `PM-${releaseModalData._id}-${Date.now()}`,
        "Zenvest"
      );
    } catch (e) {
      console.warn("Invalid UPI link generation parameters:", e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Pocket Money Control Center</h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            Manage user pocket money release schedules and manual payout approvals.
          </p>
        </div>
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

      {/* Pending Payout Requests */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground">Pending Payout Requests</h2>
            <p className="text-xs font-body text-muted-foreground mt-0.5">
              User requested pocket money payouts awaiting approval.
            </p>
          </div>
          <span className="text-xs font-body font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            {pendingRequests.length} Pending
          </span>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Investment Plan</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Payout #</th>
                  <th className="py-3 px-4">Request Amount</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm font-body">
                {pendingRequests.map((payout) => (
                  <tr key={payout._id} className="hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{payout.userId?.name || payout.userId?.username || 'User'}</div>
                      <div className="text-xs text-muted-foreground">{payout.userId?.email || 'No email'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">₹{fmt(payout.pocketMoneyId?.investedAmount)} Plan</div>
                      <div className="text-xs text-primary font-mono">ID: PM-{payout.pocketMoneyId?._id ? String(payout.pocketMoneyId._id).slice(-6).toUpperCase() : 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold">{payout.pocketMoneyId?.frequency || 'daily'}</td>
                    <td className="py-3 px-4 font-semibold text-amber-600">#{payout.payoutNumber || 1} / 10</td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">₹{fmt(payout.amount)}</td>
                    <td className="py-3 px-4">₹{fmt(payout.pocketMoneyId?.remainingAmount || 0)}</td>
                    <td className="py-3 px-4 text-amber-600 font-semibold">
                      {new Date(payout.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => setReleaseModalData({
                          ...payout,
                          _id: payout._id,
                          payoutAmount: payout.amount,
                          userName: payout.userId?.name || payout.userId?.username || 'User',
                          userEmail: payout.userId?.email || 'No email',
                        })}
                        className="rounded-xl font-body h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 mx-auto"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Release
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/20 border border-dashed border-border rounded-xl">
            <CheckCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-body text-muted-foreground">All pocket money payout requests are up to date.</p>
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
                  <th className="py-3 px-4 text-center">Action</th>
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
                    <td className="py-3 px-4 text-center">
                      {item.status === "active" ? (
                        (() => {
                          const todayMidnight = new Date();
                          todayMidnight.setHours(0, 0, 0, 0);
                          const nextPayoutMidnight = item.nextPayoutDate ? new Date(item.nextPayoutDate) : null;
                          if (nextPayoutMidnight) nextPayoutMidnight.setHours(0, 0, 0, 0);
                          const isDue = !nextPayoutMidnight || nextPayoutMidnight.getTime() <= todayMidnight.getTime();

                          if (isDue) {
                            return (
                              <Button
                                size="sm"
                                onClick={() => setReleaseModalData(item)}
                                className="rounded-xl font-body h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 mx-auto"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                Release
                              </Button>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <CheckCircle className="w-3 h-3 text-blue-600" />
                                Payout Released
                              </span>
                            );
                          }
                        })()
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
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

      {/* Release Payout QR & UPI Modal */}
      {releaseModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setReleaseModalData(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center mb-5">
              <h3 className="text-lg font-heading font-bold text-foreground">Pocket Payout Release</h3>
              <p className="text-xs font-body text-muted-foreground mt-0.5">
                Pay the payout release to the user's UPI address.
              </p>
            </div>

            {fetchingUpi ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
                <p className="text-xs font-body text-muted-foreground">Fetching user KYC UPI details...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center bg-muted/40 p-4 rounded-xl border border-border">
                  <span className="text-xs font-body text-muted-foreground block">PAYOUT AMOUNT</span>
                  <span className="text-2xl font-heading font-black text-emerald-600 block mt-0.5">
                    ₹{fmt(releaseModalData.payoutAmount)}
                  </span>
                  <span className="text-xs font-body text-muted-foreground block mt-1">
                    To: {releaseModalData.userName}
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center py-2">
                  {modalUpiId ? (
                    <div className="rounded-2xl border border-border p-4 bg-white shadow-sm flex flex-col items-center">
                      <QRCodeSVG value={upiLink} size={160} level="M" />
                      <span className="text-[10px] font-body text-muted-foreground mt-2 uppercase tracking-wider font-semibold">
                        Scan to Pay with Any UPI App
                      </span>
                    </div>
                  ) : (
                    <div className="text-center p-4 border border-dashed border-destructive/30 rounded-xl bg-destructive/5 text-destructive">
                      <AlertCircle className="mx-auto h-6 w-6 mb-2" />
                      <p className="text-xs font-body font-semibold">No UPI address registered in user KYC.</p>
                      <p className="text-[10px] font-body mt-1">
                        Please enter their UPI address manually below to generate the QR code.
                      </p>
                    </div>
                  )}
                </div>

                {/* Editable UPI ID Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider block">
                    Recipient UPI ID
                  </label>
                  <input
                    type="text"
                    value={modalUpiId}
                    onChange={(e) => setModalUpiId(e.target.value)}
                    placeholder="Enter UPI ID (e.g. name@upi)..."
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm font-body text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setReleaseModalData(null)}
                    className="rounded-xl font-body"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (releaseModalData.status === 'requested') {
                        handleConfirmReleasePayout(releaseModalData._id, releaseModalData.userName);
                      } else {
                        handleReleasePayout(releaseModalData._id, releaseModalData.userName);
                      }
                    }}
                    disabled={releasingId === releaseModalData._id || !modalUpiId}
                    className="rounded-xl font-body bg-emerald-600 hover:bg-emerald-700"
                  >
                    {releasingId === releaseModalData._id ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    Verify & Release
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
