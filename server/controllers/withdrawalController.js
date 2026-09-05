const mongoose = require('mongoose');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const { sendNotification } = require('../services/notificationHelper');

exports.createWithdrawal = async (req, res) => {
  try {
    const { amount, upiId, userName, userEmail, withdrawType } = req.body;
    
    // Find user (prioritize req.user if authenticated, fallback to email/mobile)
    let user = null;
    if (req.user?._id) {
      user = await User.findById(req.user._id);
    }
    if (!user && userEmail) {
      user = await User.findOne({ 
        $or: [{ email: userEmail }, { mobileNumber: userEmail }, { username: userEmail }] 
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { getEnrichedUserData } = require('./userController');
    const enrichedUser = await getEnrichedUserData({ _id: user._id });
    
    // Check if withdrawing against a specific investment ID
    let targetInv = null;
    if (withdrawType && withdrawType !== 'saving' && withdrawType !== 'fixed') {
      if (mongoose.Types.ObjectId.isValid(withdrawType)) {
        targetInv = await Investment.findById(withdrawType);
      }
    }

    let available = enrichedUser.availableToWithdraw || 0;
    if (targetInv) {
      const now = new Date();
      const principal = Number(targetInv.amount) || 0;
      
      let rate = Number(targetInv.interestRate) || 12;
      let durationDays = Number(targetInv.durationDays) || 365;
      if (targetInv.type === '15_days')   { rate = 12;  durationDays = 15;  }
      else if (targetInv.type === '1_month')  { rate = 15;  durationDays = 30;  }
      else if (targetInv.type === '3_months') { rate = 18;  durationDays = 90;  }
      else if (targetInv.type === '6_months') { rate = 20;  durationDays = 180; }
      else if (targetInv.type === '1_year')   { rate = 24;  durationDays = 365; }
      else if (targetInv.type === 'saving')   { rate = 12;  durationDays = 365; }
      else if (targetInv.type === 'fixed')    { rate = 24;  durationDays = 365; }

      const dailyInterest = (principal * rate) / 100 / 365;
      const totalInterestForDuration = dailyInterest * durationDays;

      const maturityDate = targetInv.maturityDate
        ? new Date(targetInv.maturityDate)
        : new Date((targetInv.startDate ? new Date(targetInv.startDate) : new Date()).getTime() + durationDays * 86400000);
      maturityDate.setHours(0, 0, 0, 0);

      const intendedDate = targetInv.intendedWithdrawalDate
        ? new Date(targetInv.intendedWithdrawalDate)
        : (targetInv.selectedWithdrawalDate ? new Date(targetInv.selectedWithdrawalDate) : maturityDate);
      intendedDate.setHours(0, 0, 0, 0);

      // Lock Guard: Cannot withdraw before chosen intended withdrawal date
      if (now < intendedDate) {
        const formattedDate = intendedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return res.status(400).json({
          message: `This investment is currently locked. Withdrawal will unlock on your chosen intended withdrawal date: ${formattedDate}.`
        });
      }

      if (targetInv.withdrawalStatus === 'pending') {
        return res.status(400).json({ message: 'A withdrawal request for this investment is already pending admin approval.' });
      }

      if (targetInv.withdrawalStatus === 'withdrawn' || targetInv.status === 'withdrawn') {
        return res.status(400).json({ message: 'This investment has already been withdrawn.' });
      }

      const isMatured = now >= maturityDate;
      let accruedInterest = 0;
      if (targetInv.startDate) {
        const startDay = new Date(targetInv.startDate);
        startDay.setHours(0, 0, 0, 0);
        const elapsedDays = Math.max(0, Math.min(durationDays, Math.floor((now - startDay) / 86400000)));
        accruedInterest = elapsedDays * dailyInterest;
      }
      accruedInterest = Math.max(accruedInterest, Number(targetInv.interestEarned) || 0, isMatured ? totalInterestForDuration : 0);

      const benefits = Number(targetInv.benefits) || 0;

      if (!isMatured) {
        // EARLY WITHDRAWAL (on or after intended date, but before maturity): Principal ONLY allowed!
        available = principal;
        if (Number(amount) > principal + 1) {
          const formattedMaturity = maturityDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          return res.status(400).json({
            message: `Early withdrawal before plan completion (${formattedMaturity}) is strictly restricted to your invested principal amount (₹${principal.toLocaleString('en-IN')}) only. Interest returns are only paid upon full maturity.`
          });
        }
      } else {
        // FULL MATURITY: Principal + Interest + Extra Benefits
        available = principal + accruedInterest + benefits;
      }
    }

    if (Number(amount) > available + 1) {
      return res.status(400).json({ message: `Insufficient eligible balance. Available to withdraw: ₹${available.toLocaleString('en-IN')}` });
    }

    const resolvedEmail = userEmail || user.email || user.mobileNumber || user.username || 'user@growvest.in';
    const resolvedName = userName || user.name || user.username || 'User';

    const newWithdrawal = new Withdrawal({
      userId: user._id,
      investmentId: targetInv ? targetInv._id : (mongoose.Types.ObjectId.isValid(withdrawType) ? withdrawType : undefined),
      amount: Number(amount),
      upiId,
      userName: resolvedName,
      userEmail: resolvedEmail,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'pending',
      withdrawType: targetInv ? (targetInv.type || 'investment') : (withdrawType || 'saving'),
      isEarlyWithdrawal: targetInv ? (new Date() < new Date(targetInv.maturityDate || Date.now())) : false,
    });

    await newWithdrawal.save();

    // If withdrawing a specific investment, link request and mark pending
    if (targetInv) {
      await Investment.findByIdAndUpdate(targetInv._id, {
        withdrawalStatus: 'pending',
        withdrawalRequestId: newWithdrawal._id,
      });
    }

    // Create transaction record
    const transaction = new Transaction({
      userId: user._id,
      userEmail: resolvedEmail,
      type: 'withdrawal',
      amount: Number(amount),
      status: 'requested',
      referenceId: newWithdrawal._id,
      referenceType: 'Withdrawal',
      description: `Withdrawal request from ${targetInv ? targetInv.type : (withdrawType || 'saving')} deposit - ₹${amount}`
    });
    await transaction.save();

    try {
      const { notifyAdmins } = require('../services/notificationHelper');
      await notifyAdmins({
        title: '💸 New Withdrawal Request',
        description: `${resolvedName} (${resolvedEmail}) requested to withdraw ₹${amount} (${targetInv ? targetInv.type : (withdrawType || 'saving')}).`,
        type: 'general',
        metadata: { withdrawalId: newWithdrawal._id }
      });
    } catch (notifErr) {
      console.warn('[Withdrawal Create] Failed to notify admins:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Pending admin approval.',
      withdrawal: newWithdrawal,
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({ message: 'Error creating withdrawal', error: error.message });
  }
};

exports.getWithdrawals = async (req, res) => {
  try {
    let query = { userId: req.user?._id };
    if (req.user && req.user.role === 'admin') {
      query = {}; // Admin sees all user withdrawal requests
    }
    const withdrawals = await Withdrawal.find(query).sort({ createdAt: -1 });
    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching withdrawals', error: error.message });
  }
};

/**
 * Process a withdrawal: deduct from user balances and investments, 
 * update transaction, mark as processed.
 * This is idempotent - checks `processed` flag before running.
 */
async function processWithdrawalDeductions(withdrawal) {
  if (withdrawal.processed) {
    console.log(`Withdrawal ${withdrawal._id} already processed, skipping deduction.`);
    return { alreadyProcessed: true };
  }

  const user = await User.findOne({
    $or: [{ email: withdrawal.userEmail }, { mobileNumber: withdrawal.userEmail }]
  });

  if (!user) {
    console.error(`User not found for withdrawal ${withdrawal._id} (email: ${withdrawal.userEmail})`);
    return { error: 'User not found' };
  }

  // Deduct from user.balance (ensure it never goes negative)
  user.balance = Math.max(0, (user.balance || 0) - withdrawal.amount);
  await user.save();

  // Deduct from investments of the matching type
  const investOrConditions = [];
  if (withdrawal.userEmail) investOrConditions.push({ userEmail: withdrawal.userEmail });
  if (user.mobileNumber) investOrConditions.push({ mobileNumber: user.mobileNumber });

  const Investment = require('../models/Investment');
  const approvedInvestments = await Investment.find({
    $or: investOrConditions,
    status: 'approved',
    type: withdrawal.withdrawType || 'saving'
  }).sort({ startDate: 1 });

  let remainingWithdrawAmount = withdrawal.amount;
  
  // Pass 1: Deduct from interest first across ALL investments
  for (const inv of approvedInvestments) {
    if (remainingWithdrawAmount <= 0) break;
    let updatedInterestEarned = inv.interestEarned || 0;
    
    if (updatedInterestEarned > 0) {
      if (remainingWithdrawAmount >= updatedInterestEarned) {
        remainingWithdrawAmount -= updatedInterestEarned;
        inv.interestEarned = 0;
      } else {
        inv.interestEarned -= remainingWithdrawAmount;
        remainingWithdrawAmount = 0;
      }
    }
  }

  // Pass 2: DO NOT deduct from principal - withdrawals should only come from interest
  // If remaining amount after interest deduction, it means insufficient interest
  // Leave principal intact as per business rules

  // Save all updated investments
  for (const inv of approvedInvestments) {
    await Investment.updateOne(
      { _id: inv._id },
      {
        $set: {
          amount: inv.amount,
          interestEarned: inv.interestEarned,
          status: inv.status
        }
      }
    );
  }

  // Mark withdrawal as processed
  await Withdrawal.updateOne(
    { _id: withdrawal._id },
    { $set: { processed: true, paidAt: withdrawal.paidAt || new Date() } }
  );

  // Update transaction record to paid
  const tx = await Transaction.findOneAndUpdate(
    { referenceId: withdrawal._id, referenceType: 'Withdrawal' },
    {
      $set: {
        status: 'paid',
        updatedAt: new Date(),
        description: `Withdrawal completed - ₹${withdrawal.amount}`
      }
    },
    { new: true }
  );

  if (!tx) {
    console.warn(`No transaction found for withdrawal ${withdrawal._id}, creating one.`);
    // Create transaction if it doesn't exist
    await Transaction.create({
      userId: user._id,
      userEmail: withdrawal.userEmail,
      type: 'withdrawal',
      amount: withdrawal.amount,
      status: 'paid',
      referenceId: withdrawal._id,
      referenceType: 'Withdrawal',
      description: `Withdrawal completed - ₹${withdrawal.amount}`
    });
  }

  return { success: true, user, remainingWithdrawAmount };
}

exports.updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paidAt, paidBy } = req.body;

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    // If marking as approved or paid, run the complete deduction process
    if (status === 'approved' || status === 'paid') {
      // ATOMIC check: only process if not already processed
      // Use findOneAndUpdate with a filter on processed=false to prevent race conditions
      const updateData = { status };
      if (paidAt) updateData.paidAt = paidAt;
      if (paidBy) updateData.paidBy = paidBy;
      if (status === 'approved' && !paidAt) {
        updateData.paidAt = new Date();
      }

      // Atomically mark as processed while updating status (only if not already processed)
      const updatedWithdrawal = await Withdrawal.findOneAndUpdate(
        { _id: id, processed: { $ne: true } },
        { $set: { ...updateData, processed: true } },
        { new: true }
      );

      if (!updatedWithdrawal) {
        // Already processed by another request - just return current state
        const existing = await Withdrawal.findById(id);
        console.log(`Withdrawal ${id} already processed (atomic check prevented double deduction).`);
        return res.status(200).json(existing);
      }

      // Process deductions (now guaranteed to run only once)
      const result = await processWithdrawalDeductions(updatedWithdrawal);

      if (result.error) {
        return res.status(400).json({ message: result.error });
      }

      // Explicitly update transaction status to 'paid' to ensure it's reflected in user dashboard
      await Transaction.findOneAndUpdate(
        { referenceId: withdrawal._id, referenceType: 'Withdrawal' },
        {
          $set: {
            status: 'paid',
            updatedAt: new Date(),
            description: `Withdrawal completed - ₹${withdrawal.amount}`
          }
        },
        { new: true }
      );

      // If this withdrawal is linked to an investment, mark that investment as withdrawn
      const targetInvId = updatedWithdrawal.investmentId || (mongoose.Types.ObjectId.isValid(withdrawal.withdrawType) ? withdrawal.withdrawType : null);
      if (targetInvId) {
        try {
          const Investment = require('../models/Investment');
          await Investment.findByIdAndUpdate(targetInvId, {
            status: 'withdrawn',
            withdrawalStatus: 'withdrawn',
            eligibilityStatus: 'withdrawn',
          });
          console.log(`[withdrawalController] Investment ${targetInvId} marked as withdrawn.`);
        } catch (invErr) {
          console.warn('[withdrawalController] Could not mark investment as withdrawn (non-fatal):', invErr.message);
        }
      }

      // Send unified notification (DB + Push) using the same implementation
      try {
        const userToNotify = await User.findOne({
          $or: [{ email: withdrawal.userEmail }, { mobileNumber: withdrawal.userEmail }]
        });
        
        if (userToNotify) {
          await sendNotification({
            userId: userToNotify._id,
            title: '✅ Withdrawal Approved',
            description: `Your withdrawal request of ₹${withdrawal.amount} has been approved and processed successfully.`,
            type: 'withdrawal_approved',
            metadata: { withdrawalId: withdrawal._id, amount: withdrawal.amount },
            pushData: { screen: 'Withdrawals' },
          });
        }
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal):', notifErr.message);
      }

      return res.status(200).json(updatedWithdrawal);
    }

    // For rejected status
    const updateData = { status };
    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(id, updateData, { new: true });

    // Update transaction record for rejected status
    await Transaction.findOneAndUpdate(
      { referenceId: withdrawal._id, referenceType: 'Withdrawal' },
      {
        $set: {
          status: 'rejected',
          updatedAt: new Date(),
          description: `Withdrawal rejected - ₹${withdrawal.amount}`
        }
      },
      { new: true }
    );

    // Send unified notification (DB + Push) for rejection
    try {
      const userToNotify = await User.findOne({
        $or: [{ email: withdrawal.userEmail }, { mobileNumber: withdrawal.userEmail }]
      });
      if (userToNotify) {
        await sendNotification({
          userId: userToNotify._id,
          title: '❌ Withdrawal Rejected',
          description: `Your withdrawal request of ₹${withdrawal.amount} could not be processed. Please contact support.`,
          type: 'withdrawal_rejected',
          metadata: { withdrawalId: withdrawal._id, amount: withdrawal.amount },
          pushData: { screen: 'Withdrawals' },
        });
      }
    } catch (notifErr) {
      console.warn('Notification failed (non-fatal):', notifErr.message);
    }

    res.status(200).json(updatedWithdrawal);
  } catch (error) {
    res.status(500).json({ message: 'Error updating withdrawal', error: error.message });
  }
};

/**
 * Migration endpoint: Find ALL paid withdrawals that are NOT marked as processed,
 * and fix their transaction status + mark them as processed WITHOUT re-deducting
 * (since old code may have partially deducted already).
 * 
 * For each unprocessed paid withdrawal:
 *   - If transaction status is already "paid" → just mark as processed (deduction already happened)
 *   - If transaction status is NOT "paid" → update transaction to "paid" and mark as processed
 *   - Do NOT re-run investment deductions (to avoid double deductions from old buggy code)
 */
exports.migrateUnprocessedPaidWithdrawals = async (req, res) => {
  try {
    // Find all paid withdrawals that haven't been processed yet
    const unprocessedWithdrawals = await Withdrawal.find({
      status: 'paid',
      $or: [
        { processed: false },
        { processed: { $exists: false } }
      ]
    });

    console.log(`Found ${unprocessedWithdrawals.length} unprocessed paid withdrawals.`);

    const results = [];
    for (const withdrawal of unprocessedWithdrawals) {
      const existingTx = await Transaction.findOne({
        referenceId: withdrawal._id,
        referenceType: 'Withdrawal'
      });

      let action = 'unknown';
      
      if (existingTx && existingTx.status === 'paid') {
        // Transaction already shows paid - deduction likely already happened
        // Just mark as processed
        await Withdrawal.updateOne(
          { _id: withdrawal._id },
          { $set: { processed: true } }
        );
        action = 'marked-processed-only (tx already paid)';
      } else if (existingTx) {
        // Transaction exists but is NOT paid - update it to paid
        // Do NOT re-deduct balances (old code may have partially deducted)
        await Transaction.findOneAndUpdate(
          { _id: existingTx._id },
          {
            $set: {
              status: 'paid',
              updatedAt: new Date(),
              description: `Withdrawal completed - ₹${withdrawal.amount}`
            }
          }
        );
        await Withdrawal.updateOne(
          { _id: withdrawal._id },
          { $set: { processed: true } }
        );
        action = 'fixed-tx-status + marked-processed (no re-deduction)';
      } else {
        // No transaction at all - create one
        const user = await User.findOne({
          $or: [{ email: withdrawal.userEmail }, { mobileNumber: withdrawal.userEmail }]
        });
        if (user) {
          await Transaction.create({
            userId: user._id,
            userEmail: withdrawal.userEmail,
            type: 'withdrawal',
            amount: withdrawal.amount,
            status: 'paid',
            referenceId: withdrawal._id,
            referenceType: 'Withdrawal',
            description: `Withdrawal completed - ₹${withdrawal.amount}`
          });
          await Withdrawal.updateOne(
            { _id: withdrawal._id },
            { $set: { processed: true } }
          );
          action = 'created-missing-tx + marked-processed (no re-deduction)';
        } else {
          action = 'error-user-not-found';
        }
      }

      results.push({
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        userEmail: withdrawal.userEmail,
        prevTxStatus: existingTx?.status || 'none',
        action
      });
    }

    res.status(200).json({
      message: `Processed ${results.length} unprocessed withdrawals`,
      processedCount: results.length,
      details: results
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during migration', error: error.message });
  }
};