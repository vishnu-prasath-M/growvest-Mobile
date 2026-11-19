import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Percent,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  HelpCircle,
  TrendingUp,
  CreditCard,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://growvest-mobile.onrender.com");

interface InvestmentPlanCharge {
  planName: string;
  planReturnPercent: number;
  durationDays: number;
  processingCharge: number;
  maintenanceCharge: number;
  reason: string;
}

interface PlatformChargesData {
  isPromotionalLaunchOffer: boolean;
  promotionalNotice: string;
  chitFund: {
    processingCharge: number;
    maintenanceCharge: number;
    withdrawCommission: number;
    latePaymentPerDay: number;
    cancelPenalty: number;
  };
  sip: {
    processingCharge: number;
    maintenanceCharge: number;
    withdrawCommission: number;
    latePaymentPerDay: number;
    cancelPenalty: number;
  };
  investmentPlans: InvestmentPlanCharge[];
}

interface ChargesAdminProps {
  token: string | null;
}

export const ChargesAdmin: React.FC<ChargesAdminProps> = ({ token }) => {
  const effectiveToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<PlatformChargesData>({
    isPromotionalLaunchOffer: true,
    promotionalNotice: "Special Launch Offer: 0% Platform Charges & Zero Commission Active!",
    chitFund: {
      processingCharge: 1.00,
      maintenanceCharge: 0.95,
      withdrawCommission: 1.95,
      latePaymentPerDay: 2.35,
      cancelPenalty: 0,
    },
    sip: {
      processingCharge: 1.00,
      maintenanceCharge: 0.95,
      withdrawCommission: 1.95,
      latePaymentPerDay: 2.35,
      cancelPenalty: 15.00,
    },
    investmentPlans: [
      { planName: "6% Plan (Under 15 Days)", planReturnPercent: 6, durationDays: 7, processingCharge: 0.00, maintenanceCharge: 0.03, reason: "Under 15 Days Maintenance Charges" },
      { planName: "12% Plan (15 Days)", planReturnPercent: 12, durationDays: 15, processingCharge: 0.10, maintenanceCharge: 0.02, reason: "15 Days Maintenance Charges" },
      { planName: "15% Plan (30 Days)", planReturnPercent: 15, durationDays: 30, processingCharge: 0.10, maintenanceCharge: 0.20, reason: "30 Days Maintenance Charges" },
      { planName: "18% Plan (90 Days)", planReturnPercent: 18, durationDays: 90, processingCharge: 0.10, maintenanceCharge: 0.62, reason: "90 Days Maintenance Charges" },
      { planName: "20% Plan (180 Days)", planReturnPercent: 20, durationDays: 180, processingCharge: 0.10, maintenanceCharge: 1.50, reason: "180 Days Maintenance Charges" },
      { planName: "24% Plan (365 Days)", planReturnPercent: 24, durationDays: 365, processingCharge: 0.10, maintenanceCharge: 2.78, reason: "365 Days Maintenance Charges" },
    ],
  });

  const fetchCharges = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) headers["Authorization"] = `Bearer ${effectiveToken}`;

      let res = await fetch(`${API_URL}/api/charges/admin`, { headers });
      if (!res.ok) {
        res = await fetch(`${API_URL}/api/charges`);
      }
      const json = await res.json();
      if (json.success && json.charges) {
        setData(json.charges);
      }
    } catch (err: any) {
      console.error("Error fetching charges:", err);
      toast.error("Failed to load platform charges");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharges();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/charges/admin`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setData(json.charges);
        toast.success("Platform charges updated successfully!");
      } else {
        toast.error(json.message || "Failed to update charges");
      }
    } catch (err: any) {
      console.error("Error saving charges:", err);
      toast.error(err.message || "Network error updating charges");
    } finally {
      setSaving(false);
    }
  };

  const updateChitField = (field: string, val: number) => {
    setData((prev) => ({
      ...prev,
      chitFund: {
        ...prev.chitFund,
        [field]: val,
        withdrawCommission:
          field === "processingCharge"
            ? Number((val + prev.chitFund.maintenanceCharge).toFixed(2))
            : field === "maintenanceCharge"
            ? Number((prev.chitFund.processingCharge + val).toFixed(2))
            : prev.chitFund.withdrawCommission,
      },
    }));
  };

  const updateSipField = (field: string, val: number) => {
    setData((prev) => ({
      ...prev,
      sip: {
        ...prev.sip,
        [field]: val,
        withdrawCommission:
          field === "processingCharge"
            ? Number((val + prev.sip.maintenanceCharge).toFixed(2))
            : field === "maintenanceCharge"
            ? Number((prev.sip.processingCharge + val).toFixed(2))
            : prev.sip.withdrawCommission,
      },
    }));
  };

  const updatePlanField = (index: number, field: "processingCharge" | "maintenanceCharge", val: number) => {
    setData((prev) => {
      const plans = [...prev.investmentPlans];
      plans[index] = { ...plans[index], [field]: val };
      return { ...prev, investmentPlans: plans };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border/40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-foreground">Platform Charges & Commission</h2>
            <p className="text-xs font-body text-muted-foreground">
              Configure withdrawal commissions, late payment charges, maintenance fees, and SIP cancellation penalties.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCharges}
            disabled={loading}
            className="rounded-xl h-10 px-3 text-xs font-body"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-xl h-10 px-5 text-xs font-body font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" /> Save All Charges
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Launch Offer 0% Promotional Switch ── */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          data.isPromotionalLaunchOffer
            ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-emerald-500/40"
            : "bg-card border-border/60"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                data.isPromotionalLaunchOffer
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-heading font-bold text-foreground">
                  0% Promotional Launch Offer (Zero Commission Mode)
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    data.isPromotionalLaunchOffer
                      ? "bg-emerald-500 text-white animate-pulse"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {data.isPromotionalLaunchOffer ? "ACTIVE (0% APPLIED)" : "DISABLED (CUSTOM RATES)"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                When active, all mobile users enjoy <strong>0% withdrawal commission</strong>, <strong>0% late payment fees</strong>, and <strong>0% cancellation penalties</strong> during the app launch period. Standard rates below are preserved and will take effect whenever you disable this toggle.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  isPromotionalLaunchOffer: !prev.isPromotionalLaunchOffer,
                }))
              }
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                data.isPromotionalLaunchOffer
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-muted hover:bg-muted/80 text-foreground border border-border"
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              {data.isPromotionalLaunchOffer ? "0% Launch Offer Active" : "Enable 0% Launch Offer"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 1 & 2: Chit Fund & SIP Charges ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chit Fund Card */}
        <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-foreground">Chit Fund Charges</h3>
                <p className="text-[11px] text-muted-foreground">Standard rates from Growvest Charges PDF</p>
              </div>
            </div>
            {data.isPromotionalLaunchOffer && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                Effective: 0%
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Processing Charge (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.chitFund.processingCharge}
                  onChange={(e) => updateChitField("processingCharge", parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Maintenance Charge (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.chitFund.maintenanceCharge}
                  onChange={(e) => updateChitField("maintenanceCharge", parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              Total Withdraw Commission (%) <span className="text-muted-foreground font-normal">(Auto = Processing + Maintenance)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.chitFund.withdrawCommission}
                onChange={(e) => updateChitField("withdrawCommission", parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 pr-8 rounded-xl border border-border/60 bg-background text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Late Payment Charge (% per Day)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.chitFund.latePaymentPerDay}
                onChange={(e) => updateChitField("latePaymentPerDay", parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 pr-14 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%/day</span>
            </div>
          </div>
        </div>

        {/* SIP Card */}
        <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-foreground">SIP Charges</h3>
                <p className="text-[11px] text-muted-foreground">Standard rates from Growvest Charges PDF</p>
              </div>
            </div>
            {data.isPromotionalLaunchOffer && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                Effective: 0%
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Processing Charge (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.sip.processingCharge}
                  onChange={(e) => updateSipField("processingCharge", parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Maintenance Charge (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.sip.maintenanceCharge}
                  onChange={(e) => updateSipField("maintenanceCharge", parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Withdraw Commission (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.sip.withdrawCommission}
                  onChange={(e) => updateSipField("withdrawCommission", parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-border/60 bg-background text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Late Payment (%/Day)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.sip.latePaymentPerDay}
                  onChange={(e) => updateSipField("latePaymentPerDay", parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 pr-12 rounded-xl border border-border/60 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%/d</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              Early Cancel Penalty (%) <span className="text-rose-500 font-semibold">* Shown in user warning popup</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.sip.cancelPenalty}
                onChange={(e) => updateSipField("cancelPenalty", parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 pr-8 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/20 text-sm font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Investment Plans Processing & Maintenance Table ── */}
      <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground">
                Investment Plans Processing & Maintenance Charges
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Tiered charges configured per return plan from PDF
              </p>
            </div>
          </div>
          {data.isPromotionalLaunchOffer && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              Launch Offer: 0.00% Effective
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-xs font-bold text-muted-foreground">
                <th className="py-3 px-3">Investment Plan</th>
                <th className="py-3 px-3">Processing Charge (%)</th>
                <th className="py-3 px-3">Maintenance Charge (%)</th>
                <th className="py-3 px-3">Reason for Charges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-xs">
              {data.investmentPlans.map((plan, idx) => (
                <tr key={plan.planName || idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-foreground">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 mr-2 font-mono">
                      {plan.planReturnPercent}%
                    </span>
                    {plan.planName}
                  </td>
                  <td className="py-3 px-3 w-44">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={plan.processingCharge}
                        onChange={(e) => updatePlanField(idx, "processingCharge", parseFloat(e.target.value) || 0)}
                        className="w-full h-8 px-2.5 pr-6 rounded-lg border border-border/60 bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[11px] text-muted-foreground font-bold">%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 w-44">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={plan.maintenanceCharge}
                        onChange={(e) => updatePlanField(idx, "maintenanceCharge", parseFloat(e.target.value) || 0)}
                        className="w-full h-8 px-2.5 pr-6 rounded-lg border border-border/60 bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[11px] text-muted-foreground font-bold">%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground font-medium">
                    {plan.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
