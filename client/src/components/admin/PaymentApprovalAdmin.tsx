import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  QrCode,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  Check,
  AlertCircle,
  FileText,
  User as UserIcon,
  Phone,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://growvest-mobile.onrender.com");

interface ManualPayment {
  _id: string;
  orderId: string;
  userId: {
    _id: string;
    name?: string;
    username?: string;
    email?: string;
    mobileNumber?: string;
  };
  paymentType: string;
  amount: number;
  payloadData?: any;
  utr: string;
  screenshotUrl?: string;
  userRemarks?: string;
  status: "pending" | "approved" | "rejected";
  adminRemarks?: string;
  reviewedAt?: string;
  submittedAt: string;
  createdAt: string;
}

interface PaymentApprovalAdminProps {
  token: string | null;
  onCountChange?: (count: number) => void;
}

export const PaymentApprovalAdmin = ({ token, onCountChange }: PaymentApprovalAdminProps) => {
  const effectiveToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "settings">("pending");
  const [pendingList, setPendingList] = useState<ManualPayment[]>([]);
  const [historyList, setHistoryList] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Zoomed screenshot modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<ManualPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Company UPI Settings state
  const [upiId, setUpiId] = useState("8925699005@upi");
  const [payeeName, setPayeeName] = useState("Growvest Investments");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  // Canara Bank / Gmail Auto-Approval Settings
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  const [hasGmailPassword, setHasGmailPassword] = useState(false);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) headers["Authorization"] = `Bearer ${effectiveToken}`;
      const res = await fetch(`${API_URL}/api/payment/manual/pending`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPendingList(data.data);
        if (onCountChange) onCountChange(data.data.length);
      }
    } catch (err) {
      console.error("Error fetching pending payments:", err);
    }
  };

  // Fetch all payment history
  const fetchHistory = async () => {
    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) headers["Authorization"] = `Bearer ${effectiveToken}`;
      const res = await fetch(`${API_URL}/api/payment/manual/all`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setHistoryList(data.data);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // Fetch company UPI config
  const fetchUpiConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/payment/manual/config`);
      const data = await res.json();
      if (data.success && data.config) {
        if (data.config.upiId) setUpiId(data.config.upiId);
        if (data.config.payeeName) setPayeeName(data.config.payeeName);
        if (data.config.qrImage) setQrImageUrl(data.config.qrImage);
        if (data.config.gmailUser) setGmailUser(data.config.gmailUser);
        if (data.config.hasGmailPassword) setHasGmailPassword(true);
        if (data.config.autoApprovalEnabled !== undefined) setAutoApprovalEnabled(data.config.autoApprovalEnabled);
      }
    } catch (err) {
      console.error("Error fetching UPI config:", err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchPendingPayments(), fetchHistory(), fetchUpiConfig()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [token]);

  // Handle Approve
  const handleApprove = async (paymentId: string) => {
    setActionLoading(paymentId);
    try {
      const res = await fetch(`${API_URL}/api/payment/manual/${paymentId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setPendingList((prev) => prev.filter((p) => p._id !== paymentId));
        if (onCountChange) onCountChange(pendingList.length - 1);
        fetchHistory();
      } else {
        alert(data.message || "Failed to approve payment");
      }
    } catch (err: any) {
      alert("Error approving payment: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!rejectingItem) return;
    setActionLoading(rejectingItem._id);
    try {
      const res = await fetch(`${API_URL}/api/payment/manual/${rejectingItem._id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingList((prev) => prev.filter((p) => p._id !== rejectingItem._id));
        if (onCountChange) onCountChange(pendingList.length - 1);
        setRejectingItem(null);
        setRejectReason("");
        fetchHistory();
      } else {
        alert(data.message || "Failed to reject payment");
      }
    } catch (err: any) {
      alert("Error rejecting payment: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Save UPI Settings
  const handleSaveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/payment/manual/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          upiId: upiId.trim(),
          payeeName: payeeName.trim(),
          gmailUser: gmailUser.trim(),
          ...(gmailPassword.trim() ? { gmailPassword: gmailPassword.trim() } : {}),
          autoApprovalEnabled,
          ...(qrBase64 ? { qrImageBase64: qrBase64 } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsFeedback("Company UPI details updated successfully!");
        if (data.config?.qrImage) setQrImageUrl(data.config.qrImage);
        setQrBase64(null);
      } else {
        setSettingsFeedback(data.message || "Failed to update UPI settings");
      }
    } catch (err: any) {
      setSettingsFeedback("Error saving settings: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestGmail = async () => {
    setTestingGmail(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/payment/manual/test-gmail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          gmailUser: gmailUser.trim(),
          gmailPassword: gmailPassword.trim(),
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: "Error testing connection: " + err.message });
    } finally {
      setTestingGmail(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const getFullImageUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const formatPaymentType = (type: string) => {
    switch (type) {
      case "investment":
        return "Saving / Fixed Deposit";
      case "chit_join":
        return "Chit Fund Registration";
      case "chit_payment":
        return "Chit Due Installment";
      case "pocket_money":
        return "Pocket Money Plan";
      case "sip_initial":
      case "sip_installment":
        return "SIP Contribution";
      default:
        return type.replace(/_/g, " ").toUpperCase();
    }
  };

  const filteredHistory = historyList.filter((item) => {
    const q = searchQuery.toLowerCase();
    const userName = (item.userId?.name || item.userId?.username || "").toLowerCase();
    const utr = (item.utr || "").toLowerCase();
    const orderId = (item.orderId || "").toLowerCase();
    return userName.includes(q) || utr.includes(q) || orderId.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border/40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Manual UPI Payment Approvals</h2>
            <p className="text-xs font-body text-muted-foreground">
              Review and approve direct UPI payments submitted by users via GPay, PhonePe, and Paytm.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-body transition-all flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Pending
            {pendingList.length > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-body transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            All History
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-body transition-all flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            Company UPI
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={refreshAll}
            disabled={loading}
            className="h-8 w-8 p-0 ml-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── TAB 1: PENDING PAYMENTS ── */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading pending payment verifications...
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border/60">
              <ShieldCheck className="h-12 w-12 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">No Pending Payments!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                All submitted UPI payments have been verified. New user payment requests will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingList.map((payment) => (
                <motion.div
                  key={payment._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* User and Amount Info */}
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Clock className="h-6 w-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-foreground">
                            {payment.userId?.name || payment.userId?.username || "Growvest User"}
                          </h4>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200">
                            {formatPaymentType(payment.paymentType)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {payment.userId?.mobileNumber && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {payment.userId.mobileNumber}
                            </span>
                          )}
                          {payment.userId?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {payment.userId.email}
                            </span>
                          )}
                          <span>
                            Submitted: {new Date(payment.submittedAt || payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Amount & UTR Highlight Box */}
                    <div className="flex items-center gap-4 bg-muted/40 p-3 rounded-xl border border-border/40">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                          Amount to Verify
                        </span>
                        <p className="text-xl font-heading font-extrabold text-emerald-600">
                          ₹{payment.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="border-l border-border/60 pl-3">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                          12-Digit UTR / Ref No
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <code className="text-sm font-mono font-bold text-foreground tracking-wide bg-background px-2 py-0.5 rounded border border-border/60">
                            {payment.utr}
                          </code>
                          <button
                            onClick={() => copyToClipboard(payment.utr)}
                            className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Copy UTR"
                          >
                            {copiedUtr === payment.utr ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Screenshot & Remarks (if provided) */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      {payment.screenshotUrl ? (
                        <button
                          type="button"
                          onClick={() => setZoomedImage(getFullImageUrl(payment.screenshotUrl))}
                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-200"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View Receipt Screenshot
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No screenshot attached</span>
                      )}

                      {payment.userRemarks && (
                        <span className="text-xs text-muted-foreground">
                          Note: "{payment.userRemarks}"
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === payment._id}
                        onClick={() => {
                          setRejectingItem(payment);
                          setRejectReason("");
                        }}
                        className="rounded-xl h-9 px-3 text-xs text-rose-600 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>

                      <Button
                        size="sm"
                        disabled={actionLoading === payment._id}
                        onClick={() => handleApprove(payment._id)}
                        className="rounded-xl h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        {actionLoading === payment._id ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            Approve & Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ALL HISTORY ── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by User Name, UTR, or Order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-border/60 bg-background text-xs font-body focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-body">
                <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">UTR Number</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredHistory.map((item) => (
                    <tr key={item._id} className="hover:bg-muted/20">
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">
                          {item.userId?.name || item.userId?.username || "User"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{item.userId?.mobileNumber || item.userId?.email}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {formatPaymentType(item.paymentType)}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600">
                        ₹{item.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{item.utr}</code>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.screenshotUrl ? (
                          <button
                            onClick={() => setZoomedImage(getFullImageUrl(item.screenshotUrl))}
                            className="text-emerald-600 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <ExternalLink className="h-3 w-3" /> View
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: COMPANY UPI SETTINGS ── */}
      {activeTab === "settings" && (
        <div className="max-w-2xl bg-card border border-border/60 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">Company Receiving UPI Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These details will be shown to users on their mobile payment screen with 1-tap Google Pay, PhonePe, and Paytm buttons.
            </p>
          </div>

          {settingsFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-body">
              {settingsFeedback}
            </div>
          )}

          <form onSubmit={handleSaveUpiSettings} className="space-y-4">
            {/* Canara Bank Auto-Approval Box */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    ⚡ Canara Bank UPI Auto-Approval (Zero Gateway Fees)
                  </h4>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                    Monitors your Canara Bank transaction credit emails to approve payments automatically in 15 seconds.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprovalEnabled}
                    onChange={(e) => setAutoApprovalEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">
                  Gmail Address (Receiving Bank Alerts)
                </label>
                <input
                  type="email"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="e.g. youraccount@gmail.com"
                  className="w-full h-9 px-3 rounded-xl border border-border/60 bg-background text-xs font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  The email address where Canara Bank sends your transaction credit alerts.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-foreground">
                    Google App Password (16 characters)
                  </label>
                  {hasGmailPassword && !gmailPassword && (
                    <span className="text-[10px] text-emerald-600 font-semibold">● Password Configured</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={gmailPassword}
                    onChange={(e) => setGmailPassword(e.target.value)}
                    placeholder={hasGmailPassword ? "Leave blank to keep existing password" : "e.g. abcd efgh ijkl mnop"}
                    className="w-full h-9 pl-3 pr-16 rounded-xl border border-border/60 bg-background text-xs font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-[10px] text-muted-foreground hover:text-foreground font-semibold px-1.5 py-0.5 rounded"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Generated at: <span className="font-mono text-emerald-600">Google Account → Security → 2-Step Verification → App passwords</span>
                </p>
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-body border ${
                    testResult.success
                      ? "bg-emerald-100/60 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-100/60 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestGmail}
                  disabled={testingGmail}
                  className="rounded-xl h-8 px-3 text-[11px] font-bold border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                >
                  {testingGmail ? "Testing Connection..." : "Test Bank Email Connection"}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Receiving UPI ID / VPA <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. 8925699005@upi or growvest@okaxis"
                className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Make sure this UPI ID is linked to your active business bank account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Account Holder / Merchant Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="e.g. Growvest Investments"
                className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Custom QR Code Image <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setQrBase64(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />

              {(qrBase64 || qrImageUrl) && (
                <div className="mt-3 h-32 w-32 rounded-xl overflow-hidden border border-border/80 bg-white p-2">
                  <img
                    src={qrBase64 || getFullImageUrl(qrImageUrl)}
                    alt="Company QR"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={savingSettings}
              className="rounded-xl h-10 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingSettings ? "Saving Settings..." : "Save UPI Settings"}
            </Button>
          </form>
        </div>
      )}

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {rejectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border/60 rounded-2xl p-6 shadow-xl space-y-4"
            >
              <h3 className="text-base font-bold text-foreground">Reject Payment Verification</h3>
              <p className="text-xs text-muted-foreground">
                Provide a reason for rejecting payment of ₹{rejectingItem.amount} (UTR: {rejectingItem.utr}). The user will be notified so they can correct it.
              </p>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. UTR not reflected in company bank account. Please verify your receipt."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-border/60 bg-background text-xs font-body focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingItem(null)}
                  className="rounded-xl h-9 px-4 text-xs font-body"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReject}
                  className="rounded-xl h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Confirm Reject
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoomed Screenshot Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-2xl max-h-[85vh] bg-card rounded-2xl overflow-hidden p-2 border border-border/60 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-2 mb-1">
                <span className="text-xs font-bold text-foreground">Payment Proof Screenshot</span>
                <button
                  onClick={() => setZoomedImage(null)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>
              <img src={zoomedImage} alt="Receipt" className="max-h-[75vh] w-auto mx-auto rounded-xl object-contain" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

