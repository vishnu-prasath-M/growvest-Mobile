const User = require('../models/User');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const Chit = require('../models/Chit');
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

  // ─── 1. WITHDRAWALS LOOKUP ────────────────────────────────────────────────
  const Withdrawal = require('../models/Withdrawal');
  const userWithdrawals = await Withdrawal.find({
    $or: userOrConditions,
    status: { $in: ['pending', 'approved', 'paid'] },
  });

  const paidOrApprovedInvIds = new Set();
  const pendingInvIds = new Set();
  let generalPendingAmount = 0;

  userWithdrawals.forEach(w => {
    const invId = w.investmentId ? w.investmentId.toString() : null;
    if (w.status === 'paid' || w.status === 'approved') {
      if (invId) paidOrApprovedInvIds.add(invId);
    } else if (w.status === 'pending') {
      if (invId) {
        pendingInvIds.add(invId);
      } else {
        generalPendingAmount += Number(w.amount) || 0;
      }
    }
  });

  // ─── 2. SAVINGS / FIXED DURATION INVESTMENTS ────────────────────────────────
  const investments = await Investment.find({ $or: userOrConditions });

  let totalDurationInvested = 0;
  let totalDurationLocked = 0;
  let totalDailyInterest = 0;
  let totalAccruedInterest = 0;
  let maturedWithdrawalAvailable = 0;

  const enrichedInvestments = investments.map(inv => {
    const principal = Number(inv.amount) || 0;
    const invIdStr = inv._id ? inv._id.toString() : '';
    const isPaidOut = paidOrApprovedInvIds.has(invIdStr);
    const hasPendingWithdrawal = pendingInvIds.has(invIdStr) || inv.withdrawalStatus === 'pending';
    const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn' || isPaidOut;
    const isReinvested = inv.status === 'reinvested' || inv.withdrawalStatus === 'reinvested';
    const isClosed = isWithdrawn || isReinvested;
    const isRejected = inv.status === 'rejected';
    const isPending = inv.status === 'pending';

    if (isRejected) {
      return { ...inv.toObject(), availableToWithdraw: 0, isMatured: false, isLocked: false };
    }

    // ── Interest rate & duration by plan type (all p.a.) ──
    let rate = Number(inv.applicableInterestRate) || Number(inv.interestRate);
    let durationDays = Math.max(2, Number(inv.eligibleHoldingDays) || Number(inv.durationDays) || 15);
    if (!rate) {
      if (inv.type === '15_days')   { rate = 12;  durationDays = Math.max(durationDays, 15);  }
      else if (inv.type === '1_month')  { rate = 15;  durationDays = Math.max(durationDays, 30);  }
      else if (inv.type === '3_months') { rate = 18;  durationDays = Math.max(durationDays, 90);  }
      else if (inv.type === '6_months') { rate = 20;  durationDays = Math.max(durationDays, 180); }
      else if (inv.type === '1_year')   { rate = 24;  durationDays = Math.max(durationDays, 365); }
      else if (inv.type === 'saving')   { rate = 12;  durationDays = Math.max(durationDays, 15); }
      else if (inv.type === 'fixed')    { rate = 24;  durationDays = Math.max(durationDays, 365); }
      else { rate = 12; }
    }

    const dailyInterest = (principal * rate) / 100 / 365;
    const totalInterestForDuration = Number(inv.calculatedInterest) || (dailyInterest * durationDays);
    const maturityAmount = inv.expectedPayout || inv.maturityAmount || (principal + totalInterestForDuration);

    const startDay = inv.startDate ? new Date(inv.startDate) : new Date();
    startDay.setHours(0, 0, 0, 0);

    // Rule: Same calendar day of investment/reinvestment has 0 interest & cannot mature
    const isSameDay = nowMidnight.getTime() <= startDay.getTime();
    const minUnlockTime = startDay.getTime() + 2 * 86400000; // Minimum 2 full days

    // Maturity date (full plan completion)
    let maturityDate = inv.maturityDate
      ? new Date(inv.maturityDate)
      : new Date(startDay.getTime() + durationDays * 86400000);
    maturityDate.setHours(0, 0, 0, 0);
    if (maturityDate.getTime() < minUnlockTime) {
      maturityDate = new Date(minUnlockTime);
    }

    // Intended withdrawal date (user-picked custom date, minimum 2 days)
    let intendedWithdrawalDate = inv.intendedWithdrawalDate
      ? new Date(inv.intendedWithdrawalDate)
      : (inv.selectedWithdrawalDate ? new Date(inv.selectedWithdrawalDate) : maturityDate);
    intendedWithdrawalDate.setHours(0, 0, 0, 0);
    if (intendedWithdrawalDate.getTime() < minUnlockTime) {
      intendedWithdrawalDate = new Date(minUnlockTime);
    }

    // Maturity Lock Guard: CANNOT mature on the same day as startDate or before minimum 2 days
    const unlockDate = intendedWithdrawalDate < maturityDate ? intendedWithdrawalDate : maturityDate;
    const isMatured = !isPending && !isClosed && !isSameDay && (nowDate >= unlockDate);
    const isUnlocked = isMatured;

    // Accrue interest from startDate to today (strictly starts after first midnight / next day; 0 on same day)
    let accruedInterest = 0;
    if (inv.startDate && !isClosed && !isPending && !isSameDay) {
      const elapsedDays = Math.max(0, Math.min(durationDays, Math.floor((nowMidnight - startDay) / 86400000)));
      accruedInterest = elapsedDays * dailyInterest;
      accruedInterest = Math.max(accruedInterest, Number(inv.interestEarned) || 0);
    }
    if (isMatured) {
      accruedInterest = Math.max(accruedInterest, totalInterestForDuration);
    }

    const extraBenefits = Number(inv.benefits) || 0;
    const fullBenefitAmount = principal + (isMatured ? totalInterestForDuration : accruedInterest) + extraBenefits;
    const earlyPrincipalOnlyAmount = principal;

    let availableToWithdraw = 0;
    let withdrawalStatus = 'locked';

    if (isWithdrawn) {
      withdrawalStatus = 'withdrawn';
      availableToWithdraw = 0;
    } else if (isReinvested) {
      withdrawalStatus = 'reinvested';
      availableToWithdraw = 0;
    } else if (hasPendingWithdrawal) {
      withdrawalStatus = 'pending';
      availableToWithdraw = 0;
      totalDurationInvested += principal;
      totalAccruedInterest += totalInterestForDuration;
    } else if (isMatured) {
      // MATURITY REACHED: Principal + Interest + Benefits available
      withdrawalStatus = 'available_full';
      availableToWithdraw = fullBenefitAmount;
      maturedWithdrawalAvailable += fullBenefitAmount;
      totalDurationInvested += principal;
      totalAccruedInterest += totalInterestForDuration;
    } else {
      // LOCKED until chosen intended withdrawal date / maturity date
      withdrawalStatus = 'locked';
      availableToWithdraw = 0;
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
      intendedWithdrawalDate,
      selectedWithdrawalDate: intendedWithdrawalDate,
      isEligibleForFullBenefits: isMatured,
      earlyPrincipalOnlyAmount,
      fullBenefitAmount,
      lockedInterestAndBenefits: isMatured ? 0 : accruedInterest + extraBenefits,
      accruedInterest,
      availableToWithdraw,
      withdrawalStatus,
      isMatured,
      isUnlocked,
      isLocked: !isWithdrawn && !isPending && !isUnlocked,
      lockUnlockDate: intendedWithdrawalDate.toISOString(),
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
    if (cm.status === 'active' || cm.status === 'approved' || cm.status === 'completed') {
      activeChitsCount++;
      const paidAmt = Number(cm.totalPaid) || (Number(cm.paidWeeks || 0) * Number(cm.weeklyAmount || 0));
      totalChitInvested += paidAmt;

      const isWithdrawn = cm.withdrawalStatus === 'completed' || cm.withdrawalStatus === 'withdrawn' || cm.withdrawalStatus === 'approved';
      const isRequested = cm.withdrawalStatus === 'requested';

      // Determine cycle progress & unlock
      const chit = cm.chitId;
      const isWeekly = chit?.isWeekly ?? (cm.weeklyAmount > 0);
      const totalUnits = isWeekly
        ? (cm.totalWeeks || chit?.totalWeeks || chit?.duration || 10)
        : (chit?.duration || chit?.totalWeeks || 12);
      const currentUnit = isWeekly ? (cm.currentWeek || cm.paidWeeks || 1) : (cm.currentMonth || 1);
      const lockedCount = Math.floor((totalUnits - 1) / 2);
      const isUnlocked = currentUnit > lockedCount;
      const isSettlement = currentUnit >= totalUnits;

      const installmentAmount = isWeekly
        ? (cm.weeklyAmount || chit?.weeklyAmount || chit?.monthlyAmount || 200)
        : (chit?.monthlyAmount || chit?.weeklyAmount || cm.monthlyAmount || 1000);
      const totalContribution = cm.totalContribution || chit?.totalContribution || chit?.totalPot || (installmentAmount * totalUnits);

      let priceAmount = Number(cm.priceAmount) || 0;
      if (!priceAmount) {
        if (isSettlement) {
          priceAmount = totalContribution;
        } else if (isUnlocked) {
          const baseEndPct = totalUnits >= 20 ? 8 : 6;
          const actionPct = baseEndPct + 2 * (totalUnits - currentUnit);
          priceAmount = totalContribution - (totalContribution * actionPct / 100);
        }
      }

      if (!isUnlocked && !isWithdrawn) {
        totalChitLocked += paidAmt;
      }

      if (cm.hasWon) {
        const winning = Number(cm.winningAmount) || priceAmount;
        totalChitWinningAmount += winning;
        if (!isWithdrawn && !isRequested) {
          chitWithdrawalAvailable += winning;
        }
      } else if (isUnlocked && !isWithdrawn && !isRequested) {
        // Price amount ONLY (before chit completes, strictly price amount without dividend)
        chitWithdrawalAvailable += priceAmount;
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

  // ─── 4. PENDING WITHDRAWALS DEDUCTION ─────────────────────────────────────
  // Pending requests tied to specific investments already set availableToWithdraw = 0 on those investments.
  // Any general pending withdrawal without investmentId deducts from general liquid balance.
  const totalPendingWithdrawals = userWithdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  // ─── 5. AGGREGATION ─────────────────────────────────────────────────────────
  // Current active pocket money holding is pocketMoneyRemaining (active principal remaining to be released)
  const totalInvested = totalDurationInvested + totalChitInvested + pocketMoneyRemaining;
  const totalLocked = totalDurationLocked + totalChitLocked + pocketMoneyRemaining;

  // availableToWithdraw = truly liquid right now in app (matured/eligible active deposits + chit winnings - general pending withdrawal requests)
  const availableToWithdraw = Math.max(0, maturedWithdrawalAvailable + chitWithdrawalAvailable - generalPendingAmount);

  // totalBalance = what the user currently has invested + accrued interest
  const totalBalance = Math.max(0, totalInvested + totalAccruedInterest);

  // Next unlock date — earliest maturity date among locked investments that have not matured yet
  const lockedInvestments = enrichedInvestments.filter(i => i.isLocked && i.maturityDate && new Date(i.maturityDate) > nowDate);
  let nextUnlockDate = null;
  if (lockedInvestments.length > 0) {
    const sorted = lockedInvestments.slice().sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate));
    nextUnlockDate = sorted[0].maturityDate;
  }

  const Settings = require('../models/Settings');
  let minCoinThreshold = 1000;
  try {
    const minCoinSetting = await Settings.findOne({ key: 'min_reward_withdrawal_coins' });
    if (minCoinSetting && minCoinSetting.value) {
      const parsed = parseInt(minCoinSetting.value, 10);
      if (!isNaN(parsed) && parsed > 0) minCoinThreshold = parsed;
    }
  } catch (settingErr) {
    console.warn('[PortfolioHelper] Error fetching min coin setting:', settingErr.message);
  }

  const userCoinBalance = Number(user.coinBalance) || Number(user.coins) || 0;
  const isRewardUnlocked = userCoinBalance >= minCoinThreshold;
  const unlockedRewardCoinsRupees = isRewardUnlocked ? Number((userCoinBalance * 0.05).toFixed(2)) : 0;

  return {
    user: {
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      balance: totalBalance,
      coinBalance: userCoinBalance,
      coins: userCoinBalance,
    },
    balances: {
      totalBalance,
      totalInvested,
      totalDurationInvested,
      totalGeneralInvested: totalDurationInvested,
      activeDurationInvestmentsCount: enrichedInvestments.filter(i => !['rejected', 'withdrawn', 'reinvested', 'pending'].includes(i.status)).length,
      durationDailyInterest: totalDailyInterest,
      durationAccruedInterest: totalAccruedInterest,
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
      walletBalance: 0,
      coinBalance: userCoinBalance,
      coins: userCoinBalance,
      unlockedRewardCoinsRupees,
      isRewardUnlocked,
      minCoinThreshold,
      totalChitInvested,
      totalChitWinningAmount,
      chitWithdrawalAvailable,
      activeChitsCount,
      nextUnlockDate,
    },
    investments: enrichedInvestments,
    chitMemberships,
    pocketMonies,
    stats: {
      totalInvestments: enrichedInvestments.filter(i => i.status === 'approved').length + activeChitsCount + pocketMonies.filter(pm => pm.status === 'active').length,
      activeInvestmentsCount: enrichedInvestments.filter(i => !['rejected', 'withdrawn'].includes(i.status)).length + activeChitsCount + pocketMonies.filter(pm => pm.status === 'active').length,
      activeChitsCount,
      activePocketMoneyCount: pocketMonies.filter(pm => pm.status === 'active').length,
      pendingRequests: 0,
    },
  };
}

module.exports = { getUserPortfolioSummary };
