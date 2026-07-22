import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  LayoutDashboard,
  ArrowDownToLine,
  Menu,
  X,
  TrendingUp,
  AlertCircle,
  Settings,
  LogOut,
  Shield,
  Plus,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import ZenvestLogo from "@/components/ZenvestLogo";
import { Button } from "@/components/ui/button";
import { generateUPILink } from "@/utils/upi";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import ChitFundAdmin from "@/components/admin/ChitFundAdmin";

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:5000" : "https://growvest-mobile.onrender.com");

/* ─── Mock Data & Types ─────────────────────────── */

type InvStatus = "pending" | "approved" | "rejected";

interface PendingInv {
  _id: string;
  user: string;
  email: string;
  amount: number;
  startDate: string;
  ref: string;
  status: InvStatus;
  type: string;
  interestEarned?: number;
}

interface UserData {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  balance: number;
  role: string;
  totalInvested?: number;
  totalEarnings?: number;
}

const usersData: any[] = []; // Removed static

type WithdrawStatus = "pending" | "approved" | "rejected" | "paid";
interface WithdrawReq {
  id: string;
  user: string;
  amount: string;
  date: string;
  status: WithdrawStatus;
  upi?: string;
  rawAmount?: number;
}

const initialWithdrawals: WithdrawReq[] = []; // Removed static

const statusStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-accent text-accent-foreground border-accent-foreground/10",
  rejected: "bg-red-50 text-red-600 border-red-200",
  Active: "bg-accent text-accent-foreground border-accent-foreground/10",
  New: "bg-blue-50 text-blue-600 border-blue-200",
  withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
  paid: "bg-accent text-accent-foreground border-accent-foreground/10",
};

type AdminTab = "overview" | "pending" | "users" | "withdrawals" | "kyc" | "chits" | "settings";

const AdminDashboard = () => {
  const { user: authUser, token, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingList, setPendingList] = useState<PendingInv[]>([]);
  const [payModalData, setPayModalData] = useState<WithdrawReq | null>(null);
  const [withdrawList, setWithdrawList] = useState<WithdrawReq[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<Record<string, any>>({});

  // Navigation items with state for badges
  const [navItems, setNavItems] = useState<{ label: string; tab: AdminTab; icon: React.ElementType; badge?: number }[]>([
    { label: "Overview", tab: "overview", icon: LayoutDashboard },
    { label: "Pending Investments", tab: "pending", icon: Clock, badge: 3 },
    { label: "Users", tab: "users", icon: Users },
    { label: "Withdrawals", tab: "withdrawals", icon: ArrowDownToLine, badge: 2 },
    { label: "KYC Verification", tab: "kyc", icon: Shield, badge: 0 },
    { label: "Chit Funds", tab: "chits", icon: TrendingUp },
    { label: "Settings", tab: "settings", icon: Settings },
  ]);

  // KYC State
  const [kycList, setKycList] = useState<any[]>([]);
  const [kycFilter, setKycFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedKYC, setSelectedKYC] = useState<any>(null);
  const [kycModalOpen, setKycModalOpen] = useState(false);

  // Chit Fund State
  const [chits, setChits] = useState<any[]>([]);
  const [chitModalOpen, setChitModalOpen] = useState(false);
  const [editingChit, setEditingChit] = useState<any>(null);
  const [chitForm, setChitForm] = useState({
    name: '',
    description: '',
    monthlyAmount: '',
    totalMembers: '',
    duration: '',
    prizeAmount: '',
    startDate: '',
    processingFee: '2',
  });

  // Dashboard Stats State
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  useEffect(() => {
    if (authUser && authUser.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [authUser, navigate]);

  // Prevent background scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [sidebarOpen]);
  useEffect(() => {
    if (!token) return;

    const fetchAll = () => {
      // Fetch Dashboard Stats
      fetch(`${API_URL}/api/dashboard/admin-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setDashboardStats(data);
        })
        .catch(err => console.error("Error fetching dashboard stats:", err));

      // Fetch Withdrawals
      fetch(`${API_URL}/api/withdrawals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setWithdrawList(data.map((w: any) => ({
              id: w?._id || "unknown",
              user: w?.userName || "Unknown",
              amount: `₹${(w?.amount || 0).toLocaleString("en-IN")}`,
              rawAmount: w?.amount || 0,
              date: w?.date || "",
              status: w?.status || "pending",
              upi: w?.upiId || ""
            })));
          }
        })
        .catch(err => console.error("Error fetching withdrawals:", err));

      // Fetch Investments
      fetch(`${API_URL}/api/investments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPendingList(data.map((inv: any) => ({
              _id: inv?._id || "unknown",
              user: inv?.userName || "Unknown User",
              email: inv?.userEmail || "user@example.com",
              amount: inv?.amount || 0,
              startDate: inv?.startDate || new Date().toISOString(),
              ref: inv?.ref || "REF-ERROR",
              status: inv?.status || "pending",
              type: inv?.type || "saving",
              interestEarned: inv?.interestEarned || 0
            })));
          }
        })
        .catch(err => console.error("Error fetching investments:", err));

      // Fetch Users
      fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAllUsers(data);
          }
        })
        .catch(err => console.error("Error fetching users:", err));

      // Fetch KYC List
      fetch(`${API_URL}/api/kyc/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setKycList(data);
            // Update badge for KYC tab
            const pendingCount = data.filter((k: any) => k.status === 'pending').length;
            setNavItems(prev => prev.map(item =>
              item.tab === 'kyc' ? { ...item, badge: pendingCount } : item
            ));
          }
        })
        .catch(err => console.error("Error fetching KYC list:", err));

      // Fetch Chits & Pending Chit Actions for badge
      Promise.all([
        fetch(`${API_URL}/api/chits`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
        fetch(`${API_URL}/api/chits/join-requests`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).catch(() => []),
        fetch(`${API_URL}/api/chits/pending-payments`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).catch(() => []),
      ])
        .then(([chitsData, joinReqs, payReqs]) => {
          if (Array.isArray(chitsData)) {
            setChits(chitsData);
          }
          const pendingJoinsCount = Array.isArray(joinReqs) ? joinReqs.filter((r: any) => r.status === 'pending').length : 0;
          const pendingPaysCount = Array.isArray(payReqs) ? payReqs.filter((r: any) => r.status === 'pending').length : 0;
          const totalChitPending = pendingJoinsCount + pendingPaysCount;

          setNavItems(prev => prev.map(item =>
            item.tab === 'chits' ? { ...item, badge: totalChitPending } : item
          ));
        })
        .catch(err => console.error("Error fetching chits data:", err));
    };

    fetchAll();
  }, [token, activeTab]);

  // Combined user fetch logic above in fetchAll

  const handleInvestAction = async (id: string, action: "approved" | "rejected" | "pending") => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/investments/${id}/status`, {

        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setPendingList((prev) =>
          prev.map((inv) => (inv._id === id ? { ...inv, status: action } : inv))
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleWithdrawAction = async (id: string, action: "approved" | "rejected") => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/withdrawals/${id}/status`, {

        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setWithdrawList((prev) =>
          prev.map((w) => (w.id === id ? { ...w, status: action } : w))
        );
      }
    } catch (error) {
      console.error("Error updating withdrawal status:", error);
    }
  };

  // KYC Handlers
  const handleKYCAction = async (kycId: string, action: "approved" | "rejected", reason?: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/kyc/${kycId}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: action, rejectionReason: reason }),
      });
      if (res.ok) {
        setKycList(prev => prev.map(k =>
          k._id === kycId ? { ...k, status: action, rejectionReason: reason } : k
        ));
        setKycModalOpen(false);
        setSelectedKYC(null);
        // Refresh KYC list to update badge
        fetch(`${API_URL}/api/kyc/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setKycList(data);
              const pendingCount = data.filter((k: any) => k.status === 'pending').length;
              setNavItems(prev => prev.map(item =>
                item.tab === 'kyc' ? { ...item, badge: pendingCount } : item
              ));
            }
          });
      }
    } catch (error) {
      console.error("Error updating KYC status:", error);
    }
  };

  const handleViewKYC = (kyc: any) => {
    setSelectedKYC(kyc);
    setKycModalOpen(true);
  };

  // Chit Fund Handlers
  const handleCreateChit = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/chits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...chitForm,
          monthlyAmount: parseFloat(chitForm.monthlyAmount),
          totalMembers: parseInt(chitForm.totalMembers),
          duration: parseInt(chitForm.duration),
          prizeAmount: parseFloat(chitForm.prizeAmount),
          processingFee: parseFloat(chitForm.processingFee),
          availableSlots: parseInt(chitForm.totalMembers),
          status: 'upcoming',
        }),
      });
      if (res.ok) {
        const newChit = await res.json();
        setChits(prev => [...prev, newChit]);
        setChitModalOpen(false);
        setChitForm({
          name: '',
          description: '',
          monthlyAmount: '',
          totalMembers: '',
          duration: '',
          prizeAmount: '',
          startDate: '',
          processingFee: '2',
        });
      }
    } catch (error) {
      console.error("Error creating chit:", error);
    }
  };

  const handleEditChit = async (chit: any) => {
    setEditingChit(chit);
    setChitForm({
      name: chit.name,
      description: chit.description,
      monthlyAmount: chit.monthlyAmount.toString(),
      totalMembers: chit.totalMembers.toString(),
      duration: chit.duration.toString(),
      prizeAmount: chit.prizeAmount.toString(),
      startDate: chit.startDate ? new Date(chit.startDate).toISOString().split('T')[0] : '',
      processingFee: chit.processingFee?.toString() || '2',
    });
    setChitModalOpen(true);
  };

  const handleUpdateChit = async () => {
    if (!token || !editingChit) return;

    try {
      const res = await fetch(`${API_URL}/api/chits/${editingChit._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...chitForm,
          monthlyAmount: parseFloat(chitForm.monthlyAmount),
          totalMembers: parseInt(chitForm.totalMembers),
          duration: parseInt(chitForm.duration),
          prizeAmount: parseFloat(chitForm.prizeAmount),
          processingFee: parseFloat(chitForm.processingFee),
        }),
      });
      if (res.ok) {
        const updatedChit = await res.json();
        setChits(prev => prev.map(c => c._id === editingChit._id ? updatedChit : c));
        setChitModalOpen(false);
        setEditingChit(null);
        setChitForm({
          name: '',
          description: '',
          monthlyAmount: '',
          totalMembers: '',
          duration: '',
          prizeAmount: '',
          startDate: '',
          processingFee: '2',
        });
      }
    } catch (error) {
      console.error("Error updating chit:", error);
    }
  };

  const handleDeleteChit = async (chitId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this chit fund?")) return;

    try {
      const res = await fetch(`${API_URL}/api/chits/${chitId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });
      const data = await res.json();
      
      if (res.ok) {
        setChits(prev => prev.filter(c => c._id !== chitId));
        alert("Chit deleted successfully.");
      } else {
        alert(data.message || "Failed to delete chit.");
      }
    } catch (error) {
      console.error("Error deleting chit:", error);
      alert("Error deleting chit. Please try again.");
    }
  };

  const handleActivateChit = async (chitId: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/chits/${chitId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'active' }),
      });
      if (res.ok) {
        setChits(prev => prev.map(c => c._id === chitId ? { ...c, status: 'active' } : c));
      }
    } catch (error) {
      console.error("Error activating chit:", error);
    }
  };

  const handleCloseChit = async (chitId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to close this chit fund?")) return;

    try {
      const res = await fetch(`${API_URL}/api/chits/${chitId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'closed' }),
      });
      if (res.ok) {
        setChits(prev => prev.map(c => c._id === chitId ? { ...c, status: 'closed' } : c));
      }
    } catch (error) {
      console.error("Error closing chit:", error);
    }
  };

  const pendingCount = pendingList.filter((i) => i.status === "pending").length;
  const wdPendingCount = withdrawList.filter((w) => w.status === "pending").length;

  // Total Payable Balance = SUM of all users' current balance field from DB
  // This works immediately using already-fetched allUsers data
  const totalPayableBalance = allUsers
    .filter(u => u.role !== 'admin')
    .reduce((acc, u) => acc + (u.balance || 0), 0);
  const totalPayableStr = `₹${totalPayableBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Total interest earned by ALL users (Feature 3 Fix)
  const totalInterestEarned = allUsers
    .filter(u => u.role !== 'admin')
    .reduce((acc, curr) => acc + (curr?.totalEarnings || 0), 0);
  const totalReturnsStr = `₹${totalInterestEarned.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const dynamicUsersData = allUsers.map(u => ({
    id: u._id,
    name: u.name,
    email: u.email,
    joined: new Date(u.createdAt).toLocaleDateString(),
    invested: `₹${(pendingList.filter(inv => inv.email === u.email && inv.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString("en-IN")}`,
    balance: `₹${Math.round(u.balance || 0).toLocaleString("en-IN")}`,
    status: u.role === 'admin' ? "Admin" : "Active"
  }));

  // Fetch user detail on expand (lazy load, cached)
  const handleExpandUser = async (userId: string, email: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (userDetails[userId]) return; // already loaded
    try {
      const res = await fetch(`${API_URL}/api/users/detail/${encodeURIComponent(email)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserDetails(prev => ({ ...prev, [userId]: data }));
      }
    } catch (err) {
      console.error('Error fetching user detail:', err);
    }
  };

  const uniqueUsersCount = allUsers.length || 0;

  // Use real dashboard stats from MongoDB
  const overviewCards = dashboardStats ? [
    {
      label: "Total Users",
      value: dashboardStats.totalUsers || 0,
      sub: "Registered investors",
      icon: Users,
      color: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Total Investments",
      value: dashboardStats.totalInvestments || 0,
      sub: `${dashboardStats.pendingInvestments || 0} pending`,
      icon: DollarSign,
      color: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      label: "Total Revenue",
      value: `₹${(dashboardStats.revenue || 0).toLocaleString("en-IN")}`,
      sub: "From approved investments",
      icon: TrendingUp,
      color: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      label: "Pending Actions",
      value: (dashboardStats.pendingInvestments || 0) + (dashboardStats.pendingWithdrawals || 0) + (dashboardStats.pendingKYC || 0),
      sub: `${dashboardStats.pendingKYC || 0} KYC, ${dashboardStats.pendingWithdrawals || 0} withdrawals`,
      icon: Clock,
      color: "bg-amber-50",
      iconColor: "text-amber-600",
    },
  ] : [
    { label: "Total Users", value: 0, sub: "Loading...", icon: Users, color: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Total Investments", value: 0, sub: "Loading...", icon: DollarSign, color: "bg-green-50", iconColor: "text-green-600" },
    { label: "Total Revenue", value: "₹0", sub: "Loading...", icon: TrendingUp, color: "bg-purple-50", iconColor: "text-purple-600" },
    { label: "Pending Actions", value: 0, sub: "Loading...", icon: Clock, color: "bg-amber-50", iconColor: "text-amber-600" },
  ];

  return (
    <div className="min-h-screen flex bg-background overflow-x-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-300 flex flex-col lg:translate-x-0 lg:static lg:flex ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="max-w-[140px] overflow-hidden">
            <ZenvestLogo />
          </div>
          <button
            className="lg:hidden p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Admin badge */}
        <div className="mx-4 mt-4 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs font-body font-semibold text-primary">Admin Panel</span>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const badge = item.tab === "pending" ? pendingCount : item.tab === "withdrawals" ? wdPendingCount : 0;
            return (
              <button
                key={item.tab}
                onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-body font-medium transition-colors ${activeTab === item.tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                {badge > 0 && (
                  <span
                    className={`h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${activeTab === item.tab ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                      }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto sticky bottom-0 p-4 border-t border-border bg-card space-y-2">
          <Link to="/">
            <Button variant="outline" size="sm" className="w-full rounded-xl font-body">
              Back to Site
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-xl font-body text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center justify-center gap-2"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center h-16 px-4 sm:px-6 border-b border-border bg-card/95 backdrop-blur justify-between w-full">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden w-10 h-10 flex items-center justify-center text-foreground rounded-lg hover:bg-muted"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-body text-muted-foreground hidden sm:block">Growvest Admin</p>
              <h1 className="font-heading font-bold text-foreground capitalize text-base sm:text-lg leading-tight">
                {activeTab === "pending" ? "Pending" : activeTab === "settings" ? "Admin Dashboard" : activeTab}
              </h1>
            </div>
          </div>

          {(pendingCount + wdPendingCount) > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-body font-semibold text-amber-700">
                {pendingCount + wdPendingCount} pending
              </span>
            </div>
          )}
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-full overflow-hidden w-full min-w-0">
          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {overviewCards.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <motion.div
                      key={c.label}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="card-premium p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-body text-muted-foreground leading-tight">{c.label}</span>
                        <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-xl ${c.color} flex items-center justify-center`}>
                          <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${c.iconColor}`} />
                        </div>
                      </div>
                      <p className="text-xl sm:text-2xl font-heading font-bold text-foreground">{c.value}</p>
                      <p className="text-xs font-body text-muted-foreground mt-1">{c.sub}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pending actions alert */}
              {pendingCount > 0 && (
                <div
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => setActiveTab("pending")}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-body font-semibold text-amber-800">
                        {pendingCount} investment{pendingCount > 1 ? "s" : ""} awaiting your approval
                      </p>
                      <p className="text-xs font-body text-amber-600 mt-0.5">
                        Click to review and approve or reject
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="rounded-xl font-body bg-amber-600 hover:bg-amber-700 w-full sm:w-auto">
                    Review Now
                  </Button>
                </div>
              )}

              {/* Recent activity */}
              <div className="card-premium overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
                  <h2 className="font-heading font-semibold text-foreground text-base sm:text-lg">Recent Investments</h2>
                </div>
                <div className="divide-y divide-border">
                  {pendingList.slice(0, 5).map((inv) => (
                    <div key={inv._id} className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center ${inv.status === "approved" ? "bg-accent" : inv.status === "pending" ? "bg-amber-50" : "bg-red-50"
                            }`}
                        >
                          {inv.status === "approved" && <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />}
                          {inv.status === "pending" && <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />}
                          {inv.status === "rejected" && <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-body font-semibold text-foreground">{inv.user} <span className="opacity-50 font-normal">({inv.type} deposit)</span></p>
                          <p className="text-xs font-body text-muted-foreground">{inv.ref} · {new Date(inv.startDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-body font-bold text-foreground">₹{inv.amount.toLocaleString("en-IN")}</p>
                        <span className={`text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border ${statusStyle[inv.status]}`}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── PENDING INVESTMENTS ── */}
          {activeTab === "pending" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-6">
                <h2 className="font-heading text-2xl text-foreground">Pending Investments</h2>
                <p className="text-sm font-body text-muted-foreground mt-0.5">
                  Review each investment and approve or reject based on payment verification.
                </p>
              </div>

              {/* Pending items as cards */}
              <div className="space-y-4">
                {pendingList.map((inv) => (
                  <motion.div
                    key={inv._id}
                    layout
                    className="card-premium p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${inv.status === "approved" ? "bg-accent" : inv.status === "pending" ? "bg-amber-50" : "bg-red-50"
                            }`}
                        >
                          {inv.status === "approved" && <CheckCircle className="h-5 w-5 text-secondary" />}
                          {inv.status === "pending" && <Clock className="h-5 w-5 text-amber-600" />}
                          {inv.status === "rejected" && <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-sm font-body font-bold text-foreground">{inv.user}</p>
                            <span className={`text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border ${statusStyle[inv.status]}`}>
                              {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                            </span>
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full capitalize">{inv.type} deposit</span>
                          </div>
                          <p className="text-xs font-body text-muted-foreground mt-0.5">{inv.email}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-2">
                            <div>
                              <span className="text-[10px] font-body text-muted-foreground">Amount</span>
                              <p className="text-lg font-heading font-bold text-foreground">₹{inv.amount.toLocaleString("en-IN")}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-body text-muted-foreground">Date</span>
                              <p className="text-sm font-body font-medium text-foreground">{new Date(inv.startDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-body text-muted-foreground">Reference</span>
                              <p className="text-sm font-body font-medium text-foreground">{inv.ref}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {inv.status === "pending" ? (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-10 px-4"
                            onClick={() => handleInvestAction(inv._id, "rejected")}
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl font-body h-10 px-4"
                            onClick={() => handleInvestAction(inv._id, "approved")}
                          >
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <div className="shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl font-body text-muted-foreground h-10 text-xs"
                            onClick={() => handleInvestAction(inv._id, "pending")}
                          >
                            Undo
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── USERS ── */}
          {activeTab === "users" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-6">
                <h2 className="font-heading text-2xl text-foreground">All Users</h2>
                <p className="text-sm font-body text-muted-foreground mt-0.5">
                  {dynamicUsersData.length} registered investors · Click a user to view details
                </p>
              </div>
              <div className="space-y-3">
                {dynamicUsersData.map((u) => {
                  const isExpanded = expandedUserId === u.id;
                  const detail = userDetails[u.id];
                  const fmtCur = (v: number) => v?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00";
                  return (
                    <motion.div key={u.id} layout className="card-premium overflow-hidden">
                      {/* Row (clickable) */}
                      <button
                        onClick={() => handleExpandUser(u.id, u.email)}
                        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-heading font-bold text-primary shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-body font-semibold text-foreground truncate">{u.name}</p>
                            <p className="text-xs font-body text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                          <div>
                            <p className="text-[10px] font-body text-muted-foreground">Balance</p>
                            <p className="text-sm font-body font-bold text-secondary">{u.balance}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-body text-muted-foreground">Joined</p>
                            <p className="text-xs font-body text-foreground">{u.joined}</p>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-body font-medium border ${statusStyle[u.status]}`}>
                            {u.status}
                          </span>
                        </div>
                        <div className={`shrink-0 ml-2 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border px-4 sm:px-6 py-5 bg-accent/30">
                              {!detail ? (
                                <div className="flex items-center gap-3 py-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                  <p className="text-sm font-body text-muted-foreground">Loading user details...</p>
                                </div>
                              ) : (
                                <>
                                  {/* Summary row */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                                    {[
                                      { label: "Current Balance", value: `₹${fmtCur(detail.currentBalance)}`, color: "text-primary" },
                                      { label: "Total Invested", value: `₹${fmtCur(detail.totalInvested)}`, color: "text-foreground" },
                                      { label: "Total Earnings", value: `₹${fmtCur(detail.totalEarnings)}`, color: "text-secondary" },
                                      { label: "Email", value: u.email, color: "text-muted-foreground" },
                                    ].map((s) => (
                                      <div key={s.label}>
                                        <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                                        <p className={`text-sm font-body font-bold ${s.color} break-all`}>{s.value}</p>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Deposit type breakdown */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Saving */}
                                    <div className="rounded-xl border border-border bg-card p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Saving Deposit</p>
                                        <span className="text-xs font-body font-bold text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-full">12% / yr</span>
                                      </div>
                                      <div className="space-y-2">
                                        {[
                                          { label: "Invested", value: `₹${fmtCur(detail.saving?.invested ?? 0)}` },
                                          { label: "Interest Earned", value: `₹${fmtCur(detail.saving?.interest ?? 0)}` },
                                          { label: "Withdrawn", value: `₹${fmtCur(detail.saving?.withdrawn ?? 0)}` },
                                          { label: "Current Balance", value: `₹${fmtCur(detail.saving?.balance ?? 0)}`, bold: true },
                                        ].map(r => (
                                          <div key={r.label} className="flex justify-between text-xs font-body">
                                            <span className="text-muted-foreground">{r.label}</span>
                                            <span className={r.bold ? "font-bold text-secondary" : "text-foreground"}>{r.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Fixed */}
                                    <div className="rounded-xl border border-border bg-card p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Fixed Deposit</p>
                                        <span className="text-xs font-body font-bold text-secondary bg-secondary/5 border border-secondary/10 px-2 py-0.5 rounded-full">24% / yr</span>
                                      </div>
                                      <div className="space-y-2">
                                        {[
                                          { label: "Invested", value: `₹${fmtCur(detail.fixed?.invested ?? 0)}` },
                                          { label: "Interest Earned", value: `₹${fmtCur(detail.fixed?.interest ?? 0)}` },
                                          { label: "Withdrawn", value: `₹${fmtCur(detail.fixed?.withdrawn ?? 0)}` },
                                          { label: "Current Balance", value: `₹${fmtCur(detail.fixed?.balance ?? 0)}`, bold: true },
                                        ].map(r => (
                                          <div key={r.label} className="flex justify-between text-xs font-body">
                                            <span className="text-muted-foreground">{r.label}</span>
                                            <span className={r.bold ? "font-bold text-secondary" : "text-foreground"}>{r.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── WITHDRAWALS ── */}
          {activeTab === "withdrawals" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-6">
                <h2 className="font-heading text-2xl text-foreground">Withdrawal Requests</h2>
                <p className="text-sm font-body text-muted-foreground mt-0.5">
                  Review and process withdrawal requests from investors.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {withdrawList.map((w) => (
                  <motion.div key={w.id} layout className="card-premium p-4 w-full max-w-full overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${w.status === "approved" ? "bg-accent" : w.status === "pending" ? "bg-amber-50" : "bg-red-50"
                            }`}
                        >
                          {w.status === "approved" && <CheckCircle className="h-5 w-5 text-secondary" />}
                          {w.status === "pending" && <ArrowDownToLine className="h-5 w-5 text-amber-600" />}
                          {w.status === "rejected" && <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-body font-bold text-foreground break-words">{w.user}</p>
                            <span className={`text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border ${statusStyle[w.status]}`}>
                              {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                            </span>
                            {w.status === "pending" && w.upi && (
                              <span className="text-[10px] font-body font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground break-all">
                                UPI: {w.upi}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <div className="min-w-0">
                              <p className="text-[10px] font-body text-muted-foreground">Amount</p>
                              <p className="text-base font-heading font-bold text-destructive">{w.amount}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-body text-muted-foreground">Date</p>
                              <p className="text-xs font-body font-medium text-foreground">{w.date}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {w.status === "pending" ? (
                        <div className="flex gap-2 shrink-0 mt-3 sm:mt-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50 h-10 px-4"
                            onClick={() => handleWithdrawAction(w.id, "rejected")}
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl font-body h-10 px-5 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => setPayModalData(w)}
                          >
                            <DollarSign className="mr-1.5 h-3.5 w-3.5 text-white" />
                            Pay
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-3 items-center">
                          <span className="text-xs font-body font-bold text-green-600 px-3 py-1.5 bg-green-50 rounded-xl border border-green-200">
                            Paid
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── KYC VERIFICATION ── */}
          {activeTab === "kyc" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-6">
                <h2 className="font-heading text-2xl text-foreground">KYC Verification</h2>
                <p className="text-sm font-body text-muted-foreground mt-0.5">
                  Review and verify user KYC submissions
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 mb-6">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setKycFilter(filter)}
                    className={`px-4 py-2 rounded-xl text-sm font-body font-medium transition-colors ${kycFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>

              {/* KYC List */}
              <div className="space-y-4">
                {kycList
                  .filter(k => kycFilter === 'all' || k.status === kycFilter)
                  .map((kyc) => (
                    <motion.div
                      key={kyc._id}
                      layout
                      className="card-premium p-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${kyc.status === 'approved' ? 'bg-accent' :
                              kyc.status === 'pending' ? 'bg-amber-50' : 'bg-red-50'
                              }`}
                          >
                            {kyc.status === 'approved' && <CheckCircle className="h-5 w-5 text-secondary" />}
                            {kyc.status === 'pending' && <Clock className="h-5 w-5 text-amber-600" />}
                            {kyc.status === 'rejected' && <XCircle className="h-5 w-5 text-red-500" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <p className="text-sm font-body font-bold text-foreground">{kyc.fullName}</p>
                              <span className={`text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border ${statusStyle[kyc.status]}`}>
                                {kyc.status.charAt(0).toUpperCase() + kyc.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-xs font-body text-muted-foreground mt-0.5">
                              {kyc.aadhaarNumber} • {kyc.panNumber}
                            </p>
                            <p className="text-xs font-body text-muted-foreground">
                              Submitted: {new Date(kyc.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl font-body h-10 px-4"
                            onClick={() => handleViewKYC(kyc)}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            View
                          </Button>
                          {kyc.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50 h-10 px-4"
                                onClick={() => {
                                  const reason = prompt("Enter rejection reason (optional):");
                                  handleKYCAction(kyc._id, 'rejected', reason || undefined);
                                }}
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-xl font-body h-10 px-4"
                                onClick={() => handleKYCAction(kyc._id, 'approved')}
                              >
                                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                Approve
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                {kycList.filter(k => kycFilter === 'all' || k.status === kycFilter).length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm font-body text-muted-foreground">No KYC submissions found</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── CHIT FUNDS ── */}
          {activeTab === "chits" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <ChitFundAdmin token={token} />
            </motion.div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === "settings" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-3xl mx-auto px-4 w-full flex flex-col items-center justify-center"
            >
              <div className="mb-8 w-full">
                <h2 className="font-heading text-3xl font-bold text-foreground text-center">Admin Settings</h2>
                <p className="text-sm font-body text-muted-foreground mt-2 text-center">
                  Manage your security preferences and payment details
                </p>
              </div>

              <div className="w-full flex flex-col md:flex-row justify-center gap-6">
                {/* Password Change Section */}
                <div className="card-premium p-6 sm:p-8 flex flex-col h-full w-full">
                  <div className="mb-6">
                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center mb-4">
                      <Settings className="h-5 w-5 text-secondary" />
                    </div>
                    <h3 className="font-heading text-xl font-bold text-foreground">Security</h3>
                    <p className="text-xs font-body text-muted-foreground mt-1">Update your admin password</p>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="space-y-2">
                      <label className="text-sm font-body font-semibold text-foreground">Current Password</label>
                      <input
                        type="password"
                        className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-body font-semibold text-foreground">New Password</label>
                      <input
                        type="password"
                        className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <Button className="w-full rounded-xl font-body font-medium h-12 mt-6">
                    Update Password
                  </Button>
                </div>

                {/* UPI ID Update Section */}
                <div className="card-premium p-6 sm:p-8 flex flex-col h-full w-full">
                  <div className="mb-6">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="font-heading text-xl font-bold text-foreground">Payment Details</h3>
                    <p className="text-xs font-body text-muted-foreground mt-1">Update your receiving UPI ID</p>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="space-y-2">
                      <label className="text-sm font-body font-semibold text-foreground">Active UPI ID</label>
                      <input
                        type="text"
                        className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        placeholder="example@upi"
                        defaultValue="7418662750@ibl"
                      />
                      <p className="text-[10px] font-body text-muted-foreground mt-2 leading-relaxed">
                        This UPI ID will be shown to users when they initiate a manual deposit via QR code.
                      </p>
                    </div>
                  </div>

                  <Button className="w-full rounded-xl font-body font-medium h-12 mt-6">
                    Save UPI ID
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Pay Modal */}
      {payModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setPayModalData(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
            <div className="mb-6">
              <h2 className="text-xl font-heading font-bold text-foreground">Complete Payment</h2>
              <p className="text-sm font-body text-muted-foreground mt-2">
                Send the requested amount to the user's UPI below.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center mb-6 gap-4">
              {(() => {
                try {
                  // Validate data before generating QR
                  if (!payModalData.upi || !payModalData.rawAmount || payModalData.rawAmount <= 0) {
                    return (
                      <div className="w-[150px] h-[150px] rounded-xl border border-border bg-muted flex items-center justify-center">
                        <p className="text-xs font-body text-muted-foreground text-center px-2">
                          Invalid payment data
                        </p>
                      </div>
                    );
                  }

                  // Generate UPI link using utility function
                  const upiLink = generateUPILink(
                    payModalData.upi,
                    payModalData.rawAmount,
                    `WD-${payModalData.id}`,
                    'Zenvest'
                  );

                  return (
                    <div className="flex flex-col items-center gap-4">
                      <div id="qr-download-area" className="rounded-2xl border-2 border-border p-4 bg-white shadow-card">
                        <QRCodeSVG
                          value={upiLink}
                          size={180}
                          bgColor="#ffffff"
                          fgColor="#000000"
                          level="H"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 rounded-xl font-body text-xs flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5"
                        onClick={() => {
                          const svg = document.querySelector("#qr-download-area svg") as SVGElement;
                          if (!svg) return;

                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement("canvas");
                          const ctx = canvas.getContext("2d");
                          const img = new Image();

                          img.onload = () => {
                            canvas.width = img.width * 2; // Higher quality
                            canvas.height = img.height * 2;
                            if (ctx) {
                              ctx.fillStyle = "#ffffff";
                              ctx.fillRect(0, 0, canvas.width, canvas.height);
                              ctx.scale(2, 2);
                              ctx.drawImage(img, 0, 0);
                            }

                            const pngFile = canvas.toDataURL("image/png");
                            const downloadLink = document.createElement("a");
                            downloadLink.download = `Zenvest-QR-${payModalData.id}.png`;
                            downloadLink.href = pngFile;
                            downloadLink.click();
                          };

                          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                        }}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Download QR
                      </Button>
                      <p className="text-sm font-body font-medium text-primary">
                        Scan this QR using any UPI app to pay
                      </p>
                      <p className="text-xs font-body text-muted-foreground">
                        Amount: ₹{payModalData.rawAmount.toLocaleString("en-IN")} · Ref: WD-{payModalData.id}
                      </p>
                    </div>
                  );
                } catch (error) {
                  return (
                    <div className="w-[150px] h-[150px] rounded-xl border border-border bg-muted flex items-center justify-center">
                      <p className="text-xs font-body text-muted-foreground text-center px-2">
                        Error generating QR
                      </p>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-body font-semibold text-muted-foreground">UPI ID</label>
                <div className="p-3 bg-muted rounded-xl text-sm font-body text-foreground font-medium flex items-center justify-between">
                  {payModalData.upi || "None provided"}
                </div>
              </div>
              <div>
                <label className="text-xs font-body font-semibold text-muted-foreground">Amount</label>
                <div className="p-3 bg-muted rounded-xl text-lg font-heading text-destructive font-bold">
                  {payModalData.amount.startsWith('₹') ? payModalData.amount : `₹${payModalData.amount}`}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="w-full rounded-xl font-body"
                onClick={() => setPayModalData(null)}
              >
                Cancel
              </Button>
              <Button
                className="w-full rounded-xl font-body bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  // Update withdrawal status to 'paid' with timestamp
                  try {
                    const res = await fetch(`${API_URL}/api/withdrawals/${payModalData.id}/status`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        status: 'paid',
                        paidAt: new Date().toISOString()
                      })
                    });
                    if (res.ok) {
                      setWithdrawList(prev =>
                        prev.map((w) => (w.id === payModalData.id ? { ...w, status: 'paid' } : w))
                      );
                      setPayModalData(null);
                    }
                  } catch (error) {
                    console.error('Error updating withdrawal status:', error);
                  }
                  setPayModalData(null);
                }}
              >
                Mark as Paid
              </Button>
            </div>
          </div>
        </div>
      )}





      {/* KYC Detail Modal */}
      {kycModalOpen && selectedKYC && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 shadow-xl relative animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setKycModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
            <div className="mb-6">
              <h2 className="text-xl font-heading font-bold text-foreground">KYC Details</h2>
              <p className="text-sm font-body text-muted-foreground mt-2">
                {selectedKYC.fullName}
              </p>
            </div>

            <div className="space-y-6">
              {/* Personal Details */}
              <div>
                <h3 className="text-sm font-body font-semibold text-foreground mb-3">Personal Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Full Name</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.fullName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Date of Birth</p>
                    <p className="text-sm font-body font-medium text-foreground">
                      {selectedKYC.dob ? new Date(selectedKYC.dob).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Gender</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Father/Husband Name</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.fatherOrHusbandName || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-body font-semibold text-foreground mb-3">Address</h3>
                <p className="text-sm font-body text-foreground">{selectedKYC.address || 'N/A'}</p>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">City</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">District</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.district || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">State</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Pincode</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.pincode || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* ID Documents */}
              <div>
                <h3 className="text-sm font-body font-semibold text-foreground mb-3">ID Documents</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Aadhaar Number</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.aadhaarNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">PAN Number</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.panNumber || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <h3 className="text-sm font-body font-semibold text-foreground mb-3">Bank Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Account Holder Name</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.accountHolderName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Bank Name</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.bankName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Account Number</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.accountNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">IFSC Code</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.ifscCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">Branch Name</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.branchName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase">UPI ID</p>
                    <p className="text-sm font-body font-medium text-foreground">{selectedKYC.upiId || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-sm font-body font-semibold text-foreground mb-3">Uploaded Documents</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedKYC.aadhaarFrontImage && (
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground uppercase mb-2">Aadhaar Front</p>
                      <img
                        src={selectedKYC.aadhaarFrontImage}
                        alt="Aadhaar Front"
                        className="w-full h-32 object-cover rounded-lg border border-border"
                        onClick={() => window.open(selectedKYC.aadhaarFrontImage, '_blank')}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  {selectedKYC.aadhaarBackImage && (
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground uppercase mb-2">Aadhaar Back</p>
                      <img
                        src={selectedKYC.aadhaarBackImage}
                        alt="Aadhaar Back"
                        className="w-full h-32 object-cover rounded-lg border border-border"
                        onClick={() => window.open(selectedKYC.aadhaarBackImage, '_blank')}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  {selectedKYC.panImage && (
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground uppercase mb-2">PAN Card</p>
                      <img
                        src={selectedKYC.panImage}
                        alt="PAN Card"
                        className="w-full h-32 object-cover rounded-lg border border-border"
                        onClick={() => window.open(selectedKYC.panImage, '_blank')}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  {selectedKYC.profilePhoto && (
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground uppercase mb-2">Selfie</p>
                      <img
                        src={selectedKYC.profilePhoto}
                        alt="Selfie"
                        className="w-full h-32 object-cover rounded-lg border border-border"
                        onClick={() => window.open(selectedKYC.profilePhoto, '_blank')}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedKYC.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      const reason = prompt("Enter rejection reason (optional):");
                      handleKYCAction(selectedKYC._id, 'rejected', reason || undefined);
                    }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1 rounded-xl font-body"
                    onClick={() => handleKYCAction(selectedKYC._id, 'approved')}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chit Form Modal */}
      {chitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setChitModalOpen(false);
                setEditingChit(null);
                setChitForm({
                  name: '',
                  description: '',
                  monthlyAmount: '',
                  totalMembers: '',
                  duration: '',
                  prizeAmount: '',
                  startDate: '',
                  processingFee: '2',
                });
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
            <div className="mb-6">
              <h2 className="text-xl font-heading font-bold text-foreground">
                {editingChit ? 'Edit Chit Fund' : 'Create Chit Fund'}
              </h2>
              <p className="text-sm font-body text-muted-foreground mt-2">
                {editingChit ? 'Update chit fund details' : 'Create a new chit fund scheme'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-body font-semibold text-foreground">Chit Name</label>
                <input
                  type="text"
                  className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                  placeholder="e.g., Gold Savings Chit"
                  value={chitForm.name}
                  onChange={(e) => setChitForm({ ...chitForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-body font-semibold text-foreground">Description</label>
                <textarea
                  className="w-full h-24 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2 resize-none"
                  placeholder="Chit fund description"
                  value={chitForm.description}
                  onChange={(e) => setChitForm({ ...chitForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-body font-semibold text-foreground">Monthly Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                    placeholder="5000"
                    value={chitForm.monthlyAmount}
                    onChange={(e) => setChitForm({ ...chitForm, monthlyAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-body font-semibold text-foreground">Total Members</label>
                  <input
                    type="number"
                    className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                    placeholder="20"
                    value={chitForm.totalMembers}
                    onChange={(e) => setChitForm({ ...chitForm, totalMembers: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-body font-semibold text-foreground">Duration (months)</label>
                  <input
                    type="number"
                    className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                    placeholder="12"
                    value={chitForm.duration}
                    onChange={(e) => setChitForm({ ...chitForm, duration: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-body font-semibold text-foreground">Prize Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                    placeholder="100000"
                    value={chitForm.prizeAmount}
                    onChange={(e) => setChitForm({ ...chitForm, prizeAmount: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-body font-semibold text-foreground">Start Date</label>
                  <input
                    type="date"
                    className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                    value={chitForm.startDate}
                    onChange={(e) => setChitForm({ ...chitForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-body font-semibold text-foreground">Processing Fee (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full h-12 text-base font-body rounded-xl border border-border bg-background px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mt-2"
                    placeholder="2"
                    value={chitForm.processingFee}
                    onChange={(e) => setChitForm({ ...chitForm, processingFee: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 rounded-xl font-body"
                onClick={() => {
                  setChitModalOpen(false);
                  setEditingChit(null);
                  setChitForm({
                    name: '',
                    description: '',
                    monthlyAmount: '',
                    totalMembers: '',
                    duration: '',
                    prizeAmount: '',
                    startDate: '',
                    processingFee: '2',
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl font-body"
                onClick={editingChit ? handleUpdateChit : handleCreateChit}
              >
                {editingChit ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
