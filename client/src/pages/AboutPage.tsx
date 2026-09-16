import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle,
  ArrowRight,
  PiggyBank,
  Lock,
  Users,
  Star,
  Repeat,
  Coins,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-24 pb-20">
        {/* Ambient gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-secondary/5 blur-3xl" />
        </div>

        <div className="container max-w-5xl">
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="text-center"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-body font-semibold text-primary mb-6">
                <Star className="h-3 w-3" />
                About Growvest
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight"
            >
              Transparent Investing,{" "}
              <span className="text-primary">Made Simple</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg font-body text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
            >
              Growvest is a trusted investment tracking platform where you invest
              your savings and earn daily interest — verified and managed by our
              team. No hidden fees, no complicated processes.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/invest">
                <Button size="lg" className="rounded-xl font-body font-medium px-8 h-12 group">
                  Start Investing
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="rounded-xl font-body font-medium px-8 h-12">
                  Create Account
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-14 border-y border-border bg-card/40">
        <div className="container max-w-5xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {[
              { label: "Investors", value: "500+", icon: Users },
              { label: "Annual Returns", value: "Up to 12%", icon: TrendingUp },
              { label: "Avg. Approval", value: "< 2 hrs", icon: Clock },
              { label: "Uptime", value: "99.9%", icon: ShieldCheck },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-3">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-heading text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm font-body text-muted-foreground mt-0.5">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── INVESTMENT TYPES ── */}
      <section className="py-20">
        <div className="container max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-secondary/20 bg-secondary/5 text-xs font-body font-semibold text-secondary mb-4">
              <Wallet className="h-3 w-3" />
              Deposit Types
            </span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Choose Your Investment Style
            </h2>
            <p className="text-base font-body text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We offer two deposit types designed to match different financial
              goals — flexible savings or committed fixed returns.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Saving Deposit */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="card-premium p-8 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <PiggyBank className="h-6 w-6 text-primary" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-2xl font-bold text-foreground">Saving Deposit</h3>
                <span className="text-3xl font-heading font-bold text-primary">12%</span>
              </div>
              <p className="text-sm font-body text-muted-foreground font-medium mb-1">per year · calculated daily</p>
              <p className="text-sm font-body text-muted-foreground leading-relaxed mb-6">
                Flexible savings plan where you can invest any amount and
                withdraw at any time. Interest accrues every day from your
                invested balance.
              </p>
              <ul className="space-y-3">
                {[
                  "Withdraw anytime, no lock-in",
                  "Daily interest on your balance",
                  "Start with as little as ₹1",
                  "Interest = (Balance × 12%) / 365 per day",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Fixed Deposit */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="card-premium p-8 relative overflow-hidden group border-secondary/30"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-secondary/10 transition-colors duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-6">
                <Lock className="h-6 w-6 text-secondary" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-2xl font-bold text-foreground">Fixed Deposit</h3>
                <span className="text-3xl font-heading font-bold text-secondary">24%</span>
              </div>
              <p className="text-sm font-body text-muted-foreground font-medium mb-1">per year · calculated daily</p>
              <p className="text-sm font-body text-muted-foreground leading-relaxed mb-6">
                Committed investment plan locked for 1 year with a higher
                return rate. Best suited for those who can set aside funds
                for a defined period.
              </p>
              <ul className="space-y-3">
                {[
                  "Higher return at 24% per year",
                  "Maturity after 1 year",
                  "Daily interest accumulation",
                  "Interest = (Balance × 24%) / 365 per day",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                    <CheckCircle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Systematic Investment Plan (SIP) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="card-premium p-8 relative overflow-hidden group border-emerald-500/30"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <Repeat className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-2xl font-bold text-foreground">Systematic Investment Plan</h3>
                <span className="text-3xl font-heading font-bold text-emerald-600">26%</span>
              </div>
              <p className="text-sm font-body text-muted-foreground font-medium mb-1">up to 26% p.a. · compound growth</p>
              <p className="text-sm font-body text-muted-foreground leading-relaxed mb-6">
                Disciplined wealth building with daily, weekly, or monthly contributions.
                Automated streak tracking, milestone rewards, and compound returns.
              </p>
              <ul className="space-y-3">
                {[
                  "Daily, weekly, or monthly flexible frequencies",
                  "Automated compounding returns up to 26% p.a.",
                  "Micro-installments starting from ₹10",
                  "Track streak milestones & claim completion bonuses",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Chit Funds & Pocket Money */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="card-premium p-8 relative overflow-hidden group border-amber-500/30"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-500/10 transition-colors duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <Coins className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-2xl font-bold text-foreground">Chits & Pocket Money</h3>
                <span className="text-2xl font-heading font-bold text-amber-600">Smart Plans</span>
              </div>
              <p className="text-sm font-body text-muted-foreground font-medium mb-1">community savings & daily cashflow</p>
              <p className="text-sm font-body text-muted-foreground leading-relaxed mb-6">
                Join structured community chit circles for lump sum payouts or activate
                Pocket Money plans for regular daily/weekly earnings.
              </p>
              <ul className="space-y-3">
                {[
                  "Transparent chit fund slots with scheduled contributions",
                  "Guaranteed payouts with live tracking and late-fee grace",
                  "Daily & weekly pocket money payout releases",
                  "Real-time wallet and withdrawal ledger tracking",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                    <CheckCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Interest formula callout */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-6 p-6 rounded-2xl border border-primary/20 bg-primary/5"
          >
            <p className="text-xs font-body font-semibold text-primary uppercase tracking-wider mb-2">
              How Interest Is Calculated
            </p>
            <p className="text-sm font-body text-foreground leading-relaxed">
              Your daily interest is calculated on your <strong>current balance</strong> (not
              just the amount you invested). As your balance grows with accumulated
              interest, your daily earnings increase too —
              compounding automatically over time.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-card border border-border font-mono text-xs text-foreground">
                <span className="text-muted-foreground"># Saving (12%/yr)</span><br />
                Daily = (Balance × 12%) ÷ 365
              </div>
              <div className="p-3 rounded-xl bg-card border border-border font-mono text-xs text-foreground">
                <span className="text-muted-foreground"># Fixed (24%/yr)</span><br />
                Daily = (Balance × 24%) ÷ 365
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-card/30 border-y border-border">
        <div className="container max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center mb-14"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-body font-semibold text-primary mb-4">
              <CheckCircle className="h-3 w-3" />
              Simple Process
            </span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              How Growvest Works
            </h2>
            <p className="text-base font-body text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Four simple steps from registration to earning daily returns on your investment.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Create Account",
                desc: "Register with your name and email. Takes less than a minute.",
                icon: Users,
                color: "bg-blue-50 text-blue-600 border-blue-100",
              },
              {
                step: "02",
                title: "Choose & Invest",
                desc: "Pick Saving (12%) or Fixed (24%) and enter your amount.",
                icon: Wallet,
                color: "bg-primary/5 text-primary border-primary/10",
              },
              {
                step: "03",
                title: "Pay via UPI",
                desc: "Scan the QR code and pay. Our team verifies within 12 hours.",
                icon: CheckCircle,
                color: "bg-amber-50 text-amber-600 border-amber-100",
              },
              {
                step: "04",
                title: "Earn Daily",
                desc: "Watch your balance grow every day with real-time interest tracking.",
                icon: TrendingUp,
                color: "bg-secondary/5 text-secondary border-secondary/10",
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-premium p-6 flex flex-col"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="font-heading text-4xl font-bold text-foreground/10">{s.step}</span>
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm font-body text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY US ── */}
      <section className="py-20">
        <div className="container max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center mb-14"
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Trust Growvest?
            </h2>
            <p className="text-base font-body text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We built Growvest on principles of transparency, simplicity, and fairness.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: "Verified & Secure",
                desc: "Every investment is manually verified by our team before approval. Your funds are safe.",
                color: "bg-accent text-primary border-primary/10",
              },
              {
                icon: TrendingUp,
                title: "Real-Time Tracking",
                desc: "Monitor your balance, daily earnings, and total interest earned from your personal dashboard.",
                color: "bg-secondary/5 text-secondary border-secondary/10",
              },
              {
                icon: Clock,
                title: "Fast Approvals",
                desc: "Payments are reviewed and approved within 12 business hours. No long waiting periods.",
                color: "bg-amber-50 text-amber-600 border-amber-100",
              },
            ].map((w, i) => (
              <motion.div
                key={w.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-premium p-7"
              >
                <div className={`h-11 w-11 rounded-xl border flex items-center justify-center mb-5 ${w.color}`}>
                  <w.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">{w.title}</h3>
                <p className="text-sm font-body text-muted-foreground leading-relaxed">{w.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-foreground">
        <div className="container max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-background mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-base font-body text-background/70 max-w-xl mx-auto leading-relaxed mb-8">
              Join hundreds of investors already growing their wealth with Growvest.
              Start with as little as ₹1.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-xl font-body font-semibold px-10 h-12 group"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/invest">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl font-body font-medium px-10 h-12 border-background/60 bg-background/10 text-background hover:bg-background/20 hover:text-background hover:border-background/80"
                >
                  Invest Now
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;
