const PocketMoney = require('../models/PocketMoney');
const PocketMoneyPayout = require('../models/PocketMoneyPayout');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationHelper');

// Helper scheduler function
const runPocketMoneyPayouts = async () => {
  console.log('[PocketMoneyScheduler] Running payouts check...');
  const now = new Date();
  
  // Find all active pocket money investments
  const activePockets = await PocketMoney.find({ status: 'active' });
  let processedCount = 0;
  
  for (const pocket of activePockets) {
    try {
      if (pocket.nextPayoutDate > now) {
        continue;
      }
      
      const payoutNum = pocket.payoutCount + 1;
      const todayStr = now.toISOString().slice(0, 10);
      const idempotencyKey = `PM_${pocket._id}_${todayStr}`;
      
      // Database-level double check using findOne
      const existingPayout = await PocketMoneyPayout.findOne({ idempotencyKey });
      if (existingPayout) {
        console.warn(`[PocketMoneyScheduler] Payout already exists for pocket: ${pocket._id} on date: ${todayStr}. Skipping.`);
        continue;
      }
      
      const amountToPay = Math.min(pocket.payoutAmount, pocket.remainingAmount);
      
      // Create Transaction first
      const transaction = new Transaction({
        userId: pocket.userId,
        userEmail: pocket.userEmail,
        type: 'pocket_money_payout',
        amount: amountToPay,
        status: 'approved',
        referenceId: pocket._id,
        referenceType: 'PocketMoney',
        description: `Pocket Money Payout Release #${payoutNum} (${pocket.frequency})`
      });
      await transaction.save();
      
      // Save Payout log (with unique idempotencyKey)
      const payout = new PocketMoneyPayout({
        pocketMoneyId: pocket._id,
        userId: pocket.userId,
        amount: amountToPay,
        payoutDate: now,
        payoutNumber: payoutNum,
        idempotencyKey,
        transactionId: transaction._id
      });
      await payout.save();
      
      // Update Pocket Money record
      pocket.remainingAmount = Math.max(0, pocket.remainingAmount - amountToPay);
      pocket.totalPaidOut += amountToPay;
      pocket.payoutCount = payoutNum;
      
      if (pocket.remainingAmount <= 0) {
        pocket.status = 'completed';
        pocket.completedAt = now;
      } else {
        // Calculate next payout date based on frequency
        const nextDate = new Date(pocket.nextPayoutDate);
        if (pocket.frequency === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (pocket.frequency === 'every_2_days') {
          nextDate.setDate(nextDate.getDate() + 2);
        } else if (pocket.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        }
        pocket.nextPayoutDate = nextDate;
      }
      
      await pocket.save();
      
      // Send notifications (unified: push + DB)
      await sendNotification({
        userId: pocket.userId,
        title: '💰 Pocket Money Received',
        description: `₹${amountToPay} Pocket Money has been credited to your account.`,
        type: 'pocket_money_payout',
        metadata: { pocketMoneyId: pocket._id }
      });
      
      if (pocket.status === 'completed') {
        await sendNotification({
          userId: pocket.userId,
          title: '🏆 Pocket Money Completed',
          description: `Your ₹${pocket.investedAmount} Pocket Money investment has been fully paid out!`,
          type: 'pocket_money_completed',
          metadata: { pocketMoneyId: pocket._id }
        });
      }
      
      // Notify Admin
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await sendNotification({
          userId: admin._id,
          title: '🔔 Pocket Money Payout Released',
          description: `₹${amountToPay} payout processed for ${pocket.userName}.`,
          type: 'pocket_money_payout',
          metadata: { pocketMoneyId: pocket._id }
        });
      }
      
      processedCount++;
    } catch (err) {
      console.error(`[PocketMoneyScheduler] Error processing payout for pocket ${pocket._id}:`, err);
    }
  }
  
  console.log(`[PocketMoneyScheduler] Completed. Processed ${processedCount} payouts.`);
  return processedCount;
};

// GET /api/pocket-money/my
exports.getMyPocketMoney = async (req, res) => {
  try {
    const pocketMonies = await PocketMoney.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(pocketMonies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pocket money investments', error: error.message });
  }
};

// GET /api/pocket-money/admin/all (Admin-only)
exports.getAdminPocketMoneyList = async (req, res) => {
  try {
    const list = await PocketMoney.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pocket money list for admin', error: error.message });
  }
};

// GET /api/pocket-money/admin/stats (Admin-only)
exports.getAdminPocketMoneyStats = async (req, res) => {
  try {
    const now = new Date();
    
    const [
      totalInvestments,
      activeCount,
      completedCount,
      totalsResult,
      dueResult,
    ] = await Promise.all([
      PocketMoney.countDocuments(),
      PocketMoney.countDocuments({ status: 'active' }),
      PocketMoney.countDocuments({ status: 'completed' }),
      PocketMoney.aggregate([
        {
          $group: {
            _id: null,
            invested: { $sum: '$investedAmount' },
            released: { $sum: '$totalPaidOut' },
            remaining: { $sum: '$remainingAmount' }
          }
        }
      ]),
      PocketMoney.countDocuments({ status: 'active', nextPayoutDate: { $lte: now } })
    ]);

    const stats = totalsResult[0] || { invested: 0, released: 0, remaining: 0 };

    res.json({
      totalInvestments,
      activeCount,
      completedCount,
      totalInvested: stats.invested,
      totalReleased: stats.released,
      remainingAmount: stats.remaining,
      todayPayoutsDue: dueResult
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pocket money stats for admin', error: error.message });
  }
};

// POST /api/pocket-money/admin/trigger-payouts (Admin-only)
exports.triggerPocketMoneyPayouts = async (req, res) => {
  try {
    const processedCount = await runPocketMoneyPayouts();
    res.json({ success: true, processedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error running pocket money scheduler', error: error.message });
  }
};

module.exports.runPocketMoneyPayouts = runPocketMoneyPayouts;
