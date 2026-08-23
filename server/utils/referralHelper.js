const User = require('../models/User');
const Referral = require('../models/Referral');
const CoinTransaction = require('../models/CoinTransaction');
const { sendNotification } = require('../services/notificationHelper');

/**
 * Triggers referral reward when a user completes a successful qualifying investment.
 * Idempotent, self-referral protected, and backend-verified.
 * @param {ObjectId|string} investorUserId - The user who completed the payment/investment
 * @param {ObjectId|string} investmentId - The ID of the confirmed investment/payment
 */
const triggerReferralRewardOnInvestment = async (investorUserId, investmentId) => {
  try {
    if (!investorUserId) return null;

    // Find pending referral for this investor
    const referral = await Referral.findOne({
      referredUserId: investorUserId,
      status: { $in: ['REGISTERED', 'PENDING'] },
    });

    if (!referral) {
      return null; // No pending referral found for this user
    }

    // Protection: Prevent self-referral
    if (referral.referrerUserId.toString() === investorUserId.toString()) {
      console.warn(`[Referral Guard] Blocked self-referral reward for user: ${investorUserId}`);
      return null;
    }

    const rewardAmount = 100;

    // Atomic update to ensure single execution (Idempotency guard)
    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: referral._id,
        status: { $in: ['REGISTERED', 'PENDING'] }, // Ensures only updated ONCE
      },
      {
        status: 'SUCCESSFUL',
        qualifyingInvestmentId: investmentId,
        rewardCoins: rewardAmount,
        rewardedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedReferral) {
      console.log(`[Referral] Reward already processed for referral: ${referral._id}`);
      return null;
    }

    // Credit referrer's coin balance
    await User.findByIdAndUpdate(referral.referrerUserId, {
      $inc: { coinBalance: rewardAmount },
    });

    // Record Coin Transaction for referrer
    const coinTx = await CoinTransaction.create({
      userId: referral.referrerUserId,
      type: 'REFERRAL_REWARD',
      amount: rewardAmount,
      description: 'Referral reward for friend signup & successful investment',
      referenceId: updatedReferral._id,
    });

    // Notify referrer
    await sendNotification({
      userId: referral.referrerUserId,
      title: '🪙 Referral Reward Earned!',
      description: `🎉 You earned ${rewardAmount} Growvest Coins because your referred friend completed their investment!`,
      type: 'referral_reward',
      metadata: { referralId: updatedReferral._id },
    }).catch(err => console.warn('[Referral Notif] Notification non-fatal error:', err.message));

    console.log(`[Referral Success] Credited ${rewardAmount} coins to referrer ${referral.referrerUserId}`);
    return coinTx;
  } catch (error) {
    console.error('[Referral Error] Failed to process referral reward:', error);
    return null;
  }
};

module.exports = { triggerReferralRewardOnInvestment };
