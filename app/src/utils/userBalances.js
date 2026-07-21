export const mapProfileToDashboard = (profile) => {
  if (!profile) {
    return null;
  }

  // Use server-computed balances which already include interestEarned.
  // NEVER fall back to profile.balance (stale user.balance field from MongoDB)
  // as it does not reflect daily-accrued interest or approved withdrawals.
  const savingBalance = profile.savingBalance ?? 0;
  const fixedBalance = profile.fixedBalance ?? 0;
  const totalInterest = profile.totalInterest ?? profile.totalEarnings ?? 0;

  // Compute totalBalance from the two components (both already include their interest).
  // If server explicitly sends totalBalance, use that; otherwise compute it.
  const totalBalance = (profile.totalBalance != null)
    ? profile.totalBalance
    : savingBalance + fixedBalance;

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
      totalInterest,
      availableToWithdraw: profile.availableToWithdraw ?? 0,
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
