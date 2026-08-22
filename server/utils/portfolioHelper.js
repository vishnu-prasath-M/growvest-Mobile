const User = require('../models/User');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const Withdrawal = require('../models/Withdrawal');

/**
 * Single authoritative portfolio calculation service for Growvest
 * Calculates exact database-backed financial metrics for a user:
 * - totalInvested: Sum of duration plan principals + active chit paid contributions
 * - totalLocked: Sum of non-matured duration plan principals + active chit paid contributions
 * - dailyInterest: Sum of per-day interest earnings across active duration plans
 * - totalInterestEarned: Sum of accrued interest across duration plans
 * - availableToWithdraw: Payout of matured non-withdrawn plans + won chit payouts + wallet balance
 * - totalBalance: totalInvested + totalInterestEarned + walletBalance + totalChitWinningAmount
 */
async function getUserPortfolioSummary(userIdInput) {
  const user = await User.findById(userIdInput).select('-password');
  if (!user) return null;

  const userId = user._id;

  // Build robust OR conditions to match all user investments
  const userOrConditions = [{ userId }];
  if (user.email && String(user.email).trim() !== '' && user.email !== 'undefined') {
    userOrConditions.push({ userEmail: new RegExp(`^${String(user.email).trim()}$`, 'i') });
  }
  if (user.mobileNumber && String(user.mobileNumber).trim() !== '' && user.mobileNumber !== 'undefined') {
    userOrConditions.push({ mobileNumber: String(user.mobileNumber).trim() });
  }

  // 1. Fetch User Investments
  const investments = await Investment.find({ $or: userOrConditions });

  let totalDurationInvested = 0;
  let totalDurationLocked = 0;
  let totalDailyInterest = 0;
  let totalAccruedInterest = 0;
  let totalMaturityInterest = 0;
  let maturedWithdrawalAvailable = 0;

  const now = new Date();

  const enrichedInvestments = investments.map(inv => {
    const principal = Number(inv.amount) || 0;
    const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
    const isRejected = inv.status === 'rejected';

    if (isRejected) {
      return { ...inv.toObject(), availableToWithdraw: 0, isMatured: false, isLocked: false };
    }

    // Default rate & duration by plan type
    let rate = inv.interestRate || 12;
    let durationDays = inv.durationDays || 365;
    if (inv.type === '15_days') { rate = 12; durationDays = 15; }
    else if (inv.type === '1_month') { rate = 15; durationDays = 30; }
    else if (inv.type === '3_months') { rate = 18; durationDays = 90; }
    else if (inv.type === '6_months') { rate = 20; durationDays = 180; }
    else if (inv.type === '1_year') { rate = 24; durationDays = 365; }

    // Interest calculations (Requirement 7, 8, 9)
    const totalInterest = (principal * rate) / 100;
    const dailyInterest = durationDays > 0 ? (totalInterest / durationDays) : 0;
    const maturityAmount = principal + totalInterest;

    // Elapsed days interest accrued so far
    let accruedInterest = inv.interestEarned || 0;
    if (inv.startDate && !isWithdrawn) {
      const startDate = new Date(inv.startDate);
      startDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.min(durationDays, Math.floor((today - startDate) / (1000 * 60 * 60 * 24))));
      accruedInterest = elapsedDays * dailyInterest;
    }

    // Maturity check (Requirement 5 & 6)
    const maturityDate = inv.maturityDate ? new Date(inv.maturityDate) : new Date(new Date(inv.startDate).getTime() + durationDays * 24 * 60 * 60 * 1000);
    const isMatured = now >= maturityDate;

    let availableToWithdraw = 0;
    let withdrawalStatus = 'locked';

    if (isWithdrawn) {
      withdrawalStatus = 'withdrawn';
      availableToWithdraw = 0;
    } else if (isMatured) {
      withdrawalStatus = 'available';
      availableToWithdraw = inv.maturityAmount || maturityAmount;
      maturedWithdrawalAvailable += availableToWithdraw;
      totalDurationInvested += principal;
      totalAccruedInterest += totalInterest;
    } else {
      // Locked investment (before maturity date)
      withdrawalStatus = 'locked';
      availableToWithdraw = 0;
      totalDurationInvested += principal;
      totalDurationLocked += principal;
      totalDailyInterest += dailyInterest;
      totalAccruedInterest += accruedInterest;
    }
    totalMaturityInterest += totalInterest;

    return {
      ...inv.toObject(),
      interestRate: rate,
      durationDays,
      dailyInterest,
      totalInterest,
      maturityAmount: inv.maturityAmount || maturityAmount,
      maturityDate,
      accruedInterest,
      availableToWithdraw,
      withdrawalStatus,
      isMatured,
      isLocked: !isMatured && !isWithdrawn,
    };
  });

  // 2. Fetch User Chit Memberships
  const chitMemberships = await ChitMember.find({ userId, status: { $ne: 'cancelled' } }).populate('chitId');

  let totalChitInvested = 0;
  let totalChitLocked = 0;
  let totalChitWinningAmount = 0;
  let chitWithdrawalAvailable = 0;
  let activeChitsCount = 0;

  chitMemberships.forEach(cm => {
    if (cm.status === 'active' || cm.status === 'approved') {
      activeChitsCount++;
      const paidAmt = Number(cm.totalPaid) || ((cm.paidWeeks || 1) * (cm.weeklyAmount || 0));
      totalChitInvested += paidAmt;
      totalChitLocked += paidAmt;

      if (cm.hasWon || cm.withdrawalStatus === 'completed') {
        const winning = Number(cm.winningAmount) || Number(cm.withdrawalAmount) || 0;
        totalChitWinningAmount += winning;
        if (cm.withdrawalStatus !== 'completed') {
          chitWithdrawalAvailable += winning;
        }
      }
    }
  });

  // 3. User Wallet Balance
  const walletBalance = Number(user.balance) || 0;

  // 4. Final Aggregations (Requirement 1, 2, 3, 24)
  const totalInvested = totalDurationInvested + totalChitInvested;
  const totalLocked = totalDurationLocked + totalChitLocked;
  const availableToWithdraw = maturedWithdrawalAvailable + chitWithdrawalAvailable + walletBalance;
  const totalBalance = totalInvested + totalAccruedInterest + walletBalance + totalChitWinningAmount;

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
      availableToWithdraw,
      maturedAmount: maturedWithdrawalAvailable,
      walletBalance,
      totalChitWinningAmount,
      savingBalance: availableToWithdraw,
      fixedBalance: 0,
      totalInterest: totalAccruedInterest,
    },
    stats: {
      totalInvestments: enrichedInvestments.filter(i => i.status === 'approved').length + activeChitsCount,
      activeInvestmentsCount: enrichedInvestments.filter(i => i.status === 'approved' && i.withdrawalStatus !== 'withdrawn').length + activeChitsCount,
      activeChitsCount,
    },
    investments: enrichedInvestments,
    chitMemberships,
  };
}

module.exports = { getUserPortfolioSummary };
