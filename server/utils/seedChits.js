const Chit = require('../models/Chit');

const seedChits = async () => {
  try {
    // Delete old chits first
    await Chit.deleteMany({ name: { $in: ['Silver Chit', 'Gold Chit', 'Premium Chit'] } });

    // Migrate all existing Chits to 0% processing fee
    await Chit.updateMany({}, { $set: { processingFee: 0, processingFeePercent: 0 } });

    const chitsToSeed = [
      {
        name: '₹200 Weekly Plan – 10 Weeks',
        description: '₹200 weekly savings for 10 weeks.',
        monthlyAmount: 200,
        weeklyAmount: 200,
        totalPot: 2000,
        totalContribution: 2000,
        duration: 10,
        totalWeeks: 10,
        totalMembers: 9999,
        availableSlots: 9999,
        paymentFrequency: 'weekly',
        paymentDay: 'Sunday',
        settlementWeek: 11,
        status: 'active',
        processingFee: 0,
        features: ['Weekly Contribution', '10-week tenure', 'No Processing Fee'],
      },
      {
        name: '₹200 Weekly Plan – 20 Weeks',
        description: '₹200 weekly savings for 20 weeks.',
        monthlyAmount: 200,
        weeklyAmount: 200,
        totalPot: 4000,
        totalContribution: 4000,
        duration: 20,
        totalWeeks: 20,
        totalMembers: 9999,
        availableSlots: 9999,
        paymentFrequency: 'weekly',
        paymentDay: 'Sunday',
        settlementWeek: 21,
        status: 'active',
        processingFee: 0,
        features: ['Weekly Contribution', '20-week tenure', 'No Processing Fee'],
      },
      {
        name: '₹500 Weekly Plan – 10 Weeks',
        description: '₹500 weekly savings for 10 weeks.',
        monthlyAmount: 500,
        weeklyAmount: 500,
        totalPot: 5000,
        totalContribution: 5000,
        duration: 10,
        totalWeeks: 10,
        totalMembers: 9999,
        availableSlots: 9999,
        paymentFrequency: 'weekly',
        paymentDay: 'Sunday',
        settlementWeek: 11,
        status: 'active',
        processingFee: 0,
        features: ['Weekly Contribution', '10-week tenure', 'No Processing Fee'],
      },
      {
        name: '₹500 Weekly Plan – 20 Weeks',
        description: '₹500 weekly savings for 20 weeks.',
        monthlyAmount: 500,
        weeklyAmount: 500,
        totalPot: 10000,
        totalContribution: 10000,
        duration: 20,
        totalWeeks: 20,
        totalMembers: 9999,
        availableSlots: 9999,
        paymentFrequency: 'weekly',
        paymentDay: 'Sunday',
        settlementWeek: 21,
        status: 'active',
        processingFee: 0,
        features: ['Weekly Contribution', '20-week tenure', 'No Processing Fee'],
      },
      {
        name: '₹1,000 Weekly Plan – 10 Weeks',
        description: '₹1,000 weekly savings for 10 weeks.',
        monthlyAmount: 1000,
        weeklyAmount: 1000,
        totalPot: 10000,
        totalContribution: 10000,
        duration: 10,
        totalWeeks: 10,
        totalMembers: 9999,
        availableSlots: 9999,
        paymentFrequency: 'weekly',
        paymentDay: 'Sunday',
        settlementWeek: 11,
        status: 'active',
        processingFee: 0,
        features: ['Weekly Contribution', '10-week tenure', 'No Processing Fee'],
      },
      {
        name: '₹1,000 Weekly Plan – 20 Weeks',
        description: '₹1,000 weekly savings for 20 weeks.',
        monthlyAmount: 1000,
        weeklyAmount: 1000,
        totalPot: 20000,
        totalContribution: 20000,
        duration: 20,
        totalWeeks: 20,
        totalMembers: 9999,
        availableSlots: 9999,
        paymentFrequency: 'weekly',
        paymentDay: 'Sunday',
        settlementWeek: 21,
        status: 'active',
        processingFee: 0,
        features: ['Weekly Contribution', '20-week tenure', 'No Processing Fee'],
      }
    ];

    for (const chitData of chitsToSeed) {
      const existingChit = await Chit.findOne({ name: chitData.name });
      if (!existingChit) {
        await Chit.create(chitData);
        console.log(`Seeded: ${chitData.name}`);
      } else {
        // Update existing to ensure correct parameters
        await Chit.updateOne({ name: chitData.name }, { $set: chitData });
      }
    }
    console.log('Chit seeding completed.');
  } catch (error) {
    console.error('Error seeding chits:', error);
  }
};

module.exports = { seedChits };
