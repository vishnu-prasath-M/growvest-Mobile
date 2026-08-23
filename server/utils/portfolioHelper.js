const User = require('../models/User');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const PocketMoney = require('../models/PocketMoney');

/**
 * Single authoritative portfolio calculation service for Growvest.
 *
 * Returns:
 *   balances.totalInvested           — sum of all principal committed (savings + chit paid + pocket money invested)
 *   balances.totalLocked             — sum of all locked (not yet matured / not yet won) principal
 *   balances.dailyInterest           — current per-day interest from active (non-matured, non-withdrawn) savings plans
 *   balances.totalInterestEarned     — accrued interest so far across all active savings plans (dynamic, calculated from elapsed days)
 *   balances.availableToWithdraw     — TRULY withdrawable RIGHT NOW: matured savings + wallet + chit winnings + pocket money released
 *   balances.totalBalance            — totalInvested + totalInterestEarned + walletBalance
 *   balances.pocketMoneyInvested     — total pocket money principal
 *   balances.pocketMoneyReleased     — total pocket money paid out so far (admin approved)
 *   balances.pocketMoneyRemaining    — total pocket money still to be paid out
 *
 * Interest rate rule: all plan rates are ANNUAL (p.a.).
 *   dailyInterest = (principal × rate%) / (100 × 365)
 *   Example: ₹1,000 @ 15% p.a. → 1000 × 0.15 / 365 = ₹0.4109/day
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

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Use start of today for elapsed day calculation

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

    if (isRejected) {
      return { ...inv.toObject(), availableToWithdraw: 0, isMatured: false, isLocked: false };
    }

    // All interest rates are annual (p.a.). Map by plan type.
    let rate = Number(inv.interestRate) || 12;
    let durationDays = Number(inv.durationDays) || 365;
    if (inv.type === '15_days')   { rate = 12;  durationDays = 15;  }
    else if (inv.type === '1_month')  { rate = 15;  durationDays = 30;  }
    else if (inv.type === '3_months') { rate = 18;  durationDays = 90;  }
    else if (inv.type === '6_months') { rate = 20;  durationDays = 180; }
    else if (inv.type === '1_year')   { rate = 24;  durationDays = 365; }

    // Annual rate formula: dailyInterest = (principal × rate/100) / 365
    const dailyInterest = (principal * rate) / 100 / 365;
    const totalInterestForDuration = dailyInterest * durationDays;
    const maturityAmount = principal + totalInterestForDuration;

    // Accrue interest based on elapsed days since startDate (capped at durationDays)
    let accruedInterest = 0;
    if (inv.startDate && !isWithdrawn) {
      const startDay = new Date(inv.startDate);
      startDay.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.min(durationDays, Math.floor((now - startDay) / 86400000)));
      accruedInterest = elapsedDays * dailyInterest;
    }
    // Fall back to stored value if higher (e.g. from previous syncs)
    accruedInterest = Math.max(accruedInterest, Number(inv.interestEarned) || 0);

    // Determine maturity date
    const maturityDate = inv.maturityDate
      ? new Date(inv.maturityDate)
      : new Date(new Date(inv.startDate || Date.now()).getTime() + durationDays * 86400000);
    const isMatured = new Date() >= maturityDate;

    let availableToWithdraw = 0;
    let withdrawalStatus = 'locked';

    if (isWithdrawn) {
      withdrawalStatus = 'withdrawn';
      availableToWithdraw = 0;
      // Withdrawn — counts toward invested but not currently locked
      totalDurationInvested += principal;
    } else if (isMatured) {
      // Matured and not yet withdrawn → fully available
      withdrawalStatus = 'available';
      availableToWithdraw = inv.maturityAmount || maturityAmount;
      maturedWithdrawalAvailable += availableToWithdraw;
      totalDurationInvested += principal;
      totalAccruedInterest += totalInterestForDuration; // Full plan interest earned
    } else {
      // Locked (before maturity)
      withdrawalStatus = 'locked';
      availableToWithdraw = 0;
      totalDurationInvested += principal;
      totalDurationLocked += principal;
      totalDailyInterest += dailyInterest;
      totalAccruedInterest += accruedInterest; // Only elapsed portion
    }

    return {
      ...inv.toObject(),
      interestRate: rate,
      durationDays,
      dailyInterest,
      totalInterest: totalInterestForDuration,
      maturityAmount: inv.maturityAmount || maturityAmount,
      maturityDate,
      accruedInterest,
      availableToWithdraw,
      withdrawalStatus,
      isMatured,
      isLocked: !isMatured && !isWithdrawn,
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
      // Only count what has actually been PAID so far (not future weeks)
      const paidAmt = Number(cm.totalPaid) || (Number(cm.paidWeeks || 0) * Number(cm.weeklyAmount || 0));
      totalChitInvested += paidAmt;
      totalChitLocked += paidAmt; // Chit contributions are locked until auction win

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
  const walletBalance = Number(user.balance) || 0;

  // ─── 5. AGGREGATION ─────────────────────────────────────────────────────────
  const totalInvested = totalDurationInvested + totalChitInvested + pocketMoneyInvested;
  const totalLocked = totalDurationLocked + totalChitLocked + pocketMoneyRemaining;

  // availableToWithdraw = ONLY amounts actually withdrawable RIGHT NOW
  // = matured savings payouts + wallet balance + chit winnings + pocket money already released by admin
  const availableToWithdraw = maturedWithdrawalAvailable + walletBalance + chitWithdrawalAvailable + pocketMoneyReleased;

  // totalBalance = everything the user has committed + what they've earned so far
  const totalBalance = totalInvested + totalAccruedInterest + walletBalance;

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
      availableToWithdraw,         // Real withdrawable amount (matured + wallet + winnings)
      maturedAvailableOnly: maturedWithdrawalAvailable,
      walletBalance,
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
      activeInvestmentsCount: enrichedInvestments.filter(i => i.status === 'approved' && i.withdrawalStatus !== 'withdrawn').length + activeChitsCount + pocketMonies.filter(pm => pm.status === 'active').length,
      activeChitsCount,
      activePocketMoneyCount: pocketMonies.filter(pm => pm.status === 'active').length,
    },
    investments: enrichedInvestments,
    chitMemberships,
    pocketMonies,
  };
}

module.exports = { getUserPortfolioSummary };
