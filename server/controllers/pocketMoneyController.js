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
      
      const amountToPay = Math.min(pocket.payoutAmount, pocket.remainingAmount) + (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);
      
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
        status: 'released',
        transactionId: transaction._id
      });
      await payout.save();
      
      const regularPayoutPart = amountToPay - (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);
      // Update Pocket Money record
      pocket.remainingAmount = Math.max(0, pocket.remainingAmount - regularPayoutPart);
      pocket.totalPaidOut += amountToPay;
      pocket.payoutCount = payoutNum;
      
      if (payoutNum === 10) {
        pocket.bonusReleased = true;
      }
      
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

// Helper: Get IST start of today
const getStartOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: Get IST date string (YYYY-MM-DD)
const getISTDateString = (dateInput) => {
  if (!dateInput) return '';
  return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const getTodayISTString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// GET /api/pocket-money/my
exports.getMyPocketMoney = async (req, res) => {
  try {
    const pocketMonies = await PocketMoney.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const todayIST = getTodayISTString();

    const enriched = await Promise.all(
      pocketMonies.map(async (pocket) => {
        const pocketObj = pocket.toObject();

        if (pocket.status === 'completed' || pocket.remainingAmount <= 0) {
          pocketObj.todayPayoutStatus = 'completed';
          return pocketObj;
        }

        // Find payouts specifically created for THIS pocketMoneyId
        const payouts = await PocketMoneyPayout.find({ pocketMoneyId: pocket._id }).sort({ createdAt: -1 });
        const payoutToday = payouts.find(p => getISTDateString(p.createdAt || p.payoutDate) === todayIST);

        if (payoutToday) {
          if (payoutToday.status === 'released') {
            pocketObj.todayPayoutStatus = 'released';
          } else if (payoutToday.status === 'requested') {
            pocketObj.todayPayoutStatus = 'requested';
          } else {
            pocketObj.todayPayoutStatus = 'available';
          }
        } else {
          // Check if nextPayoutDate has arrived in IST
          const nextDateIST = getISTDateString(pocket.nextPayoutDate);
          if (nextDateIST > todayIST) {
            pocketObj.todayPayoutStatus = 'upcoming'; // Not due yet!
          } else {
            pocketObj.todayPayoutStatus = 'available'; // Due today or overdue!
          }
        }

        const payoutNum = pocket.payoutCount + 1;
        pocketObj.currentPayoutNumber = payoutNum;
        pocketObj.currentPayoutAmount = Math.min(pocket.payoutAmount, pocket.remainingAmount) + (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);

        return pocketObj;
      })
    );

    res.json(enriched);
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

// POST /api/pocket-money/admin/release/:id (Admin-only)
exports.releaseSinglePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const pocket = await PocketMoney.findById(id);
    if (!pocket) {
      return res.status(404).json({ message: 'Pocket Money record not found' });
    }
    if (pocket.status !== 'active') {
      return res.status(400).json({ message: 'Pocket Money is not active' });
    }
    if (pocket.remainingAmount <= 0) {
      return res.status(400).json({ message: 'Pocket Money is already fully paid out' });
    }
    
    const startOfToday = getStartOfToday();
    const now = new Date();
    const payoutNum = pocket.payoutCount + 1;
    const todayStr = now.toISOString().slice(0, 10);
    const idempotencyKey = `PM_${pocket._id}_${todayStr}_release_${payoutNum}`;
    
    // Check if a payout was already completed today
    const alreadyReleasedToday = await PocketMoneyPayout.findOne({
      pocketMoneyId: pocket._id,
      status: 'released',
      createdAt: { $gte: startOfToday }
    });
    if (alreadyReleasedToday) {
      return res.status(400).json({ message: 'Payout already released for this plan today.' });
    }
    
    const amountToPay = Math.min(pocket.payoutAmount, pocket.remainingAmount) + (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);
    
    const transaction = new Transaction({
      userId: pocket.userId,
      userEmail: pocket.userEmail,
      type: 'pocket_money_payout',
      amount: amountToPay,
      status: 'approved',
      referenceId: pocket._id,
      referenceType: 'PocketMoney',
      description: `Pocket Money Payout Release #${payoutNum} (Admin Direct Release)`
    });
    await transaction.save();
    
    // Check if user had submitted a pending 'requested' payout record
    let payout = await PocketMoneyPayout.findOne({
      pocketMoneyId: pocket._id,
      status: 'requested',
    });

    if (payout) {
      payout.status = 'released';
      payout.amount = amountToPay;
      payout.payoutDate = now;
      payout.payoutNumber = payoutNum;
      payout.transactionId = transaction._id;
    } else {
      payout = new PocketMoneyPayout({
        pocketMoneyId: pocket._id,
        userId: pocket.userId,
        amount: amountToPay,
        payoutDate: now,
        payoutNumber: payoutNum,
        idempotencyKey,
        status: 'released',
        transactionId: transaction._id
      });
    }
    await payout.save();
    
    const regularPayoutPart = amountToPay - (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);
    pocket.remainingAmount = Math.max(0, pocket.remainingAmount - regularPayoutPart);
    pocket.totalPaidOut += amountToPay;
    pocket.payoutCount = payoutNum;
    
    if (payoutNum === 10) {
      pocket.bonusReleased = true;
    }
    
    if (pocket.remainingAmount <= 0) {
      pocket.status = 'completed';
      pocket.completedAt = now;
    } else {
      // Increment next payout date based on frequency
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
    
    // Notify User
    await sendNotification({
      userId: pocket.userId,
      title: '💰 Pocket Money Released',
      description: `₹${amountToPay} Pocket Money has been manually released by Admin to your wallet!`,
      type: 'pocket_money_payout',
      metadata: { pocketMoneyId: pocket._id }
    });
    
    if (pocket.status === 'completed') {
      await sendNotification({
        userId: pocket.userId,
        title: '🏆 Pocket Money Completed',
        description: `Your ₹${pocket.investedAmount} Pocket Money plan has been fully paid out!`,
        type: 'pocket_money_completed',
        metadata: { pocketMoneyId: pocket._id }
      });
    }
    
    res.json({ success: true, message: `Successfully released ₹${amountToPay} payout.`, pocket });
  } catch (error) {
    res.status(500).json({ message: 'Error releasing payout', error: error.message });
  }
};

// POST /api/pocket-money/request-payout/:pocketId (User-facing)
exports.requestPayout = async (req, res) => {
  try {
    const { pocketId } = req.params;
    const pocket = await PocketMoney.findById(pocketId);
    
    if (!pocket) {
      return res.status(404).json({ message: 'Pocket Money plan not found' });
    }
    
    if (pocket.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized action' });
    }
    
    if (pocket.status !== 'active') {
      return res.status(400).json({ message: 'Pocket Money plan is not active' });
    }
    
    if (pocket.remainingAmount <= 0) {
      return res.status(400).json({ message: 'Pocket Money is already fully paid out' });
    }
    
    const todayIST = getTodayISTString();
    const nextDateIST = getISTDateString(pocket.nextPayoutDate);

    if (nextDateIST > todayIST) {
      return res.status(400).json({
        message: `Payout for this plan is scheduled for ${new Date(pocket.nextPayoutDate).toLocaleDateString('en-IN')}. It is not due yet.`,
        status: 'upcoming'
      });
    }

    const now = new Date();
    const payoutNum = pocket.payoutCount + 1;
    const idempotencyKey = `PM_req_${pocket._id}_${todayIST}_${payoutNum}`;

    // Check if user already requested or received payout for THIS SPECIFIC plan TODAY in IST
    const existingPayouts = await PocketMoneyPayout.find({ pocketMoneyId: pocket._id });
    const todayPayout = existingPayouts.find(p => getISTDateString(p.createdAt || p.payoutDate) === todayIST);

    if (todayPayout) {
      if (todayPayout.status === 'requested') {
        return res.status(400).json({
          message: 'Payout already requested today for this plan. Please wait for Admin approval.',
          status: 'requested'
        });
      } else if (todayPayout.status === 'released') {
        return res.status(400).json({
          message: "Today's payout has already been released for this plan. Next payout available on scheduled date.",
          status: 'released'
        });
      }
    }

    const amountToPay = Math.min(pocket.payoutAmount, pocket.remainingAmount) + (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);

    const payout = new PocketMoneyPayout({
      pocketMoneyId: pocket._id,
      userId: pocket.userId,
      amount: amountToPay,
      payoutDate: now,
      payoutNumber: payoutNum,
      idempotencyKey,
      status: 'requested',
    });
    await payout.save();

    // Notify admins with exact investment ID reference
    try {
      const { notifyAdmins } = require('../services/notificationHelper');
      await notifyAdmins({
        title: '💼 New Pocket Money Payout Request',
        description: `${pocket.userName} requested payout of ₹${amountToPay} for Plan PM-${pocket._id.toString().slice(-6)}.`,
        type: 'general',
        metadata: { payoutId: payout._id, pocketMoneyId: pocket._id }
      });
    } catch (notifErr) {
      console.error('[PocketMoneyRequest] Admin notification error:', notifErr);
    }

    res.status(201).json({ success: true, message: 'Payout requested successfully', payout });
  } catch (error) {
    res.status(500).json({ message: 'Error requesting payout', error: error.message });
  }
};

// GET /api/pocket-money/payout-status/:pocketId (User-facing)
exports.getPayoutStatus = async (req, res) => {
  try {
    const { pocketId } = req.params;
    const pocket = await PocketMoney.findById(pocketId);

    if (!pocket) {
      return res.status(404).json({ message: 'Pocket Money plan not found' });
    }

    if (pocket.status === 'completed' || pocket.remainingAmount <= 0) {
      return res.json({ status: 'completed', payoutAmount: 0 });
    }

    const todayIST = getTodayISTString();
    const nextDateIST = getISTDateString(pocket.nextPayoutDate);
    const payoutNum = pocket.payoutCount + 1;
    const payoutAmt = Math.min(pocket.payoutAmount, pocket.remainingAmount) + (payoutNum === 10 ? (pocket.bonusAmount || 0) : 0);

    const existingPayouts = await PocketMoneyPayout.find({ pocketMoneyId: pocket._id }).sort({ createdAt: -1 });
    const todayPayout = existingPayouts.find(p => getISTDateString(p.createdAt || p.payoutDate) === todayIST);

    if (todayPayout) {
      return res.json({ status: todayPayout.status, payoutAmount: payoutAmt, payoutNumber: todayPayout.payoutNumber, payout: todayPayout });
    }

    if (nextDateIST > todayIST) {
      return res.json({ status: 'upcoming', payoutAmount: payoutAmt, payoutNumber: payoutNum, nextPayoutDate: pocket.nextPayoutDate });
    }

    res.json({ status: 'available', payoutAmount: payoutAmt, payoutNumber: payoutNum });
  } catch (error) {
    res.status(500).json({ message: 'Error checking payout status', error: error.message });
  }
};

// GET /api/pocket-money/history/:pocketId (User-facing DB history)
exports.getPayoutHistory = async (req, res) => {
  try {
    const { pocketId } = req.params;
    const payouts = await PocketMoneyPayout.find({ pocketMoneyId: pocketId }).sort({ createdAt: -1 });
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payout history', error: error.message });
  }
};

// GET /api/pocket-money/admin/pending-payouts (Admin-only)
exports.getAdminPendingPayouts = async (req, res) => {
  try {
    const pending = await PocketMoneyPayout.find({ status: 'requested' })
      .populate('pocketMoneyId')
      .populate('userId', 'name username mobileNumber email')
      .sort({ createdAt: -1 });
      
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending payouts list', error: error.message });
  }
};

// POST /api/pocket-money/admin/confirm-release/:payoutId (Admin-only)
exports.confirmReleasePayout = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const payout = await PocketMoneyPayout.findById(payoutId);
    
    if (!payout) {
      return res.status(404).json({ message: 'Payout request not found' });
    }
    
    if (payout.status === 'released') {
      return res.status(400).json({ message: 'Payout is already released' });
    }
    
    const pocket = await PocketMoney.findById(payout.pocketMoneyId);
    if (!pocket) {
      return res.status(404).json({ message: 'Associated Pocket Money plan not found' });
    }
    
    const now = new Date();
    
    // Create transaction
    const transaction = new Transaction({
      userId: payout.userId,
      userEmail: pocket.userEmail,
      type: 'pocket_money_payout',
      amount: payout.amount,
      status: 'approved',
      referenceId: pocket._id,
      referenceType: 'PocketMoney',
      description: `Pocket Money Payout Release #${payout.payoutNumber} (Admin Approved Release)`
    });
    await transaction.save();
    
    // Update payout status
    payout.status = 'released';
    payout.transactionId = transaction._id;
    await payout.save();
    
    const regularPayoutPart = payout.amount - (payout.payoutNumber === 10 ? (pocket.bonusAmount || 0) : 0);
    // Update Pocket Money record
    pocket.remainingAmount = Math.max(0, pocket.remainingAmount - regularPayoutPart);
    pocket.totalPaidOut += payout.amount;
    pocket.payoutCount = payout.payoutNumber;
    
    if (payout.payoutNumber === 10) {
      pocket.bonusReleased = true;
    }
    
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
    
    // Send notifications to the user
    try {
      await sendNotification({
        userId: pocket.userId,
        title: '💰 Pocket Money Payout Released',
        description: `Your Pocket Money payout request of ₹${payout.amount} has been approved and released!`,
        type: 'pocket_money_payout',
        metadata: { pocketMoneyId: pocket._id }
      });
      
      if (pocket.status === 'completed') {
        await sendNotification({
          userId: pocket.userId,
          title: '🏆 Pocket Money Plan Completed',
          description: `Congratulations! Your pocket money plan of ₹${pocket.investedAmount} is fully paid out!`,
          type: 'pocket_money_completed',
          metadata: { pocketMoneyId: pocket._id }
        });
      }
    } catch (notifErr) {
      console.error('[PocketMoneyConfirm] User notification error:', notifErr);
    }
    
    res.json({ success: true, message: `Payout of ₹${payout.amount} approved and released successfully`, payout, pocket });
  } catch (error) {
    res.status(500).json({ message: 'Error confirming release payout', error: error.message });
  }
};

module.exports.runPocketMoneyPayouts = runPocketMoneyPayouts;
