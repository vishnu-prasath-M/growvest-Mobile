require('dotenv').config();
const mongoose = require('mongoose');
const Withdrawal = require('./models/Withdrawal');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zenvest-dummy';

async function fixUnprocessedWithdrawals() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all paid withdrawals that haven't been processed yet
    const unprocessedWithdrawals = await Withdrawal.find({
      status: 'paid',
      $or: [
        { processed: false },
        { processed: { $exists: false } }
      ]
    });

    console.log(`Found ${unprocessedWithdrawals.length} unprocessed paid withdrawals.`);

    for (const withdrawal of unprocessedWithdrawals) {
      console.log(`Processing withdrawal ${withdrawal._id} for ${withdrawal.userEmail}, amount: ${withdrawal.amount}`);
      
      // Find user
      const user = await User.findOne({
        $or: [{ email: withdrawal.userEmail }, { mobileNumber: withdrawal.userEmail }]
      });

      if (!user) {
        console.log(`User not found for withdrawal ${withdrawal._id}`);
        continue;
      }

      // Deduct from user balance
      user.balance = Math.max(0, (user.balance || 0) - withdrawal.amount);
      await user.save();
      console.log(`Deducted ${withdrawal.amount} from user balance. New balance: ${user.balance}`);

      // Find or create transaction
      const existingTx = await Transaction.findOne({
        referenceId: withdrawal._id,
        referenceType: 'Withdrawal'
      });

      if (existingTx) {
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
        console.log(`Updated transaction status to paid`);
      } else {
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
        console.log(`Created new transaction`);
      }

      // Mark withdrawal as processed
      await Withdrawal.updateOne(
        { _id: withdrawal._id },
        { $set: { processed: true } }
      );
      console.log(`Marked withdrawal as processed`);
    }

    console.log('Fix completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixUnprocessedWithdrawals();
