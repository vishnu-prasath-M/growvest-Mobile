export const mapProfileToDashboard = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    user: {
      _id: profile._id,
      username: profile.username,
      name: profile.name,
      mobileNumber: profile.mobileNumber,
      email: profile.email,
      balance: profile.balance ?? profile.totalBalance ?? 0,
      role: profile.role,
    },
    balances: {
      savingBalance: profile.savingBalance ?? 0,
      fixedBalance: profile.fixedBalance ?? 0,
      totalBalance: profile.totalBalance ?? profile.balance ?? 0,
      totalInterest: profile.totalInterest ?? 0,
      availableToWithdraw: profile.availableToWithdraw ?? 0,
    },
  };
};

export const mapProfileToWithdrawUser = (profile) => ({
  ...(profile || {}),
  savingBalance: profile?.savingBalance ?? 0,
  fixedBalance: profile?.fixedBalance ?? 0,
  availableToWithdraw: profile?.availableToWithdraw ?? 0,
  totalBalance: profile?.totalBalance ?? profile?.balance ?? 0,
  totalInterest: profile?.totalInterest ?? 0,
});
