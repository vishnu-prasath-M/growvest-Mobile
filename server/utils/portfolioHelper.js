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

  const userId = user._id;

  // Build OR conditions to match user across all investment records
  const userOrConditions = [{ userId }];
  if (user.email && String(user.email).trim() !== '' && user.email !== 'undefined') {
    userOrConditions.push({ userEmail: new RegExp(`^${String(user.email).trim()}$`, 'i') });
  }
  if (user.mobileNumber && String(user.mobileNumber).trim() !== '' && user.mobileNumber !== 'undefined') {
    userOrConditions.push({ mobileNumber: String(user.mobileNumber).trim() });
  }

  const nowDate = new Date();
  // Normalise to midnight for consistent elapsed-day calculation
  const nowMidnight = new Date(nowDate);
  nowMidnight.setHours(0, 0, 0, 0);

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

    let availableToWithdraw = 0;
    let withdrawalStatus = 'locked';

    if (isWithdrawn) {
      withdrawalStatus = 'withdrawn';
      availableToWithdraw = 0;
      // Withdrawn investment is no longer active — don't count in totalDurationInvested
      // (its maturity amount is already in user.balance)
    } else if (isMatured) {
      withdrawalStatus = 'available';
      availableToWithdraw = maturityAmount;
      maturedWithdrawalAvailable += maturityAmount;
      totalDurationInvested += principal;
      totalAccruedInterest += totalInterestForDuration;
    } else if (!isPending) {
      withdrawalStatus = 'locked';
      availableToWithdraw = 0;
      totalDurationInvested += principal;
      totalDurationLocked += principal;
      totalDailyInterest += dailyInterest;
      totalAccruedInterest += accruedInterest;
    }
    // pending — don't count in any total until approved

    return {
      ...inv.toObject(),
      interestRate: rate,
      durationDays,
      dailyInterest,
      totalInterest: totalInterestForDuration,
      maturityAmount,
      maturityDate,
      accruedInterest,
      availableToWithdraw,
      withdrawalStatus,
      isMatured,
      isLocked: !isMatured && !isWithdrawn && !isPending,
      lockUnlockDate: maturityDate.toISOString(),
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
  const totalInvested = totalDurationInvested + totalChitInvested + pocketMoneyInvested;
  const totalLocked = totalDurationLocked + totalChitLocked + pocketMoneyRemaining;

  // totalBalance = what the user has committed + accrued interest
  // NOTE: Do NOT add walletBalance here — walletBalance from investment approval is
  // already reflected in totalDurationInvested (double-counting guard).
  // walletBalance from maturity withdrawals is separate liquid cash — add it ONLY
  // if user.balance does NOT overlap with active investment principal.
  // Safest: exclude walletBalance from totalBalance entirely (it's in availableToWithdraw).
  const totalBalance = totalInvested + totalAccruedInterest;

  // availableToWithdraw = truly liquid right now
  const availableToWithdraw = maturedWithdrawalAvailable + walletBalance + chitWithdrawalAvailable + pocketMoneyReleased;

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
