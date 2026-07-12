const Chit = require('../models/Chit');

const seedChits = async () => {
  try {
    const chitsToSeed = [
      {
        name: 'Silver Chit',
        description: 'Starter plan for small savings.',
        monthlyAmount: 1000,
        totalPot: 20000,
        duration: 20,
        totalMembers: 20,
        availableSlots: 20,
        status: 'active',
        processingFee: 2,
        features: ['Low entry cost', 'Quick duration'],
      },
      {
        name: 'Gold Chit',
        description: 'Balanced plan for medium savings.',
        monthlyAmount: 2500,
        totalPot: 62500,
        duration: 25,
        totalMembers: 25,
        availableSlots: 25,
        status: 'active',
        processingFee: 2,
        features: ['Medium entry cost', 'Good returns'],
      },
      {
        name: 'Premium Chit',
        description: 'High-value plan for big goals.',
        monthlyAmount: 5000,
        totalPot: 100000,
        duration: 20,
        totalMembers: 20,
        availableSlots: 20,
        status: 'active',
        processingFee: 2,
        features: ['High entry cost', 'High returns', 'Priority support'],
      }
    ];

    for (const chitData of chitsToSeed) {
      const existingChit = await Chit.findOne({ name: chitData.name });
      if (!existingChit) {
        await Chit.create(chitData);
        console.log(`Seeded: ${chitData.name}`);
      }
    }
  } catch (error) {
    console.error('Error seeding chits:', error);
  }
};

module.exports = { seedChits };
