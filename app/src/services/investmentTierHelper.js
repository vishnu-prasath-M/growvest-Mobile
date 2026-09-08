/**
 * Frontend Investment Tier Helper for Growvest
 * Matches server/services/investmentTierService.js formulas and tier structure.
 */

export const INVESTMENT_PLANS = [
  { id: '15_days', name: '15 Days Plan', durationDays: 15, interestRate: 12, label: '15 Days', desc: 'Locked for 15 days, 12% returns', icon: 'clock-outline' },
  { id: '1_month', name: '1 Month Plan', durationDays: 30, interestRate: 15, label: '1 Month', desc: 'Locked for 30 days, 15% returns', icon: 'calendar' },
  { id: '3_months', name: '3 Months Plan', durationDays: 90, interestRate: 18, label: '3 Months', desc: 'Locked for 90 days, 18% returns', icon: 'calendar-range' },
  { id: '6_months', name: '6 Months Plan', durationDays: 180, interestRate: 20, label: '6 Months', desc: 'Locked for 180 days, 20% returns', icon: 'calendar-clock' },
  { id: '1_year', name: '1 Year Plan', durationDays: 365, interestRate: 24, label: '1 Year', desc: 'Locked for 365 days, 24% returns', icon: 'lock' },
];

export const DURATION_TIERS = [
  { minDays: 1, maxDays: 14, rate: 6, tierId: 'early_6', name: 'Early Duration (<15 Days)', desc: 'Below 15-day tier: qualifies for 6% p.a. early-duration rate' },
  { minDays: 15, maxDays: 29, rate: 12, tierId: '15_days', name: '15 Days Tier', desc: 'Eligible for the 15-day tier (12% p.a.)' },
  { minDays: 30, maxDays: 89, rate: 15, tierId: '1_month', name: '1 Month Tier', desc: 'Eligible for the 1-month tier (15% p.a.)' },
  { minDays: 90, maxDays: 179, rate: 18, tierId: '3_months', name: '3 Months Tier', desc: 'Eligible for the 3-month tier (18% p.a.)' },
  { minDays: 180, maxDays: 364, rate: 20, tierId: '6_months', name: '6 Months Tier', desc: 'Eligible for the 6-month tier (20% p.a.)' },
  { minDays: 365, maxDays: Infinity, rate: 24, tierId: '1_year', name: '1 Year Tier', desc: 'Eligible for the 1-year tier (24% p.a.)' },
];

/**
 * Calculates investment tier, applicable rate, prorated interest, and expected payout.
 */
export function calculateInvestmentTier({
  planType,
  amount,
  principal: principalInput,
  startDate,
  intendedWithdrawalDate,
  customDays,
  plansConfig,
}) {
  let normalizedPlan = planType || '15_days';
  if (normalizedPlan === 'fixed') normalizedPlan = '1_year';
  if (normalizedPlan === 'saving') normalizedPlan = '15_days';

  const plansList = plansConfig && Array.isArray(plansConfig) && plansConfig.length > 0 ? plansConfig : INVESTMENT_PLANS;
  const plan = plansList.find((p) => p.id === normalizedPlan) || plansList[0] || INVESTMENT_PLANS[0];
  const maxPlanDays = plan.durationDays;
  const maxPlanRate = plan.interestRate;

  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  let eligibleDays = maxPlanDays;
  let targetDate = new Date(start.getTime() + maxPlanDays * 24 * 60 * 60 * 1000);

  if (customDays !== undefined && customDays !== null && !isNaN(Number(customDays))) {
    eligibleDays = Math.max(1, Number(customDays));
    targetDate = new Date(start.getTime() + eligibleDays * 24 * 60 * 60 * 1000);
  } else if (intendedWithdrawalDate) {
    const d = new Date(intendedWithdrawalDate);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      const diffTime = d.getTime() - start.getTime();
      eligibleDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
      targetDate = d;
    }
  }

  // Find matching tier
  let matchedTier = DURATION_TIERS[0];
  for (const tier of DURATION_TIERS) {
    if (eligibleDays >= tier.minDays && eligibleDays <= tier.maxDays) {
      matchedTier = tier;
      break;
    }
  }

  // Enforce Rate Cap: Applicable Rate <= Selected Plan Rate
  const applicableInterestRate = Math.min(matchedTier.rate, maxPlanRate);
  const isCapped = matchedTier.rate > maxPlanRate;
  const isFullMaturity = eligibleDays >= maxPlanDays;

  let tierExplanation = '';
  if (isFullMaturity) {
    tierExplanation = `Full maturity for ${plan.name} (${applicableInterestRate}% p.a.)`;
  } else if (isCapped) {
    tierExplanation = `Rate capped at ${applicableInterestRate}% p.a. as per selected ${plan.name}`;
  } else if (matchedTier.tierId === 'early_6') {
    tierExplanation = 'Below 15-day tier: qualifies for 6% p.a. early-duration rate';
  } else {
    tierExplanation = matchedTier.desc;
  }

  const principal = Math.max(0, Number(amount != null ? amount : principalInput) || 0);
  const dailyInterest = (principal * applicableInterestRate) / (100 * 365);
  const calculatedInterest = Number(((principal * applicableInterestRate * eligibleDays) / (100 * 365)).toFixed(2));
  const expectedPayout = Number((principal + calculatedInterest).toFixed(2));

  return {
    planId: plan.id,
    planName: plan.name,
    maxPlanDays,
    maxPlanRate,
    startDate: start,
    intendedWithdrawalDate: targetDate,
    selectedWithdrawalDate: targetDate,
    maturityDate: targetDate,
    eligibleHoldingDays: eligibleDays,
    durationDays: eligibleDays,
    applicableRate: applicableInterestRate,
    applicableInterestRate,
    interestRate: applicableInterestRate,
    applicableInterestTier: matchedTier.tierId,
    tierId: matchedTier.tierId,
    tierName: matchedTier.name,
    tierReason: tierExplanation,
    tierExplanation,
    isFullMaturity,
    isEarly: !isFullMaturity,
    isEarlyExit: !isFullMaturity,
    principal,
    amount: principal,
    dailyInterest,
    calculatedInterest,
    totalInterest: calculatedInterest,
    expectedPayout,
    maturityAmount: expectedPayout,
  };
}
