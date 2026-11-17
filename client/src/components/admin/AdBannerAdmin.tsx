import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Upload,
  Info,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://growvest-mobile.onrender.com");

interface AdBanner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  width: number;
  height: number;
  aspectRatio: number;
  order: number;
  isActive: boolean;
  createdAt: string;
}

interface AdBannerAdminProps {
  token: string | null;
}

const RECOMMENDED_WIDTH = 1024;
const RECOMMENDED_HEIGHT = 409;
const RECOMMENDED_RATIO = 2.50;

export const AdBannerAdmin = ({ token }: AdBannerAdminProps) => {
  const effectiveToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const [banners, setBanners] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [order, setOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number; ratio: number } | null>(null);
  const [dimensionWarning, setDimensionWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit banner states
  const [editingBanner, setEditingBanner] = useState<AdBanner | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editOrder, setEditOrder] = useState<number>(1);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPreviewImage, setEditPreviewImage] = useState<string | null>(null);
  const [editBase64Image, setEditBase64Image] = useState<string | null>(null);
  const [editImageDimensions, setEditImageDimensions] = useState<{ width: number; height: number; ratio: number } | null>(null);
  const [editDimensionWarning, setEditDimensionWarning] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedbackMsg, setEditFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const openEditModal = (banner: AdBanner) => {
    setEditingBanner(banner);
    setEditTitle(banner.title);
    setEditLinkUrl(banner.linkUrl || "");
    setEditOrder(banner.order || 1);
    setEditIsActive(banner.isActive);
    setEditPreviewImage(getFullImageUrl(banner.imageUrl));
    setEditBase64Image(null);
    setEditImageDimensions({ width: banner.width || RECOMMENDED_WIDTH, height: banner.height || RECOMMENDED_HEIGHT, ratio: banner.aspectRatio || RECOMMENDED_RATIO });
    setEditDimensionWarning(null);
    setEditFeedbackMsg(null);
    setShowEditModal(true);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setEditFeedbackMsg({ type: "error", text: "Please select a valid image file (PNG, JPG, WEBP)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setEditBase64Image(base64);
      setEditPreviewImage(base64);

      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const r = Number((w / h).toFixed(2));
        setEditImageDimensions({ width: w, height: h, ratio: r });

        const ratioDiff = Math.abs(r - RECOMMENDED_RATIO);
        if (ratioDiff > 0.25 || w < 600 || h < 240) {
          setEditDimensionWarning(
            `⚠️ Size Mismatch: Recommended size is ${RECOMMENDED_WIDTH} × ${RECOMMENDED_HEIGHT} px (Aspect Ratio 2.50:1). Uploaded is ${w} × ${h} px (${r}:1).`
          );
        } else {
          setEditDimensionWarning(null);
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    if (!editTitle.trim()) {
      setEditFeedbackMsg({ type: "error", text: "Please enter a banner title." });
      return;
    }

    setEditSubmitting(true);
    setEditFeedbackMsg(null);

    try {
      const payload: Record<string, any> = {
        title: editTitle.trim(),
        linkUrl: editLinkUrl.trim(),
        order: Number(editOrder) || 1,
        isActive: editIsActive,
      };

      if (editBase64Image) {
        payload.base64Data = editBase64Image;
        payload.width = editImageDimensions?.width || RECOMMENDED_WIDTH;
        payload.height = editImageDimensions?.height || RECOMMENDED_HEIGHT;
      }

      const res = await fetch(`${API_URL}/api/banners/admin/${editingBanner._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        fetchBanners();
      } else {
        setEditFeedbackMsg({ type: "error", text: data.message || "Failed to update banner." });
      }
    } catch (err: any) {
      setEditFeedbackMsg({ type: "error", text: err.message || "Server error updating banner." });
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchBanners = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) {
        headers["Authorization"] = `Bearer ${effectiveToken}`;
      }

      let res = await fetch(`${API_URL}/api/banners/admin/all`, { headers });
      if (!res.ok) {
        // Fallback to public route if admin/all fails
        res = await fetch(`${API_URL}/api/banners`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setBanners(data.banners);
        setFetchError(null);
      } else {
        throw new Error(data.message || "Failed to parse banners response");
      }
    } catch (err: any) {
      console.error("Error fetching banners:", err);
      try {
        const fallback = await fetch(`${API_URL}/api/banners`);
        const fallbackData = await fallback.json();
        if (fallbackData.success && Array.isArray(fallbackData.banners)) {
          setBanners(fallbackData.banners);
          setFetchError(null);
          return;
        }
      } catch (e) {
        console.error("Fallback fetch banners error:", e);
      }
      setFetchError("Unable to connect to backend. The server might be waking up (Render cold-start).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, [token]);

  // Handle image file selection & dimension validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedbackMsg({ type: "error", text: "Please select a valid image file (PNG, JPG, WEBP)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setBase64Image(base64);
      setPreviewImage(base64);

      // Measure natural dimensions
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const r = Number((w / h).toFixed(2));

        setImageDimensions({ width: w, height: h, ratio: r });

        // Check if ratio deviates from 2.50:1 (tolerance: +/- 0.2)
        const ratioDiff = Math.abs(r - RECOMMENDED_RATIO);
        if (ratioDiff > 0.25 || w < 600 || h < 240) {
          setDimensionWarning(
            `⚠️ Size Mismatch Warning: Existing home ad banners are ${RECOMMENDED_WIDTH} × ${RECOMMENDED_HEIGHT} px (Aspect Ratio 2.50:1). Your uploaded image is ${w} × ${h} px (Aspect Ratio ${r}:1). Images with different proportions will appear cropped or stretched on user devices.`
          );
        } else {
          setDimensionWarning(null);
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedbackMsg({ type: "error", text: "Please enter a banner title." });
      return;
    }
    if (!base64Image) {
      setFeedbackMsg({ type: "error", text: "Please select an ad banner image." });
      return;
    }

    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`${API_URL}/api/banners/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          base64Data: base64Image,
          linkUrl: linkUrl.trim(),
          width: imageDimensions?.width || RECOMMENDED_WIDTH,
          height: imageDimensions?.height || RECOMMENDED_HEIGHT,
          order: Number(order) || banners.length + 1,
          isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({ type: "success", text: "Ad banner added successfully!" });
        // Reset form
        setTitle("");
        setLinkUrl("");
        setPreviewImage(null);
        setBase64Image(null);
        setImageDimensions(null);
        setDimensionWarning(null);
        setShowAddModal(false);
        fetchBanners();
      } else {
        setFeedbackMsg({ type: "error", text: data.message || "Failed to create banner." });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Server error creating banner." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: AdBanner) => {
    try {
      const res = await fetch(`${API_URL}/api/banners/admin/${banner._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setBanners((prev) =>
          prev.map((b) => (b._id === banner._id ? { ...b, isActive: !b.isActive } : b))
        );
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this ad banner?")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/banners/admin/${bannerId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setBanners((prev) => prev.filter((b) => b._id !== bannerId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border/40 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-foreground">Homepage Ad Banners</h2>
              <p className="text-xs font-body text-muted-foreground">
                Manage promotional banners displayed on the mobile app home screen carousel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBanners}
            disabled={loading}
            className="rounded-xl h-10 px-3 text-xs font-body"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setFeedbackMsg(null);
              setShowAddModal(true);
            }}
            className="rounded-xl h-10 px-4 text-xs font-body font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add New Ad Banner
          </Button>
        </div>
      </div>

      {/* Guidelines Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-body flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Banner Image Dimension Guideline:</p>
          <p className="mt-0.5 text-muted-foreground">
            Standard Homepage Banner Size: <span className="font-bold text-foreground">1024 × 409 pixels</span> (Aspect Ratio <span className="font-bold text-foreground">2.50 : 1</span>).
            Uploading images of matching proportions ensures they appear sharp and perfectly fitted without letterboxing on user screens.
          </p>
        </div>
      </div>

      {/* Banners Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm font-body">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading ad banners...
        </div>
      ) : fetchError ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-amber-500/40 p-6">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">Backend Connection Pending</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {fetchError}
          </p>
          <Button onClick={fetchBanners} variant="outline" className="mt-4 rounded-xl text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Now
          </Button>
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border/60">
          <ImageIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Ad Banners Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Click "Add New Ad Banner" above to upload promotional banners for your mobile app.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {banners.map((banner, index) => (
            <motion.div
              key={banner._id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border overflow-hidden bg-card transition-all shadow-sm ${
                banner.isActive ? "border-border/60" : "border-border/40 opacity-60"
              }`}
            >
              {/* Banner Image Preview Container */}
              <div className="relative aspect-[2.5/1] w-full bg-slate-900/10 overflow-hidden">
                <img
                  src={getFullImageUrl(banner.imageUrl)}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/1024x409/085428/ffffff?text=Growvest+Banner";
                  }}
                />
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                      banner.isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {banner.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                    #{banner.order || index + 1}
                  </span>
                </div>
              </div>

              {/* Banner Details */}
              <div className="p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground line-clamp-1">{banner.title}</h4>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>
                      Size: {banner.width || RECOMMENDED_WIDTH} × {banner.height || RECOMMENDED_HEIGHT}
                    </span>
                    <span>•</span>
                    <span>Ratio: {banner.aspectRatio || RECOMMENDED_RATIO}:1</span>
                  </div>
                  {banner.linkUrl ? (
                    <a
                      href={banner.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 mt-1 truncate"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {banner.linkUrl}
                    </a>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(banner)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {banner.isActive ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Activate
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBanner(banner._id)}
                    className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/20"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add New Banner Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-border/40 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-heading font-bold text-foreground">Upload New Ad Banner</h3>
                  <p className="text-xs text-muted-foreground">Add a promotional banner for the homepage carousel</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateBanner} className="p-6 overflow-y-auto space-y-5">
                {feedbackMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-body ${
                      feedbackMsg.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {feedbackMsg.text}
                  </div>
                )}

                {/* Banner Title */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Banner Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. SeyoN UPVC Windows / Seasonal Sale"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Image Upload Area */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Banner Image <span className="text-rose-500">*</span>
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {previewImage ? (
                    <div className="space-y-3">
                      {/* Image Preview Box */}
                      <div className="relative aspect-[2.5/1] w-full rounded-xl overflow-hidden border border-border/80 bg-slate-900/10 shadow-inner">
                        <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-2 right-2 px-3 py-1 bg-black/75 hover:bg-black text-white text-[11px] font-semibold rounded-lg backdrop-blur-sm"
                        >
                          Change Image
                        </button>
                      </div>

                      {/* Detected Dimensions */}
                      {imageDimensions && (
                        <div className="flex items-center justify-between text-xs font-body text-muted-foreground px-1">
                          <span>
                            Detected Size: <strong className="text-foreground">{imageDimensions.width} × {imageDimensions.height} px</strong>
                          </span>
                          <span>
                            Aspect Ratio: <strong className="text-foreground">{imageDimensions.ratio} : 1</strong>
                          </span>
                        </div>
                      )}

                      {/* Dimension Warning Banner */}
                      {dimensionWarning && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-body flex items-start gap-2.5"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>{dimensionWarning}</div>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/80 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-emerald-500/5"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs font-bold text-foreground">Click to upload banner image</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Recommended size: <strong>1024 × 409 px</strong> (PNG, JPG, WEBP)
                      </p>
                    </div>
                  )}
                </div>

                {/* Optional Redirect URL */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Redirect Link URL <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com or internal screen link"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Order & Active Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Display Order</label>
                    <input
                      type="number"
                      min="1"
                      value={order}
                      onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                      className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Status</label>
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`w-full h-10 px-3.5 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        isActive
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400"
                          : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {isActive ? <CheckCircle className="h-4 w-4" /> : null}
                      {isActive ? "Active (Visible)" : "Inactive (Hidden)"}
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-xl h-10 px-4 text-xs font-body"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl h-10 px-5 text-xs font-body font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...
                      </>
                    ) : (
                      "Upload Banner"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Banner Modal */}
      <AnimatePresence>
        {showEditModal && editingBanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-heading font-bold text-foreground">Edit Ad Banner</h3>
                    <p className="text-xs text-muted-foreground">Update title, redirect link, image, or display order</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleUpdateBanner} className="p-6 overflow-y-auto space-y-5">
                {editFeedbackMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-body ${
                      editFeedbackMsg.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {editFeedbackMsg.text}
                  </div>
                )}

                {/* Banner Title */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Banner Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Banner title"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Image Upload Area */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Banner Image <span className="text-muted-foreground font-normal">(Leave unchanged to keep current)</span>
                  </label>

                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditFileChange}
                    className="hidden"
                  />

                  {editPreviewImage && (
                    <div className="space-y-3">
                      <div className="relative aspect-[2.5/1] w-full rounded-xl overflow-hidden border border-border/80 bg-slate-900/10 shadow-inner">
                        <img src={editPreviewImage} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="absolute bottom-2 right-2 px-3 py-1 bg-black/75 hover:bg-black text-white text-[11px] font-semibold rounded-lg backdrop-blur-sm"
                        >
                          Replace Image
                        </button>
                      </div>

                      {editImageDimensions && (
                        <div className="flex items-center justify-between text-xs font-body text-muted-foreground px-1">
                          <span>
                            Size: <strong className="text-foreground">{editImageDimensions.width} × {editImageDimensions.height} px</strong>
                          </span>
                          <span>
                            Ratio: <strong className="text-foreground">{editImageDimensions.ratio} : 1</strong>
                          </span>
                        </div>
                      )}

                      {editDimensionWarning && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-body flex items-start gap-2.5"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>{editDimensionWarning}</div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                {/* Redirect Link */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Redirect Link URL <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    value={editLinkUrl}
                    onChange={(e) => setEditLinkUrl(e.target.value)}
                    placeholder="https://walink.me/... or website"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Order & Active Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Display Order (#)</label>
                    <input
                      type="number"
                      min="1"
                      value={editOrder}
                      onChange={(e) => setEditOrder(parseInt(e.target.value) || 1)}
                      className="w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Visibility Status</label>
                    <button
                      type="button"
                      onClick={() => setEditIsActive(!editIsActive)}
                      className={`w-full h-10 px-3.5 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        editIsActive
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-400"
                          : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      {editIsActive ? <CheckCircle className="h-4 w-4" /> : null}
                      {editIsActive ? "Active (Visible)" : "Inactive (Hidden)"}
                    </button>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-xl h-10 px-4 text-xs font-body"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-xl h-10 px-5 text-xs font-body font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {editSubmitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> Updating...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

