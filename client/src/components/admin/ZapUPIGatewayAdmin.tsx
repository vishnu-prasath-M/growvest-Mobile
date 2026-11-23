import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Key,
  Copy,
  Check,
  Server,
  Globe,
  FlaskConical,
  Radio,
  Save,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://growvest-mobile.onrender.com");

interface ZapUPIGatewayAdminProps {
  token: string | null;
}

export const ZapUPIGatewayAdmin: React.FC<ZapUPIGatewayAdminProps> = ({ token }) => {
  const [zapKey, setZapKey] = useState("zap5035fe5b00bcdc3c38f5ccf48bff850a");
  const [apiMode, setApiMode] = useState<"Test" | "Live">("Test");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const serverGatewayIp = "72.61.225.127";
  const webhookUrl = "https://growvest-mobile.onrender.com/api/payment/zapupi-webhook";

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const keyItem = data.find((s: any) => s.key === "zap_key");
          if (keyItem && keyItem.value) setZapKey(keyItem.value);
          const modeItem = data.find((s: any) => s.key === "zap_api_mode");
          if (modeItem && modeItem.value) {
            setApiMode(modeItem.value === "Live" ? "Live" : "Test");
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch Zap settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save zap_key
      await fetch(`${API_URL}/api/settings/zap_key`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          value: zapKey.trim(),
          description: "ZapUPI Payment Gateway API Key",
        }),
      });

      // Save zap_api_mode
      await fetch(`${API_URL}/api/settings/zap_api_mode`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          value: apiMode,
          description: "ZapUPI Payment Gateway API Mode",
        }),
      });

      toast.success("ZapUPI Payment Gateway settings saved successfully!");
    } catch (err) {
      console.error("Save error", err);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6"
    >
      {/* Top Banner / Heading */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border border-blue-500/30 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Zap className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center">
                <Key className="h-5 w-5 text-blue-300" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
                ZapUPI Gateway
              </h2>
            </div>
            <p className="text-blue-200/80 text-sm font-body">
              Manage your API credentials, webhook delivery & universal payment routing
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Gateway Connected
            </span>
            <a
              href="https://panel.zapupi.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
            >
              ZapUPI Panel
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid matching user's ZapUPI dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: API Keys & Credentials */}
        <div className="card-premium p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">API Keys</h3>
                <p className="text-xs text-muted-foreground font-body">Credentials for payment authentication</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Zap Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Zap Key
                  </label>
                  <span className="text-[11px] text-muted-foreground">Unique Secret</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={zapKey}
                    onChange={(e) => setZapKey(e.target.value)}
                    className="w-full h-11 text-sm font-mono rounded-xl border border-border bg-background/50 px-4 pr-11 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="zap..."
                  />
                  <button
                    onClick={() => handleCopy(zapKey, "Zap Key")}
                    type="button"
                    title="Copy Zap Key"
                    className="absolute right-2 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
                  >
                    {copiedField === "Zap Key" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Your unique API key for authenticating order creation and payment callbacks
                </p>
              </div>

              {/* Server Gateway IP */}
              <div className="space-y-1.5">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-blue-500" />
                  Server Gateway IP
                </label>
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-base font-extrabold text-blue-700 dark:text-blue-400">
                      {serverGatewayIp}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Allow this IP in your backend firewall for webhook delivery
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(serverGatewayIp, "Gateway IP")}
                    type="button"
                    className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-all"
                  >
                    {copiedField === "Gateway IP" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-purple-500" />
                    Webhook URL (Render)
                  </label>
                  <span className="text-[11px] text-emerald-600 font-semibold">Active Endpoint</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full h-11 text-xs font-mono rounded-xl border border-border bg-muted/40 px-3 pr-10 text-muted-foreground select-all"
                  />
                  <button
                    onClick={() => handleCopy(webhookUrl, "Webhook URL")}
                    type="button"
                    title="Copy Webhook URL"
                    className="absolute right-2 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
                  >
                    {copiedField === "Webhook URL" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  Paste this URL in your ZapUPI Dashboard Webhook settings to auto-confirm payments
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: API Settings & Coverage */}
        <div className="card-premium p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">API Settings</h3>
                <p className="text-xs text-muted-foreground font-body">Environment, cashier mode & routing</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* API Mode */}
              <div className="space-y-2">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  API Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApiMode("Test")}
                    className={`h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-all ${
                      apiMode === "Test"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Test Mode
                  </button>

                  <button
                    type="button"
                    onClick={() => setApiMode("Live")}
                    className={`h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2 border transition-all ${
                      apiMode === "Live"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 font-bold shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    Live Mode
                  </button>
                </div>
              </div>

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
                    Payment Mode
                  </label>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                    {apiMode === "Test" ? "Test Mode" : "Live Mode"}
                  </span>
                </div>
                <div className="w-full h-11 rounded-xl border border-border bg-muted/40 px-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Cashier</span>
                  <span className="text-xs text-muted-foreground">UPI Apps (GPay, PhonePe, Paytm)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Opens full Cashier payment screen with dynamic UPI intent & QR codes
                </p>
              </div>

              {/* Universal Support Checklist */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  Universal Product Verification Status
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    Investments
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    SIP Installments
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    Chit Fund Dues
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    Pocket Money
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-6 h-11 rounded-xl font-heading font-semibold flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving Changes..." : "Save Gateway Settings"}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
