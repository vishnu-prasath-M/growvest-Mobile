export const mapProfileToDashboard = (profile) => {
  if (!profile) {
    return null;
  }

  const savingBalance = profile.savingBalance ?? 0;
  const fixedBalance = profile.fixedBalance ?? 0;
  const totalInvested = profile.totalInvested ?? profile.totalInvestment ?? (savingBalance + fixedBalance);
  const totalInterestEarned = profile.totalInterestEarned ?? profile.totalInterest ?? profile.totalEarnings ?? 0;
  const availableToWithdraw = profile.availableToWithdraw ?? 0;
  const totalBalance = profile.totalBalance ?? (totalInvested + totalInterestEarned);

  return {
    user: {
      _id: profile._id,
      username: profile.username,
      name: profile.name,
      mobileNumber: profile.mobileNumber,
      email: profile.email,
      balance: totalBalance,
      role: profile.role,
    },
    balances: {
      savingBalance,
      fixedBalance,
      totalBalance,
      totalInvested,
      totalInterestEarned,
      totalEarned: totalInterestEarned,
      availableToWithdraw,
    },
  };
};

export const mapProfileToWithdrawUser = (profile) => {
  const savingBalance = profile?.savingBalance ?? 0;
  const fixedBalance = profile?.fixedBalance ?? 0;
  const totalInterest = profile?.totalInterest ?? profile?.totalEarnings ?? 0;
  const totalBalance = (profile?.totalBalance != null)
    ? profile.totalBalance
    : savingBalance + fixedBalance;

  return {
    ...(profile || {}),
    savingBalance,
    fixedBalance,
    availableToWithdraw: profile?.availableToWithdraw ?? 0,
    totalBalance,
    totalInterest,
  };
};
