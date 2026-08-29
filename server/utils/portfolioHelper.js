const User = require('../models/User');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const PocketMoney = require('../models/PocketMoney');

/**
 * Single authoritative portfolio calculation service for Growvest.
 *
 * ─── FINANCIAL MODEL ────────────────────────────────────────────────────────
 *
 *  user.balance (walletBalance)
 *    = liquid cash ONLY — credited when:
 *        (a) a matured investment is withdrawn  → +maturityAmount
 *        (b) admin approves a withdrawal request  (NOT when investment is approved)
 *        (c) pocket money payout is released  → +payoutAmount
 *    NOT incremented when an investment is created/approved (money is LOCKED).
 *
 *  totalInvested  = sum of all principal committed to savings, chit, pocket money
 *                   (includes locked + not-yet-withdrawn matured)
 *
 *  totalBalance   = totalInvested + totalAccruedInterest + walletBalance
 *    walletBalance here is ONLY liquid cash from maturities / payouts already withdrawn
 *    (should NOT double-count active investment principal)
 *
 *  availableToWithdraw  = TRULY liquid right now:
 *      = matured investments (not yet withdrawn) + walletBalance + chit winnings + pocket money released
 *
 * ─── INTEREST FORMULA ───────────────────────────────────────────────────────
 *  All plan rates are ANNUAL (p.a.).
 *  dailyInterest = (principal × rate%) / (100 × 365)
 *  Example: ₹1,000 @ 15% p.a. → 1000 × 0.15 / 365 = ₹0.4109/day
 */
async function getUserPortfolioSummary(userIdInput) {
  const user = await User.findById(userIdInput).select('-password');
  if (!user) return null;

  const nowDate = new Date();
  const nowMidnight = new Date(nowDate);
  nowMidnight.setHours(0, 0, 0, 0);

  // userId is used by chit fund and pocket money queries below
  const userId = user._id;

  const userOrConditions = [{ userId: user._id }];
  if (user._id) userOrConditions.push({ userId: user._id.toString() });
  if (user.email && typeof user.email === 'string' && user.email.trim() !== '' && !user.email.includes('no-email@') && user.email !== 'undefined') {
    userOrConditions.push({ userEmail: new RegExp(`^${user.email.trim()}$`, 'i') });
  }
  if (user.mobileNumber && typeof user.mobileNumber === 'string' && user.mobileNumber.trim() !== '' && user.mobileNumber.trim() !== '0000000000' && user.mobileNumber.trim() !== '1234567890' && user.mobileNumber !== 'undefined') {
    userOrConditions.push({ mobileNumber: user.mobileNumber.trim() });
  }

  // ─── 1. SAVINGS / FIXED DURATION INVESTMENTS ────────────────────────────────
  const investments = await Investment.find({ $or: userOrConditions });

  let totalDurationInvested = 0;
  let totalDurationLocked = 0;
  let totalDailyInterest = 0;
  let totalAccruedInterest = 0;
  let maturedWithdrawalAvailable = 0;

  const enrichedInvestments = investments.map(inv => {
    const principal = Number(inv.amount) || 0;
    const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
    const isRejected = inv.status === 'rejected';
    const isPending = inv.status === 'pending';

    if (isRejected) {
      return { ...inv.toObject(), availableToWithdraw: 0, isMatured: false, isLocked: false };
    }

    // ── Interest rate & duration by plan type (all p.a.) ──
    let rate = Number(inv.interestRate) || 12;
    let durationDays = Number(inv.durationDays) || 365;
    if (inv.type === '15_days')   { rate = 12;  durationDays = 15;  }
    else if (inv.type === '1_month')  { rate = 15;  durationDays = 30;  }
    else if (inv.type === '3_months') { rate = 18;  durationDays = 90;  }
    else if (inv.type === '6_months') { rate = 20;  durationDays = 180; }
    else if (inv.type === '1_year')   { rate = 24;  durationDays = 365; }
    else if (inv.type === 'saving')   { rate = 12;  durationDays = 365; }
    else if (inv.type === 'fixed')    { rate = 24;  durationDays = 365; }

    const dailyInterest = (principal * rate) / 100 / 365;
    const totalInterestForDuration = dailyInterest * durationDays;
    const maturityAmount = inv.maturityAmount || (principal + totalInterestForDuration);

    // Maturity date
    const maturityDate = inv.maturityDate
      ? new Date(inv.maturityDate)
      : new Date((inv.startDate ? new Date(inv.startDate) : new Date()).getTime() + durationDays * 86400000);

    const isMatured = !isPending && !isWithdrawn && nowDate >= maturityDate;

    // Accrue interest from startDate to today (capped at durationDays)
    let accruedInterest = 0;
    if (inv.startDate && !isWithdrawn && !isPending) {
      const startDay = new Date(inv.startDate);
      startDay.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.min(durationDays, Math.floor((nowMidnight - startDay) / 86400000)));
      accruedInterest = elapsedDays * dailyInterest;
    }
    accruedInterest = Math.max(accruedInterest, Number(inv.interestEarned) || 0);

    // 5-week benefit eligibility date calculation (35 days from startDate)
    const startDateObj = inv.startDate ? new Date(inv.startDate) : new Date();
    const benefitEligibilityDate = inv.benefitEligibilityDate
      ? new Date(inv.benefitEligibilityDate)
      : new Date(startDateObj.getTime() + 35 * 24 * 60 * 60 * 1000);
    benefitEligibilityDate.setHours(0, 0, 0, 0);

    const fifthWeekCompleted = inv.fifthWeekPaymentCompleted !== false;
    const isEligibleForFullBenefits = !isPending && !isWithdrawn && nowDate >= benefitEligibilityDate && fifthWeekCompleted;

    const extraBenefits = Number(inv.benefits) || 0;
    const fullBenefitAmount = principal + accruedInterest + extraBenefits;
    const earlyPrincipalOnlyAmount = principal;

    let availableToWithdraw = 0;
    let withdrawalStatus = 'locked';

    if (isWithdrawn) {
      withdrawalStatus = 'withdrawn';
      availableToWithdraw = 0;
    } else if (isEligibleForFullBenefits) {
      withdrawalStatus = 'available_full';
      availableToWithdraw = fullBenefitAmount;
      maturedWithdrawalAvailable += fullBenefitAmount;
      totalDurationInvested += principal;
      totalAccruedInterest += accruedInterest;
    } else if (!isPending) {
      // Early withdrawal before 5th week: Principal ONLY available
      withdrawalStatus = 'available_early_principal';
      availableToWithdraw = earlyPrincipalOnlyAmount;
      maturedWithdrawalAvailable += earlyPrincipalOnlyAmount;
      totalDurationInvested += principal;
      totalDurationLocked += principal;
      totalDailyInterest += dailyInterest;
      totalAccruedInterest += accruedInterest;
    }

    return {
      ...inv.toObject(),
      interestRate: rate,
      durationDays,
      dailyInterest,
      totalInterest: totalInterestForDuration,
      maturityAmount,
      maturityDate,
      benefitEligibilityDate,
      selectedWithdrawalDate: inv.selectedWithdrawalDate || maturityDate,
      isEligibleForFullBenefits,
      earlyPrincipalOnlyAmount,
      fullBenefitAmount,
      lockedInterestAndBenefits: isEligibleForFullBenefits ? 0 : accruedInterest + extraBenefits,
      accruedInterest,
      availableToWithdraw,
      withdrawalStatus,
      isMatured,
      isLocked: !isMatured && !isWithdrawn && !isPending,
      lockUnlockDate: benefitEligibilityDate.toISOString(),
    };
  });

  // ─── 2. CHIT FUND MEMBERSHIPS ────────────────────────────────────────────────
  const chitMemberships = await ChitMember.find({ userId, status: { $ne: 'cancelled' } }).populate('chitId');

  let totalChitInvested = 0;
  let totalChitLocked = 0;
  let totalChitWinningAmount = 0;
  let chitWithdrawalAvailable = 0;
  let activeChitsCount = 0;

  chitMemberships.forEach(cm => {
    if (cm.status === 'active' || cm.status === 'approved') {
      activeChitsCount++;
      const paidAmt = Number(cm.totalPaid) || (Number(cm.paidWeeks || 0) * Number(cm.weeklyAmount || 0));
      totalChitInvested += paidAmt;
      totalChitLocked += paidAmt;

      if (cm.hasWon) {
        const winning = Number(cm.winningAmount) || 0;
        totalChitWinningAmount += winning;
        if (cm.withdrawalStatus !== 'completed') {
          chitWithdrawalAvailable += winning;
        }
      }
    }
  });

  // ─── 3. POCKET MONEY INVESTMENTS ────────────────────────────────────────────
  const pocketMonies = await PocketMoney.find({ userId });

  let pocketMoneyInvested = 0;
  let pocketMoneyReleased = 0;
  let pocketMoneyRemaining = 0;

  pocketMonies.forEach(pm => {
    if (pm.status === 'active' || pm.status === 'completed') {
      pocketMoneyInvested += Number(pm.investedAmount) || 0;
      pocketMoneyReleased += Number(pm.totalPaidOut) || 0;
      pocketMoneyRemaining += Number(pm.remainingAmount) || 0;
    }
  });

  // ─── 4. WALLET BALANCE ───────────────────────────────────────────────────────
  // user.balance is ONLY liquid cash (from maturity withdrawals, not from investment approval)
  // If the old code incorrectly credited user.balance on approval, those records will
  // show inflated wallet. The correct fix is to NOT add walletBalance to totalBalance.
  // walletBalance is used ONLY for availableToWithdraw.
  const walletBalance = Number(user.balance) || 0;

  // ─── 5. AGGREGATION ─────────────────────────────────────────────────────────
  // Current active pocket money holding is pocketMoneyRemaining (active principal remaining to be released)
  const totalInvested = totalDurationInvested + totalChitInvested + pocketMoneyRemaining;
  const totalLocked = totalDurationLocked + totalChitLocked + pocketMoneyRemaining;

  // totalBalance = what the user currently has invested + accrued interest
  const totalBalance = totalInvested + totalAccruedInterest;

  // availableToWithdraw = truly liquid right now in app (matured deposits + wallet cash + chit auction winnings)
  // NOTE: pocketMoneyReleased is NOT included because Pocket Money payouts are paid directly to the user by Admin.
  const availableToWithdraw = maturedWithdrawalAvailable + walletBalance + chitWithdrawalAvailable;

  // Next unlock date — earliest maturity date among locked investments
  const lockedInvestments = enrichedInvestments.filter(i => i.isLocked && i.maturityDate);
  let nextUnlockDate = null;
  if (lockedInvestments.length > 0) {
    const sorted = lockedInvestments.slice().sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate));
    nextUnlockDate = sorted[0].maturityDate;
  }

  return {
    user: {
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      balance: walletBalance,
    },
    balances: {
      totalBalance,
      totalInvested,
      totalLocked,
      dailyInterest: totalDailyInterest,
      totalInterestEarned: totalAccruedInterest,
      totalEarned: totalAccruedInterest,
      totalInterest: totalAccruedInterest,
      pocketMoneyRemaining,
      pocketMoneyInvested,
      pocketMoneyReleased,
      availableToWithdraw,
      maturedAvailableOnly: maturedWithdrawalAvailable,
      walletBalance,
      nextUnlockDate,   // ISO string of next investment maturity date
      // Chit breakdowns
      totalChitInvested,
      totalChitWinningAmount,
      chitWithdrawalAvailable,
      // Pocket Money breakdowns
      pocketMoneyInvested,
      pocketMoneyReleased,
      pocketMoneyRemaining,
    },
    stats: {
      totalInvestments: enrichedInvestments.filter(i => i.status === 'approved').length + activeChitsCount + pocketMonies.filter(pm => pm.status === 'active').length,
      activeInvestmentsCount: enrichedInvestments.filter(i => !['rejected', 'withdrawn'].includes(i.status)).length + activeChitsCount + pocketMonies.filter(pm => pm.status === 'active').length,
      activeChitsCount,
      activePocketMoneyCount: pocketMonies.filter(pm => pm.status === 'active').length,
    },
    investments: enrichedInvestments,
    chitMemberships,
    pocketMonies,
  };
}

module.exports = { getUserPortfolioSummary };
