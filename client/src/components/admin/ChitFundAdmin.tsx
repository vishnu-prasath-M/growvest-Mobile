import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Trash2, Edit, 
  Pause, Play, Eye, Plus, Search, Filter, Archive, X, Save, 
  BarChart3, Users, DollarSign, TrendingUp, Activity, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:5000" : "https://growvest-mobile.onrender.com");

interface ChitFundAdminProps {
  token: string | null;
}

const statusStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  active: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  upcoming: "bg-blue-50 text-blue-600 border-blue-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  paused: "bg-orange-50 text-orange-600 border-orange-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-red-50 text-red-600 border-red-200",
  archived: "bg-purple-50 text-purple-600 border-purple-200",
};

const defaultChitForm = {
  name: "",
  description: "",
  monthlyAmount: "",
  totalPot: "",
  duration: "",
  totalMembers: "",
  availableSlots: "",
  processingFee: "2",
  status: "upcoming",
  features: "",
};

export default function ChitFundAdmin({ token }: ChitFundAdminProps) {
  const [subTab, setSubTab] = useState<"dashboard" | "chits" | "joins" | "payments" | "create" | "analytics">("dashboard");
  const [overview, setOverview] = useState<any>({});
  const [chits, setChits] = useState<any[]>([]);
  const [joins, setJoins] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingChit, setEditingChit] = useState<any>(null);
  const [chitForm, setChitForm] = useState(defaultChitForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);

  // ─── Fetch Functions ──────────────────────────────────────────────

  const fetchOverview = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chits/overview`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChits = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chits`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setChits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJoins = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chits/join-requests`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setJoins(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayments = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chits/pending-payments`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chits/overview`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (subTab === "dashboard") fetchOverview();
    if (subTab === "chits") fetchChits();
    if (subTab === "joins") fetchJoins();
    if (subTab === "payments") fetchPayments();
    if (subTab === "analytics") fetchAnalytics();
  }, [subTab, token]);

  // ─── Actions ──────────────────────────────────────────────────────

  const handleAction = async (type: string, id: string, status: string, rejectionReason?: string) => {
    if (!token) return;
    try {
      setLoading(true);
      const url = type === 'payment' 
        ? `${API_URL}/api/chits/payment/${id}/status` 
        : type === 'join' 
          ? `${API_URL}/api/chits/join/${id}/status`
          : `${API_URL}/api/chits/${id}/status`;

      const body: any = { status };
      if (rejectionReason) body.rejectionReason = rejectionReason;

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Action failed');
        return;
      }
      
      if (type === 'payment') fetchPayments();
      if (type === 'join') fetchJoins();
      if (type === 'chit') fetchChits();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChit = async (id: string) => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/chits/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to delete chit");
        return;
      }
      fetchChits();
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the chit");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError("");
    setFormSuccess("");

    try {
      const payload = {
        name: chitForm.name,
        description: chitForm.description,
        monthlyAmount: Number(chitForm.monthlyAmount),
        totalPot: Number(chitForm.totalPot),
        duration: Number(chitForm.duration),
        totalMembers: Number(chitForm.totalMembers),
        availableSlots: Number(chitForm.availableSlots),
        processingFee: Number(chitForm.processingFee),
        status: chitForm.status,
        features: chitForm.features.split(",").map(f => f.trim()).filter(Boolean),
      };

      const res = await fetch(`${API_URL}/api/chits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create chit");
      }

      setFormSuccess("Chit created successfully!");
      setChitForm(defaultChitForm);
      setSubTab("chits");
      fetchChits();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleUpdateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingChit) return;
    setFormError("");
    setFormSuccess("");

    try {
      const payload = {
        name: chitForm.name,
        description: chitForm.description,
        monthlyAmount: Number(chitForm.monthlyAmount),
        totalPot: Number(chitForm.totalPot),
        duration: Number(chitForm.duration),
        totalMembers: Number(chitForm.totalMembers),
        availableSlots: Number(chitForm.availableSlots),
        processingFee: Number(chitForm.processingFee),
        status: chitForm.status,
        features: chitForm.features.split(",").map(f => f.trim()).filter(Boolean),
      };

      const res = await fetch(`${API_URL}/api/chits/${editingChit._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update chit");
      }

      setFormSuccess("Chit updated successfully!");
      setEditingChit(null);
      setChitForm(defaultChitForm);
      setSubTab("chits");
      fetchChits();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const startEdit = (chit: any) => {
    setEditingChit(chit);
    setChitForm({
      name: chit.name || "",
      description: chit.description || "",
      monthlyAmount: String(chit.monthlyAmount || ""),
      totalPot: String(chit.totalPot || ""),
      duration: String(chit.duration || ""),
      totalMembers: String(chit.totalMembers || ""),
      availableSlots: String(chit.availableSlots || ""),
      processingFee: String(chit.processingFee || "2"),
      status: chit.status || "upcoming",
      features: (chit.features || []).join(", "),
    });
    setSubTab("create");
  };

  const handleFormChange = (field: string, value: string) => {
    setChitForm(prev => ({ ...prev, [field]: value }));
  };

  // ─── Filtered Data ─────────────────────────────────────────────────

  const filteredChits = chits.filter(chit => {
    if (statusFilter !== "all" && chit.status !== statusFilter) return false;
    if (searchTerm && !chit.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredJoins = joins.filter(j => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return j.userName?.toLowerCase().includes(q) || j.userEmail?.toLowerCase().includes(q) || j.chitName?.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredPayments = payments.filter(p => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return p.userName?.toLowerCase().includes(q) || p.userEmail?.toLowerCase().includes(q) || p.chitName?.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Tab Navigation with Live Counts */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: "dashboard", label: "Dashboard" },
          { key: "chits", label: `All Chits (${chits.length || overview.totalChits || 0})` },
          { key: "create", label: editingChit ? "Edit Chit" : "Create Chit" },
          { key: "joins", label: `Enrolled Members (${joins.length || overview.totalMembers || 0})` },
          { key: "payments", label: `Pending Payments (${payments.filter((p: any) => p.status === 'pending').length || overview.pendingPayments || 0})` },
          { key: "analytics", label: "Analytics" },
        ].map(tab => (
          <Button 
            key={tab.key} 
            variant={subTab === tab.key ? "default" : "outline"}
            onClick={() => {
              setSubTab(tab.key as any);
              if (tab.key !== "create") {
                setEditingChit(null);
                setChitForm(defaultChitForm);
                setFormError("");
                setFormSuccess("");
              }
            }}
            className="capitalize whitespace-nowrap"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* ─── DASHBOARD ──────────────────────────────────────────────── */}
      {subTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-premium p-4 flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Enrolled</p>
                <p className="text-xl font-bold">{joins.length || overview.totalMembers || 0}</p>
              </div>
            </div>
            <div className="card-premium p-4 flex items-center gap-3">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Chits</p>
                <p className="text-xl font-bold">{overview.activeChits || chits.filter(c => c.status === 'active').length || 0}</p>
              </div>
            </div>
            <div className="card-premium p-4 flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Payments</p>
                <p className="text-xl font-bold">{payments.filter((p: any) => p.status === 'pending').length || overview.pendingPayments || 0}</p>
              </div>
            </div>
            <div className="card-premium p-4 flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Collected</p>
                <p className="text-xl font-bold">₹{(overview.totalCollected || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => { setEditingChit(null); setChitForm(defaultChitForm); setSubTab("create"); }}>
              <Plus className="w-4 h-4 mr-2" /> Create New Chit
            </Button>
            <Button variant="outline" onClick={() => setSubTab("joins")}>
              View Enrolled Members
            </Button>
            <Button variant="outline" onClick={() => setSubTab("payments")}>
              Review Payments ({payments.length})
            </Button>
          </div>
        </div>
      )}

      {/* ─── ALL CHITS ──────────────────────────────────────────────── */}
      {subTab === "chits" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search chits by name..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
            <Button onClick={() => { setEditingChit(null); setChitForm(defaultChitForm); setSubTab("create"); }}>
              <Plus className="w-4 h-4 mr-2" /> New Chit
            </Button>
          </div>

          <div className="space-y-4">
            {filteredChits.map(chit => {
              const isWeekly = chit.isWeekly !== false && chit.paymentFrequency !== 'monthly';
              return (
                <div key={chit._id} className="card-premium p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{chit.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${statusStyle[chit.status] || ''}`}>
                          {chit.status}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${isWeekly ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {isWeekly ? '📅 Weekly (Sunday)' : '🗓️ Monthly'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{chit.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="font-semibold text-emerald-700">
                          {isWeekly 
                            ? `₹${(chit.weeklyAmount || chit.monthlyAmount)?.toLocaleString('en-IN')}/wk` 
                            : `₹${chit.monthlyAmount?.toLocaleString('en-IN')}/mo`}
                        </span>
                        <span>
                          {isWeekly 
                            ? `${chit.totalWeeks || chit.duration} Weeks` 
                            : `${chit.duration} Months`}
                        </span>
                        <span>{chit.totalMembers} Members</span>
                        <span>{chit.availableSlots} Slots Left</span>
                        <span className="font-bold">Pot: ₹{chit.totalPot?.toLocaleString('en-IN')}</span>
                        {isWeekly && (
                          <span className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            Starts & Due Every Sunday
                          </span>
                        )}
                      </div>
                      {chit.features?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {chit.features.map((f: string, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded-full">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(chit)} disabled={loading}>
                        <Edit className="w-4 h-4 mr-1" /> Edit
                      </Button>
                      {chit.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => handleAction('chit', chit._id, 'paused')} disabled={loading}>
                          <Pause className="w-4 h-4 mr-1" /> Pause
                        </Button>
                      )}
                      {chit.status === 'paused' && (
                        <Button size="sm" variant="outline" onClick={() => handleAction('chit', chit._id, 'active')} disabled={loading}>
                          <Play className="w-4 h-4 mr-1" /> Resume
                        </Button>
                      )}
                      {chit.status !== 'completed' && chit.status !== 'closed' && chit.status !== 'archived' && (
                        <Button size="sm" variant="outline" onClick={() => handleAction('chit', chit._id, 'closed')} disabled={loading}>
                          <X className="w-4 h-4 mr-1" /> Close
                        </Button>
                      )}
                      {chit.status !== 'archived' && (
                        <Button size="sm" variant="outline" onClick={() => handleAction('chit', chit._id, 'archived')} disabled={loading}>
                          <Archive className="w-4 h-4 mr-1" /> Archive
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleDeleteChit(chit._id)} disabled={loading}>
                        <Trash2 className="w-4 h-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredChits.length === 0 && <p className="text-muted-foreground p-4">No chits found.</p>}
          </div>
        </div>
      )}

      {/* ─── CREATE / EDIT CHIT ─────────────────────────────────────── */}
      {subTab === "create" && (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6">
            {editingChit ? `Edit Chit: ${editingChit.name}` : "Create New Chit"}
          </h2>

          {formError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{formError}</div>
          )}
          {formSuccess && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{formSuccess}</div>
          )}

          <form onSubmit={editingChit ? handleUpdateChit : handleCreateChit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Selectable Frequency Section */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Chit Frequency *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleFormChange("paymentFrequency", "weekly");
                      if (!chitForm.features) {
                        handleFormChange("features", "Weekly Contribution, Due Every Sunday, Guaranteed Returns");
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      chitForm.paymentFrequency === "weekly"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600 shadow-sm"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">Weekly Chit</span>
                      {chitForm.paymentFrequency === "weekly" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Starts & due every Sunday (e.g. 10w / 20w)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleFormChange("paymentFrequency", "monthly");
                      if (!chitForm.features) {
                        handleFormChange("features", "Monthly Contribution, Due 1st of Month, High Returns");
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      chitForm.paymentFrequency === "monthly"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600 shadow-sm"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">Monthly Chit</span>
                      {chitForm.paymentFrequency === "monthly" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Due monthly on 1st (e.g. 12mo / 24mo)</p>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Chit Name *</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  placeholder={chitForm.paymentFrequency === 'weekly' ? "e.g. ₹500 Weekly Plan – 10 Weeks" : "e.g. ₹2,000 Monthly Plan – 12 Months"}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.description}
                  onChange={(e) => handleFormChange("description", e.target.value)}
                  placeholder="Describe the chit plan..."
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {chitForm.paymentFrequency === 'weekly' ? 'Weekly Amount (₹) *' : 'Monthly Amount (₹) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.amount}
                  onChange={(e) => handleFormChange("amount", e.target.value)}
                  placeholder={chitForm.paymentFrequency === 'weekly' ? "e.g. 500" : "e.g. 2000"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {chitForm.paymentFrequency === 'weekly' ? 'Duration (Weeks) *' : 'Duration (Months) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.duration}
                  onChange={(e) => handleFormChange("duration", e.target.value)}
                  placeholder={chitForm.paymentFrequency === 'weekly' ? "e.g. 10 or 20" : "e.g. 12 or 24"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Total Pot (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg text-sm font-semibold"
                  value={chitForm.totalPot}
                  onChange={(e) => handleFormChange("totalPot", e.target.value)}
                  placeholder="Auto-calculated (Amount × Duration)"
                />
                <span className="text-[11px] text-muted-foreground">Calculated automatically</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Total Members *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.totalMembers}
                  onChange={(e) => handleFormChange("totalMembers", e.target.value)}
                  placeholder="e.g. 100 or 9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Available Slots *</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.availableSlots}
                  onChange={(e) => handleFormChange("availableSlots", e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Processing Fee (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.processingFee}
                  onChange={(e) => handleFormChange("processingFee", e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Features (comma separated)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  value={chitForm.features}
                  onChange={(e) => handleFormChange("features", e.target.value)}
                  placeholder="e.g. Weekly Contribution, Due Every Sunday, High Returns"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <span className="text-base">📅</span>
              <span>
                {chitForm.paymentFrequency === 'weekly' 
                  ? "Rule: Weekly chits start every Sunday. Installments and due dates occur every Sunday." 
                  : "Rule: Monthly chits are due on the 1st of every calendar month."}
              </span>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {editingChit ? "Update Chit" : "Create Chit"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setSubTab("chits"); setEditingChit(null); setChitForm(defaultChitForm); }}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─── JOINED MEMBERS ──────────────────────────────────────────── */}
      {subTab === "joins" && (
        <div>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, or chit..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchJoins} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
          <div className="space-y-4">
            {filteredJoins.map((j: any) => {
              const isActive = j.status === 'active' || j.adminApprovalStatus === 'approved';
              return (
                <div key={j._id} className="card-premium p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold">{j.userName}</h3>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full border bg-green-50 text-green-700 border-green-200">
                          Active Member (Auto-Approved)
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{j.userEmail}{j.userPhone ? ` • ${j.userPhone}` : ''}</p>
                      <p className="text-sm font-semibold mt-2">{j.chitName}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-muted-foreground">Weekly Amount</p>
                          <p className="font-bold">₹{(j.weeklyAmount || 0).toLocaleString('en-IN')}/wk</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-muted-foreground">Total Weeks</p>
                          <p className="font-bold">{j.totalWeeks || 0} Weeks</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-muted-foreground">Total Contribution</p>
                          <p className="font-bold">₹{(j.totalContribution || 0).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-muted-foreground">Week 1 Payment</p>
                          <p className="font-bold text-green-600">₹{(j.weeklyAmount || 0).toLocaleString('en-IN')} Paid</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-muted-foreground">Member #</p>
                          <p className="font-bold">#{j.memberNumber}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="text-muted-foreground">Joined Date</p>
                          <p className="font-bold">{new Date(j.joinedAt).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredJoins.length === 0 && <p className="text-muted-foreground p-4">No joined members recorded yet.</p>}
          </div>
        </div>
      )}

      {/* ─── PENDING PAYMENTS ───────────────────────────────────────── */}
      {subTab === "payments" && (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or chit..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-4">
            {filteredPayments.map(p => (
              <div key={p._id} className="card-premium p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold">{p.userName}</h3>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${statusStyle[p.status] || ''}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.userEmail}</p>
                    <p className="text-sm font-medium mt-1">
                      {p.chitName} • {p.isWeekly || p.totalWeeks > 0 ? 'Week' : 'Month'} {p.month}
                    </p>
                    <p className="text-sm">Amount: ₹{p.amount?.toLocaleString('en-IN')}</p>
                    {p.lateFee > 0 && <p className="text-xs text-amber-600">Late Fee: ₹{p.lateFee}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Submitted: {new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleAction('payment', p._id, 'rejected')} disabled={loading}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => handleAction('payment', p._id, 'paid')} disabled={loading}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filteredPayments.length === 0 && <p className="text-muted-foreground p-4">No pending payments.</p>}
          </div>
        </div>
      )}

      {/* ─── ANALYTICS ──────────────────────────────────────────────── */}
      {subTab === "analytics" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm text-muted-foreground">Total Chits</p>
              </div>
              <p className="text-3xl font-bold">{analytics?.totalChits || 0}</p>
            </div>
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">Active Chits</p>
              </div>
              <p className="text-3xl font-bold">{analytics?.activeChits || 0}</p>
            </div>
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm text-muted-foreground">Active Members</p>
              </div>
              <p className="text-3xl font-bold">{analytics?.totalMembers || 0}</p>
            </div>
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
              </div>
              <p className="text-3xl font-bold text-amber-600">{analytics?.pendingPayments || 0}</p>
            </div>
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-sm text-muted-foreground">Pending Joins</p>
              </div>
              <p className="text-3xl font-bold text-amber-600">{analytics?.pendingJoins || 0}</p>
            </div>
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
              </div>
              <p className="text-3xl font-bold text-green-600">₹{(analytics?.totalCollected || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="card-premium p-5">
            <h3 className="font-bold text-lg mb-4">Chit Fund Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Metric</th>
                    <th className="text-right py-2 px-3">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3">Total Chits Created</td>
                    <td className="text-right py-2 px-3 font-semibold">{analytics?.totalChits || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Active Chits</td>
                    <td className="text-right py-2 px-3 font-semibold">{analytics?.activeChits || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Total Active Members</td>
                    <td className="text-right py-2 px-3 font-semibold">{analytics?.totalMembers || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Pending Join Requests</td>
                    <td className="text-right py-2 px-3 font-semibold text-amber-600">{analytics?.pendingJoins || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Pending Payments</td>
                    <td className="text-right py-2 px-3 font-semibold text-amber-600">{analytics?.pendingPayments || 0}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Total Amount Collected</td>
                    <td className="text-right py-2 px-3 font-semibold text-green-600">₹{(analytics?.totalCollected || 0).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}