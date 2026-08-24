import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Shield,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:5000" : "https://growvest-mobile.onrender.com");

const statusStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

const KYCAdmin = ({ token }: { token: string | null }) => {
  const [kycList, setKycList] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKYC, setSelectedKYC] = useState<any>(null);
  const [rejectionModal, setRejectionModal] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchKYC = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const [listRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/kyc/all?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/kyc/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        setKycList(data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching KYC:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKYC();
  }, [token, filter]);

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    if (!token) return;
    if (status === "rejected" && !rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/kyc/${id}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === "rejected" ? rejectionReason : "",
        }),
      });

      if (res.ok) {
        setRejectionModal(null);
        setRejectionReason("");
        fetchKYC();
        if (selectedKYC?._id === id) {
          const updated = await res.json();
          setSelectedKYC(updated);
        }
      } else {
        const err = await res.json();
        alert(err.message || "Failed to update KYC");
      }
    } catch (error) {
      console.error("Error reviewing KYC:", error);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filters = [
    { label: "All", value: "all", count: stats.total },
    { label: "Pending", value: "pending", count: stats.pending },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: stats.rejected },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-heading text-2xl text-foreground">KYC Verification</h2>
        <p className="text-sm font-body text-muted-foreground mt-0.5">
          Review and verify user KYC submissions
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`card-premium p-4 text-left transition-all ${
              filter === f.value ? "ring-2 ring-primary" : ""
            }`}
          >
            <p className="text-xs font-body text-muted-foreground">{f.label}</p>
            <p className="text-2xl font-heading font-bold text-foreground mt-1">{f.count}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchKYC()}
          placeholder="Search by name, PAN, or Aadhaar..."
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-sm font-body focus:outline-none focus:border-primary"
        />
      </div>

      {/* KYC List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm font-body text-muted-foreground mt-3">Loading KYC submissions...</p>
          </div>
        ) : kycList.length === 0 ? (
          <div className="text-center py-12 card-premium">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-body font-semibold text-foreground">No KYC submissions found</p>
            <p className="text-xs font-body text-muted-foreground mt-1">
              {filter !== "all" ? `No ${filter} submissions` : "No users have submitted KYC yet"}
            </p>
          </div>
        ) : (
          kycList.map((kyc: any) => {
            const userInfo = kyc.userId || {};
            const isExpanded = selectedKYC?._id === kyc._id;

            return (
              <motion.div key={kyc._id} layout className="card-premium overflow-hidden">
                {/* Summary Row */}
                <button
                  onClick={() => setSelectedKYC(isExpanded ? null : kyc)}
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-heading font-bold text-primary shrink-0">
                      {(kyc.fullName || userInfo.name || "U").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-body font-semibold text-foreground truncate">
                        {kyc.fullName || userInfo.name || "Unknown"}
                      </p>
                      <p className="text-xs font-body text-muted-foreground truncate">
                        {userInfo.email || userInfo.mobileNumber || ""}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground">Submitted</p>
                      <p className="text-xs font-body text-foreground">{formatDate(kyc.submittedAt)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-body font-medium border ${statusStyle[kyc.status]}`}
                    >
                      {kyc.status.charAt(0).toUpperCase() + kyc.status.slice(1)}
                    </span>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 sm:px-6 py-5 bg-muted/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {/* Personal Info */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
                              Personal Information
                            </h4>
                            <div className="space-y-2">
                              <InfoRow label="Full Name" value={kyc.fullName} />
                              <InfoRow label="Father/Husband" value={kyc.fatherOrHusbandName} />
                              <InfoRow label="DOB" value={formatDate(kyc.dob)} />
                              <InfoRow label="Gender" value={kyc.gender} />
                              <InfoRow label="Occupation" value={kyc.occupation} />
                            </div>
                          </div>

                          {/* Address */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
                              Address & Identity
                            </h4>
                            <div className="space-y-2">
                              <InfoRow label="Address" value={kyc.address} />
                              <InfoRow label="City" value={kyc.city} />
                              <InfoRow label="District" value={kyc.district} />
                              <InfoRow label="State" value={kyc.state} />
                              <InfoRow label="Pincode" value={kyc.pincode} />
                              <InfoRow label="Aadhaar" value={kyc.aadhaarNumber} />
                              <InfoRow label="PAN" value={kyc.panNumber} />
                            </div>
                          </div>

                          {/* Nominee & Bank */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
                              Nominee & Bank
                            </h4>
                            <div className="space-y-2">
                              <InfoRow label="Nominee" value={kyc.nomineeName} />
                              <InfoRow label="Relationship" value={kyc.nomineeRelationship} />
                              <InfoRow label="Nominee Mobile" value={kyc.nomineeMobileNumber} />
                              <div className="border-t border-border pt-2 mt-2" />
                              <InfoRow label="Account Holder" value={kyc.accountHolderName} />
                              <InfoRow label="Bank" value={kyc.bankName} />
                              <InfoRow label="Account No." value={kyc.accountNumber} />
                              <InfoRow label="IFSC" value={kyc.ifscCode} />
                              <InfoRow label="Branch" value={kyc.branchName} />
                              {kyc.upiId && <InfoRow label="UPI" value={kyc.upiId} />}
                            </div>
                          </div>
                        </div>

                        {/* Documents Section — Always displays all 4 document cards with fallbacks */}
                        <div className="mt-6">
                          <h4 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Uploaded Documents
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <ImageViewer
                              title="Aadhaar Front"
                              docType="aadhaarFront"
                              kycId={kyc._id}
                              token={token}
                              data={kyc.aadhaarFrontImage}
                            />
                            <ImageViewer
                              title="Aadhaar Back"
                              docType="aadhaarBack"
                              kycId={kyc._id}
                              token={token}
                              data={kyc.aadhaarBackImage}
                            />
                            <ImageViewer
                              title="PAN Card"
                              docType="pan"
                              kycId={kyc._id}
                              token={token}
                              data={kyc.panImage}
                            />
                            <ImageViewer
                              title="Selfie"
                              docType="profilePhoto"
                              kycId={kyc._id}
                              token={token}
                              data={kyc.profilePhoto}
                            />
                          </div>
                        </div>

                        {/* Rejection Reason */}
                        {kyc.status === "rejected" && kyc.rejectionReason && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-body font-semibold text-red-700">Rejection Reason</p>
                              <p className="text-xs font-body text-red-600 mt-0.5">{kyc.rejectionReason}</p>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {kyc.status === "pending" && (
                          <div className="mt-6 flex gap-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50 h-10 px-6"
                              onClick={() => {
                                setRejectionModal(kyc);
                                setRejectionReason("");
                              }}
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-xl font-body h-10 px-6"
                              onClick={() => handleReview(kyc._id, "approved")}
                            >
                              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        )}

                        {/* Reviewed Info */}
                        {kyc.status !== "pending" && (
                          <div className="mt-4 text-xs font-body text-muted-foreground">
                            {kyc.status === "approved" ? "Approved" : "Rejected"} on{" "}
                            {formatDate(kyc.reviewedAt)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setRejectionModal(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-heading font-bold text-foreground">Reject KYC</h3>
              <p className="text-sm font-body text-muted-foreground mt-1">
                Provide a reason for rejecting{" "}
                <strong>{rejectionModal.fullName || "this user"}</strong>'s KYC.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-body font-semibold text-foreground">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                  className="w-full mt-2 p-3 rounded-xl border border-border bg-background text-sm font-body focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="w-full rounded-xl font-body"
                  onClick={() => setRejectionModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="w-full rounded-xl font-body bg-red-600 hover:bg-red-700"
                  disabled={!rejectionReason.trim()}
                  onClick={() => handleReview(rejectionModal._id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <div className="flex justify-between gap-2">
    <span className="text-xs font-body text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs font-body text-foreground font-medium text-right break-all">
      {value || "—"}
    </span>
  </div>
);

const ImageViewer = ({
  title,
  docType,
  kycId,
  token,
  data,
}: {
  title: string;
  docType: string;
  kycId: string;
  token: string | null;
  data?: string;
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Determine correct image URL or Base64 URI
  const getSrc = () => {
    if (!data || data.trim() === "") return "";
    if (data.startsWith("http://") || data.startsWith("https://")) return data;
    if (data.startsWith("data:image/")) return data;
    // If we have token & kycId, try authenticated backend streaming route
    if (kycId && token) {
      return `${API_URL}/api/kyc/document/${kycId}/${docType}?token=${token}`;
    }
    // Clean raw base64 string
    const cleanBase64 = data.replace(/^data:image\/[a-z]+;base64,/, "").trim();
    return `data:image/jpeg;base64,${cleanBase64}`;
  };

  const src = getSrc();
  const hasDoc = Boolean(src && !imgError);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerOpen(false);
    };
    if (viewerOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerOpen]);

  return (
    <>
      {hasDoc ? (
        <button
          onClick={() => {
            setZoomLevel(1);
            setViewerOpen(true);
          }}
          className="relative group overflow-hidden rounded-xl border border-border bg-card h-28 w-full text-left transition-all hover:border-primary"
        >
          <img
            src={src}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-all" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-[11px] font-body font-medium text-white truncate">{title}</p>
          </div>
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 h-28 p-3 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground/60 mb-1" />
          <p className="text-[11px] font-body font-semibold text-muted-foreground">{title}</p>
          <p className="text-[10px] font-body text-muted-foreground/80 mt-0.5">Document not uploaded</p>
        </div>
      )}

      {/* Full-screen Zoomable Image Viewer Modal */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setViewerOpen(false)}
        >
          {/* Header Bar */}
          <div
            className="w-full max-w-4xl flex items-center justify-between z-10 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-heading font-bold text-white">{title}</h3>
              <p className="text-xs font-body text-gray-400">Click outside or press Esc to close</p>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                className="px-2.5 py-1 text-xs font-body font-bold text-white hover:bg-white/20 rounded-lg"
                title="Zoom Out"
              >
                -
              </button>
              <span className="text-xs font-body text-white font-medium px-1">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="px-2.5 py-1 text-xs font-body font-bold text-white hover:bg-white/20 rounded-lg"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-2 py-1 text-[11px] font-body text-gray-300 hover:text-white hover:bg-white/20 rounded-lg ml-1"
              >
                Reset
              </button>
            </div>

            <button
              onClick={() => setViewerOpen(false)}
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Full Size Image Display */}
          <div
            className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-auto py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={title}
              style={{ transform: `scale(${zoomLevel})` }}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200 ease-out"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default KYCAdmin;