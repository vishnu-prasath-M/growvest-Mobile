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
  const [banners, setBanners] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/banners/admin/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setBanners(data.banners);
      }
    } catch (err) {
      console.error("Error fetching banners:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchBanners();
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
    </div>
  );
};
