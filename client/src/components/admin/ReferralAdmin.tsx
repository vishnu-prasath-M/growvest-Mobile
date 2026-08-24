import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift,
  UploadCloud,
  Download,
  CheckCircle,
  Clock,
  Search,
  Copy,
  Trash2,
  AlertCircle,
  FileCheck,
  Users,
  Award,
  Smartphone,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://growvest-mobile.onrender.com");

interface ReferralAdminProps {
  token: string | null;
}

const ReferralAdmin = ({ token }: ReferralAdminProps) => {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "users" | "apk">("overview");
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState<any>({
    overview: {
      totalReferrals: 0,
      registeredCount: 0,
      qualifiedCount: 0,
      pendingCount: 0,
      totalCoinsRewarded: 0,
      totalApkDownloads: 0,
    },
    referralUsers: [],
  });

  const [activeApk, setActiveApk] = useState<any>(null);
  const [apkHistory, setApkHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // APK Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReferralOverview = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/referral/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOverviewData(data);
      }
    } catch (err) {
      console.error("Error fetching referral admin overview:", err);
    }
  };

  const fetchApkDetails = async () => {
    try {
      const [activeRes, allRes] = await Promise.all([
        fetch(`${API_URL}/api/referral/apk`),
        token
          ? fetch(`${API_URL}/api/referral/admin/apk/all`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : Promise.resolve(null),
      ]);

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        if (activeData.hasActiveApk) {
          setActiveApk(activeData);
        } else {
          setActiveApk(null);
        }
      }

      if (allRes && allRes.ok) {
        const allData = await allRes.json();
        setApkHistory(allData);
      }
    } catch (err) {
      console.error("Error fetching APK details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralOverview();
    fetchApkDetails();
  }, [token]);

  const handleFileUpload = (file: File) => {
    if (!token) return;
    setUploadError("");

    if (!file.name.toLowerCase().endsWith(".apk")) {
      setUploadError("Invalid file type. Please upload a valid .apk file.");
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setUploadError("File is too large. Maximum allowed size is 150 MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("apkFile", file);
    formData.append("fileName", file.name);
    formData.append("version", `v1.0.${Date.now().toString().slice(-3)}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/referral/admin/apk`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    // Real-time smooth progress tracking
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 95);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploadProgress(100);
      if (xhr.status === 200 || xhr.status === 201) {
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          fetchApkDetails();
          fetchReferralOverview();
        }, 500);
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setUploadError(err.message || "Failed to upload APK");
        } catch {
          setUploadError(`Upload failed with status code ${xhr.status}`);
        }
        setUploading(false);
      }
    };

    xhr.onerror = () => {
      setUploadError("Network error occurred during APK upload");
      setUploading(false);
    };

    xhr.send(formData);
  };

  const handleCopyApkUrl = () => {
    const fullUrl = `${API_URL}/api/referral/apk/download`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDeleteApk = async (id: string) => {
    if (!token || !confirm("Are you sure you want to delete this APK version?")) return;
    try {
      const res = await fetch(`${API_URL}/api/referral/admin/apk/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchApkDetails();
      }
    } catch (err) {
      console.error("Error deleting APK:", err);
    }
  };

  const formatMB = (bytes: number) => {
    if (!bytes) return "0 MB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const overview = overviewData.overview || {};
  const referralUsers = overviewData.referralUsers || [];

  const filteredUsers = referralUsers.filter((u: any) => {
    const matchesSearch =
      (u.userName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.referralCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.referrerName || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "qualified") return matchesSearch && ["SUCCESSFUL", "REWARDED"].includes(u.referralStatus);
    if (statusFilter === "pending") return matchesSearch && ["REGISTERED", "PENDING"].includes(u.referralStatus);
    return matchesSearch;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* Title & Nav Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-heading text-2xl text-foreground">Referral & APK Management</h2>
          <p className="text-sm font-body text-muted-foreground mt-0.5">
            Track user referrals, qualified rewards, and manage active Android APK releases
          </p>
        </div>

        <div className="flex bg-muted/60 p-1 rounded-2xl border border-border shrink-0">
          <button
            onClick={() => setActiveSubTab("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-body font-semibold transition-all ${
              activeSubTab === "overview"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSubTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-body font-semibold transition-all ${
              activeSubTab === "users"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Referred Users ({referralUsers.length})
          </button>
          <button
            onClick={() => setActiveSubTab("apk")}
            className={`px-4 py-2 rounded-xl text-xs font-body font-semibold transition-all ${
              activeSubTab === "apk"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            APK Management
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="card-premium p-4">
              <p className="text-xs font-body text-muted-foreground">Total Referrals</p>
              <p className="text-2xl font-heading font-bold text-foreground mt-1">{overview.totalReferrals || 0}</p>
            </div>
            <div className="card-premium p-4">
              <p className="text-xs font-body text-muted-foreground">Registered</p>
              <p className="text-2xl font-heading font-bold text-blue-600 mt-1">{overview.registeredCount || 0}</p>
            </div>
            <div className="card-premium p-4">
              <p className="text-xs font-body text-muted-foreground">Qualified</p>
              <p className="text-2xl font-heading font-bold text-green-600 mt-1">{overview.qualifiedCount || 0}</p>
            </div>
            <div className="card-premium p-4">
              <p className="text-xs font-body text-muted-foreground">Pending</p>
              <p className="text-2xl font-heading font-bold text-amber-600 mt-1">{overview.pendingCount || 0}</p>
            </div>
            <div className="card-premium p-4">
              <p className="text-xs font-body text-muted-foreground">Coins Rewarded</p>
              <p className="text-2xl font-heading font-bold text-yellow-600 mt-1">🪙 {overview.totalCoinsRewarded || 0}</p>
            </div>
            <div className="card-premium p-4">
              <p className="text-xs font-body text-muted-foreground">APK Downloads</p>
              <p className="text-2xl font-heading font-bold text-primary mt-1">📱 {overview.totalApkDownloads || 0}</p>
            </div>
          </div>

          {/* Quick Active APK Status Card */}
          <div className="card-premium p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-accent border border-border flex items-center justify-center text-primary">
                  <Smartphone size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-base text-foreground">
                      {activeApk ? activeApk.fileName : "No Active APK Uploaded"}
                    </h3>
                    {activeApk && (
                      <span className="text-[10px] font-body font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-body text-muted-foreground mt-0.5">
                    {activeApk
                      ? `Size: ${formatMB(activeApk.fileSize)} • Uploaded: ${formatDate(activeApk.uploadedAt)} • Downloads: ${activeApk.downloadCount}`
                      : "Upload a production .apk file to activate public referral downloads."}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                className="rounded-xl font-body text-xs"
                onClick={() => setActiveSubTab("apk")}
              >
                <UploadCloud className="mr-1.5 h-4 w-4" />
                Manage APK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REFERRED USERS TAB */}
      {activeSubTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, code, or referrer..."
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-background text-xs font-body focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {(["all", "qualified", "pending"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-colors ${
                    statusFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-body">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Referred User</th>
                    <th className="px-4 py-3">Referral Code</th>
                    <th className="px-4 py-3">Referrer</th>
                    <th className="px-4 py-3">Joined Date</th>
                    <th className="px-4 py-3">Investment Status</th>
                    <th className="px-4 py-3">Referral Status</th>
                    <th className="px-4 py-3 text-right">Coins Rewarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u: any) => (
                      <tr key={u._id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-foreground">
                          {u.userName}
                          <span className="block text-[10px] text-muted-foreground font-normal">{u.userEmail}</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-yellow-600 font-bold">{u.referralCode}</td>
                        <td className="px-4 py-3.5 text-foreground">{u.referrerName}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{formatDate(u.joinedDate)}</td>
                        <td className="px-4 py-3.5 font-medium">
                          {u.investmentStatus !== "None" ? (
                            <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                              {u.investmentStatus} (₹{u.investmentAmount})
                            </span>
                          ) : (
                            <span className="text-gray-500">Not Invested Yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {["SUCCESSFUL", "REWARDED"].includes(u.referralStatus) ? (
                            <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                              SUCCESSFUL
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-green-700">
                          {u.rewardCoins > 0 ? `+${u.rewardCoins} Coins` : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No referral records match filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* APK MANAGEMENT TAB */}
      {activeSubTab === "apk" && (
        <div className="space-y-6">
          {/* Upload Card */}
          <div className="card-premium p-6 sm:p-8">
            <h3 className="font-heading font-bold text-lg text-foreground mb-1">Upload Android APK</h3>
            <p className="text-xs font-body text-muted-foreground mb-6">
              Upload a compiled Android package (.apk) to make it immediately active on referral download landing pages
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".apk"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-primary bg-primary/5 scale-[0.99]"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="h-14 w-14 rounded-2xl bg-accent border border-border flex items-center justify-center text-primary mx-auto mb-4">
                <UploadCloud size={28} />
              </div>

              <p className="text-sm font-body font-bold text-foreground">
                Drag & drop APK file here, or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-xs font-body text-muted-foreground mt-1">Supports .apk files up to 150MB</p>
            </div>

            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-body text-red-600">
                <AlertCircle size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            {uploading && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs font-body text-foreground font-semibold">
                  <span>Uploading APK...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Current Active APK Details */}
          {activeApk ? (
            <div className="card-premium p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-lg text-foreground">{activeApk.fileName}</h3>
                    <span className="text-[10px] font-body font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      ACTIVE RELEASE
                    </span>
                  </div>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    Version: {activeApk.version || "1.0.0"} • Size: {formatMB(activeApk.fileSize)} • Uploaded:{" "}
                    {formatDate(activeApk.uploadedAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-body text-muted-foreground">Total APK Downloads</p>
                  <p className="text-xl font-heading font-bold text-primary">{activeApk.downloadCount || 0}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border flex-1">
                  <input
                    type="text"
                    readOnly
                    value={`${API_URL}/api/referral/apk/download`}
                    className="bg-transparent text-xs font-mono text-muted-foreground w-full outline-none"
                  />
                  <Button size="sm" variant="ghost" className="h-8 text-xs font-body shrink-0" onClick={handleCopyApkUrl}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    {copiedUrl ? "Copied" : "Copy URL"}
                  </Button>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-body text-xs h-10 px-4"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Replace APK
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50 h-10 px-4"
                    onClick={() => handleDeleteApk(activeApk._id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-premium p-8 text-center">
              <AlertCircle size={36} className="text-amber-500 mx-auto mb-3" />
              <h4 className="font-heading font-bold text-base text-foreground">No Active APK Uploaded</h4>
              <p className="text-xs font-body text-muted-foreground mt-1 max-w-md mx-auto">
                Users visiting referral landing pages will see "Android app download is currently unavailable" until an APK file is uploaded.
              </p>
            </div>
          )}

          {/* Release History */}
          {apkHistory.length > 0 && (
            <div className="card-premium p-6">
              <h4 className="font-heading font-bold text-base text-foreground mb-4">APK Release History</h4>
              <div className="space-y-3">
                {apkHistory.map((apk) => (
                  <div key={apk._id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 text-xs font-body">
                    <div>
                      <p className="font-semibold text-foreground">{apk.fileName}</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        {formatMB(apk.fileSize)} • {formatDate(apk.uploadedAt)} • Downloads: {apk.downloadCount}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${apk.status === "active" ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600"}`}>
                        {apk.status.toUpperCase()}
                      </span>
                      <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => handleDeleteApk(apk._id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ReferralAdmin;
