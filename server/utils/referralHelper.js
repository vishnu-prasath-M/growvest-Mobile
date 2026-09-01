const mongoose = require('mongoose');
const User = require('../models/User');
const Referral = require('../models/Referral');
const CoinTransaction = require('../models/CoinTransaction');
const { sendNotification } = require('../services/notificationHelper');

// Helper to get current Indian date string (YYYY-MM-DD)
const getTodayDateStringIST = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  return istTime.toISOString().split('T')[0];
};

/**
 * Atomic, Idempotent coin reward dispatcher.
 * Prevents double crediting using unique idempotencyKey.
 */
const awardCoins = async ({
  userId,
  type,
  coins,
  description,
  sourceEvent = null,
  referralId = null,
  referenceId = null,
  idempotencyKey = null,
}) => {
  try {
    if (!userId || !coins) return null;

    // Check for existing transaction if idempotencyKey is provided
    if (idempotencyKey) {
      const existing = await CoinTransaction.findOne({ idempotencyKey });
      if (existing) {
        console.log(`[Reward Guard] Duplicate reward prevented for key: ${idempotencyKey}`);
        return existing;
      }
    }

    const rupeeVal = Number((coins * 0.05).toFixed(2));

    // Create Coin Transaction
    let coinTx;
    try {
      coinTx = await CoinTransaction.create({
        userId,
        type,
        coins,
        amount: coins,
        rupeeValue: rupeeVal,
        description,
        sourceEvent,
        referralId,
        referenceId,
        idempotencyKey,
        status: 'COMPLETED',
      });
    } catch (createErr) {
      if (createErr.code === 11000 && idempotencyKey) {
        console.log(`[Reward Guard] Duplicate key caught during insert: ${idempotencyKey}`);
        return await CoinTransaction.findOne({ idempotencyKey });
      }
      throw createErr;
    }

    // Atomically increment user's coin balance
    await User.findByIdAndUpdate(userId, {
      $inc: { coinBalance: coins },
    });

    console.log(`[Reward Success] Credited ${coins} coins (₹${rupeeVal}) to user ${userId} for ${type}`);
    return coinTx;
  } catch (error) {
    console.error('[Reward Error] Failed to award coins:', error);
    return null;
  }
};

/**
 * 1. Referral: Signup Completed (20 Coins to Referrer)
 */
const triggerReferralSignupReward = async (newUserId, referrerUserId) => {
  try {
    if (!newUserId || !referrerUserId || newUserId.toString() === referrerUserId.toString()) {
      return null;
    }

    const rewardCoins = 20; // 20 Coins = ₹1.00
    const idempotencyKey = `ref_signup_${newUserId}`;

    const referral = await Referral.findOne({ referredUserId: newUserId });
    if (!referral) return null;

    if (referral.signupRewarded) {
      console.log(`[Referral] Signup already rewarded for user ${newUserId}`);
      return null;
    }

    const newUser = await User.findById(newUserId);
    const displayName = newUser ? (newUser.name || newUser.username || 'A friend') : 'A friend';

    const tx = await awardCoins({
      userId: referrerUserId,
      type: 'REFERRAL_SIGNUP',
      coins: rewardCoins,
      description: `Referral signup reward: ${displayName} joined using your link`,
      sourceEvent: 'SIGNUP',
      referralId: referral._id,
      idempotencyKey,
    });

    if (tx) {
      await Referral.findByIdAndUpdate(referral._id, {
        $set: { signupRewarded: true },
        $inc: { rewardCoins: rewardCoins, totalCoinsAwarded: rewardCoins },
      });

      await sendNotification({
        userId: referrerUserId,
        title: '🪙 Friend Joined Growvest!',
        description: `🎉 +${rewardCoins} Coins (₹1.00)! ${displayName} just signed up with your referral code. Complete their KYC & investment to earn up to 180 more coins!`,
        type: 'referral_reward',
        metadata: { referralId: referral._id },
      }).catch(err => console.warn('[Notif Non-fatal]', err.message));
    }

    return tx;
  } catch (error) {
    console.error('[Referral Signup Error]', error);
    return null;
  }
};

/**
 * 2. Referral: KYC Completed (30 Coins to Referrer)
 */
const triggerReferralKycReward = async (kycUserId) => {
  try {
    if (!kycUserId) return null;

    const referral = await Referral.findOne({ referredUserId: kycUserId });
    if (!referral || referral.kycRewarded) return null;

    if (referral.referrerUserId.toString() === kycUserId.toString()) return null;

    const rewardCoins = 30; // 30 Coins = ₹1.50
    const idempotencyKey = `ref_kyc_${kycUserId}`;

    const kycUser = await User.findById(kycUserId);
    const displayName = kycUser ? (kycUser.name || kycUser.username || 'A friend') : 'A friend';

    const tx = await awardCoins({
      userId: referral.referrerUserId,
      type: 'REFERRAL_KYC',
      coins: rewardCoins,
      description: `Referral KYC reward: ${displayName} verified their KYC`,
      sourceEvent: 'KYC_APPROVED',
      referralId: referral._id,
      idempotencyKey,
    });

    if (tx) {
      await Referral.findByIdAndUpdate(referral._id, {
        $set: { kycRewarded: true },
        $inc: { rewardCoins: rewardCoins, totalCoinsAwarded: rewardCoins },
      });

      await sendNotification({
        userId: referral.referrerUserId,
        title: '🪙 Referral KYC Approved!',
        description: `🎉 +${rewardCoins} Coins (₹1.50)! Your referred friend ${displayName} successfully verified their KYC!`,
        type: 'referral_reward',
        metadata: { referralId: referral._id },
      }).catch(err => console.warn('[Notif Non-fatal]', err.message));
    }

    return tx;
  } catch (error) {
    console.error('[Referral KYC Error]', error);
    return null;
  }
};

/**
 * 3. First-Time Investment Reward & Referral Investment Milestone
 * - 50 Coins to User for First Investment
 * - 50 Coins to Referrer for Referred User's First Investment
 * - 100 Coins to Referrer for Successful Referral Milestone
 */
const triggerFirstTimeAndReferralInvestmentReward = async (investorUserId, investmentId) => {
  try {
    if (!investorUserId) return null;

    const user = await User.findById(investorUserId);
    if (!user) return null;

    // A. FIRST-TIME INVESTMENT REWARD TO INVESTOR (50 Coins = ₹2.50)
    if (!user.hasFirstInvestmentReward) {
      const investorTx = await awardCoins({
        userId: investorUserId,
        type: 'FIRST_INVESTMENT',
        coins: 50,
        description: 'First-time investment bonus reward',
        sourceEvent: 'FIRST_INVESTMENT',
        referenceId: investmentId,
        idempotencyKey: `first_inv_${investorUserId}`,
      });

      if (investorTx) {
        await User.findByIdAndUpdate(investorUserId, { $set: { hasFirstInvestmentReward: true } });

        await sendNotification({
          userId: investorUserId,
          title: '🪙 First Investment Reward!',
          description: '🎉 +50 Coins (₹2.50) added to your Coin Wallet for making your first investment in Growvest!',
          type: 'reward',
        }).catch(err => console.warn('[Notif Non-fatal]', err.message));
      }
    }

    // B. REFERRAL FIRST INVESTMENT REWARD (50 Coins) & MILESTONE (100 Coins) TO REFERRER
    const referral = await Referral.findOne({ referredUserId: investorUserId });
    if (referral && referral.referrerUserId.toString() !== investorUserId.toString()) {
      const displayName = user.name || user.username || 'Your friend';

      // 1. Referred user's first investment reward (50 Coins)
      if (!referral.firstInvestmentRewarded) {
        const refInvTx = await awardCoins({
          userId: referral.referrerUserId,
          type: 'REFERRAL_FIRST_INVESTMENT',
          coins: 50,
          description: `Referral investment reward: ${displayName} made their first investment`,
          sourceEvent: 'REFERRAL_FIRST_INVESTMENT',
          referralId: referral._id,
          referenceId: investmentId,
          idempotencyKey: `ref_first_inv_${investorUserId}`,
        });

        if (refInvTx) {
          await Referral.findByIdAndUpdate(referral._id, {
            $set: { firstInvestmentRewarded: true, qualifyingInvestmentId: investmentId },
            $inc: { rewardCoins: 50, totalCoinsAwarded: 50 },
          });

          await sendNotification({
            userId: referral.referrerUserId,
            title: '🪙 Referral Investment Bonus!',
            description: `🎉 +50 Coins (₹2.50)! ${displayName} completed their first investment!`,
            type: 'referral_reward',
            metadata: { referralId: referral._id },
          }).catch(err => console.warn('[Notif Non-fatal]', err.message));
        }
      }

      // 2. Successful Referral Milestone (100 Coins)
      if (!referral.milestoneRewarded) {
        const milestoneTx = await awardCoins({
          userId: referral.referrerUserId,
          type: 'REFERRAL_SUCCESSFUL',
          coins: 100,
          description: `Successful referral milestone completed for ${displayName}`,
          sourceEvent: 'REFERRAL_MILESTONE_SUCCESS',
          referralId: referral._id,
          referenceId: investmentId,
          idempotencyKey: `ref_milestone_${investorUserId}`,
        });

        if (milestoneTx) {
          await Referral.findByIdAndUpdate(referral._id, {
            $set: {
              milestoneRewarded: true,
              status: 'SUCCESSFUL',
              rewardedAt: new Date(),
            },
            $inc: { rewardCoins: 100, totalCoinsAwarded: 100 },
          });

          await sendNotification({
            userId: referral.referrerUserId,
            title: '🎉 Referral Milestone Complete!',
            description: `🏆 +100 Coins (₹5.00)! Referral for ${displayName} is now fully qualified & rewarded!`,
            type: 'referral_reward',
            metadata: { referralId: referral._id },
          }).catch(err => console.warn('[Notif Non-fatal]', err.message));
        }
      }
    }
  } catch (error) {
    console.error('[Investment Reward Error]', error);
  }
};

/**
 * 4. First Chit Fund Join Reward (50 Coins = ₹2.50 to User)
 */
const triggerFirstChitJoinReward = async (userId, chitMemberId) => {
  try {
    if (!userId) return null;

    const user = await User.findById(userId);
    if (!user || user.hasFirstChitReward) return null;

    const tx = await awardCoins({
      userId,
      type: 'FIRST_CHIT',
      coins: 50,
      description: 'First-time Chit Fund participation bonus reward',
      sourceEvent: 'FIRST_CHIT_JOIN',
      referenceId: chitMemberId,
      idempotencyKey: `first_chit_${userId}`,
    });

    if (tx) {
      await User.findByIdAndUpdate(userId, { $set: { hasFirstChitReward: true } });

      await sendNotification({
        userId,
        title: '🪙 First Chit Fund Reward!',
        description: '🎉 +50 Coins (₹2.50) added to your Coin Wallet for joining your first Chit Fund scheme!',
        type: 'reward',
      }).catch(err => console.warn('[Notif Non-fatal]', err.message));
    }

    return tx;
  } catch (error) {
    console.error('[First Chit Reward Error]', error);
    return null;
  }
};

/**
 * 5. First Pocket Money Investment Reward (50 Coins = ₹2.50 to User)
 */
const triggerFirstPocketMoneyReward = async (userId, pocketMoneyId) => {
  try {
    if (!userId) return null;

    const user = await User.findById(userId);
    if (!user || user.hasFirstPocketMoneyReward) return null;

    const tx = await awardCoins({
      userId,
      type: 'FIRST_POCKET_MONEY',
      coins: 50,
      description: 'First-time Pocket Money plan bonus reward',
      sourceEvent: 'FIRST_POCKET_MONEY',
      referenceId: pocketMoneyId,
      idempotencyKey: `first_pocket_${userId}`,
    });

    if (tx) {
      await User.findByIdAndUpdate(userId, { $set: { hasFirstPocketMoneyReward: true } });

      await sendNotification({
        userId,
        title: '🪙 First Pocket Money Reward!',
        description: '🎉 +50 Coins (₹2.50) added to your Coin Wallet for starting your first Pocket Money plan!',
        type: 'reward',
      }).catch(err => console.warn('[Notif Non-fatal]', err.message));
    }

    return tx;
  } catch (error) {
    console.error('[First Pocket Money Reward Error]', error);
    return null;
  }
};

/**
 * 6. Daily Login Reward (2 Coins = ₹0.10 once per calendar day)
 */
const claimDailyLoginReward = async (userId) => {
  try {
    if (!userId) return { success: false, message: 'User ID is required' };

    const todayStr = getTodayDateStringIST();
    const idempotencyKey = `daily_login_${userId}_${todayStr}`;

    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };

    if (user.lastDailyLoginDate === todayStr) {
      return {
        success: false,
        alreadyClaimed: true,
        message: 'Daily login reward already claimed today. Come back tomorrow!',
      };
    }

    const tx = await awardCoins({
      userId,
      type: 'DAILY_LOGIN',
      coins: 2,
      description: `Daily login reward for ${todayStr}`,
      sourceEvent: 'DAILY_LOGIN_30S',
      idempotencyKey,
    });

    if (tx) {
      await User.findByIdAndUpdate(userId, { $set: { lastDailyLoginDate: todayStr } });

      await sendNotification({
        userId,
        title: '🪙 Daily Login Reward!',
        description: '🎉 +2 Coins (₹0.10) claimed for your daily Growvest app session!',
        type: 'reward',
      }).catch(err => console.warn('[Notif Non-fatal]', err.message));

      return {
        success: true,
        coinsAwarded: 2,
        rupeeValue: 0.10,
        message: 'Claimed +2 Coins (₹0.10) successfully!',
      };
    }

    return {
      success: false,
      alreadyClaimed: true,
      message: 'Daily login reward already claimed today.',
    };
  } catch (error) {
    console.error('[Daily Login Error]', error);
    return { success: false, message: error.message };
  }
};

// Legacy backward-compatibility alias
const triggerReferralRewardOnInvestment = triggerFirstTimeAndReferralInvestmentReward;

module.exports = {
  awardCoins,
  triggerReferralSignupReward,
  triggerReferralKycReward,
  triggerFirstTimeAndReferralInvestmentReward,
  triggerFirstChitJoinReward,
  triggerFirstPocketMoneyReward,
  claimDailyLoginReward,
  triggerReferralRewardOnInvestment,
  getTodayDateStringIST,
};

