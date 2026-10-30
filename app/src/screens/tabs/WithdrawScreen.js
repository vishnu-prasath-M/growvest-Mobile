import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { userService } from '../../services/userService';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import { withdrawalService } from '../../services/withdrawalService';
import { investmentService } from '../../services/investmentService';
import { chitFundService } from '../../services/chitFundService';
import { sipService } from '../../services/sipService';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';
import { colors } from '../../theme/theme';
import { mapProfileToWithdrawUser } from '../../utils/userBalances';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import DepositDetailModal from '../../components/DepositDetailModal';
import ModernAlertModal from '../../components/ModernAlertModal';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

const CATEGORIES = [
  {
    id: 'investment',
    name: 'Investments',
    badge: 'Fixed & Savings',
    colors: ['#0E3D23', '#1A5C39', '#2E8B5A'],
    blobColor: 'rgba(212, 175, 55, 0.22)',
    icon: 'chart-line',
    accent: '#D4AF37',
  },
  {
    id: 'chit',
    name: 'Chit Fund',
    badge: 'Auction & Winning',
    colors: ['#0A2540', '#134E5E', '#1A73E8'],
    blobColor: 'rgba(59, 130, 246, 0.22)',
    icon: 'account-group',
    accent: '#60A5FA',
  },
  {
    id: 'sip',
    name: 'SIP Wealth',
    badge: 'Systematic Plan',
    colors: ['#2E1065', '#581C87', '#7C3AED'],
    blobColor: 'rgba(139, 92, 246, 0.22)',
    icon: 'calendar-clock',
    accent: '#C4B5FD',
  },
  {
    id: 'pocket_money',
    name: 'Pocket Money',
    badge: 'Scheduled Release',
    colors: ['#451A03', '#78350F', '#B45309'],
    blobColor: 'rgba(245, 158, 11, 0.22)',
    icon: 'wallet-giftcard',
    accent: '#FCD34D',
  },
];

const WithdrawScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [bankInfo, setBankInfo] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawType, setWithdrawType] = useState('investment');
  const [activeCategory, setActiveCategory] = useState('investment');
  const [listFilter, setListFilter] = useState('auto');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [selectedChitId, setSelectedChitId] = useState(null);
  const [emailRequiredModalVisible, setEmailRequiredModalVisible] = useState(false);
  const [investments, setInvestments] = useState([]);
  const carouselRef = useRef(null);

  // Modern Alert state
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    type: 'payout',
    title: '',
    message: '',
    primaryText: 'OK',
    onPrimary: null,
  });

  const showAlert = (type, title, message, primaryText = 'OK', onPrimary = null) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      primaryText,
      onPrimary: () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        if (onPrimary) onPrimary();
      },
    });
  };

  const fetchUserData = async () => {
    try {
      const [profile, user, kycRes, dashRes] = await Promise.all([
        userService.getUserProfile().catch(() => null),
        authService.getUserData().catch(() => null),
        api.get(API_ENDPOINTS.KYC_STATUS).catch(() => null),
        dashboardService.getDashboard().catch(() => null),
      ]);
      const currentUser = profile || user;
      if (currentUser) {
        setUserData(mapProfileToWithdrawUser(currentUser));
      }
      if (dashRes) {
        setDashboardData(dashRes);
      }
      if (kycRes?.data?.data) {
        setBankInfo(kycRes.data.data);
      }

      // Fetch all investment types in parallel
      const [allInvestments, myChits, pocketMoneyRes, sipRes] = await Promise.all([
        investmentService.getInvestments().catch(() => []),
        chitFundService.getMyChits().catch(() => []),
        api.get('/pocket-money/my').catch(() => ({ data: [] })),
        sipService.getMySIPs().catch(() => ({ sips: [] })),
      ]);

      // Savings/Fixed investments — already scoped to logged-in user by backend
      const validInvestments = (allInvestments || []).filter(inv => inv.status !== 'rejected');

      // Chit Fund memberships
      const activeChitItems = (myChits || []).filter(c => c.status === 'active' || c.status === 'approved' || c.status === 'completed').map(c => {
        const totalWeeks = c.totalWeeks || c.duration || 10;
        const currentWeek = c.currentWeek || c.currentMonth || c.paidWeeks || 1;
        const lockedCount = c.lockedCount !== undefined ? c.lockedCount : Math.floor((totalWeeks - 1) / 2);
        const isUnlocked = c.isUnlocked !== undefined ? c.isUnlocked : (currentWeek > lockedCount);
        const isSettlement = currentWeek >= totalWeeks;

        let priceAmount = Number(c.priceAmount) || 0;
        if (!priceAmount) {
          const totalPot = Number(c.totalPot) || ((Number(c.weeklyAmount || c.monthlyAmount || 0)) * totalWeeks);
          if (isSettlement) {
            priceAmount = totalPot;
          } else if (isUnlocked) {
            const baseEndPct = totalWeeks >= 20 ? 8 : 6;
            const actionPct = baseEndPct + 2 * (totalWeeks - currentWeek);
            priceAmount = totalPot - (totalPot * actionPct / 100);
          }
        }

        const isWithdrawn = c.withdrawalStatus === 'completed' || c.withdrawalStatus === 'withdrawn' || c.withdrawalStatus === 'approved';
        const isRequested = c.withdrawalStatus === 'requested';
        const withdrawalAmount = Number(c.withdrawalAmount) || priceAmount;
        const totalPaid = Number(c.totalPaid) || (Number(c.paidWeeks || currentWeek) * Number(c.weeklyAmount || 0));

        return {
          _id: c._id,
          chitId: c.chitId?._id || c.chitId || c._id,
          isChit: true,
          type: 'chit',
          chitName: c.chitName || 'Chit Fund Plan',
          amount: isWithdrawn || isRequested ? withdrawalAmount : (isUnlocked ? priceAmount : totalPaid),
          displayAmount: isWithdrawn || isRequested ? withdrawalAmount : (isUnlocked ? priceAmount : totalPaid),
          priceAmount,
          isUnlocked,
          isWithdrawn,
          isRequested,
          withdrawalStatus: c.withdrawalStatus,
          withdrawalAmount,
          withdrawalWeek: c.withdrawalWeek || currentWeek,
          totalPaid,
          weeklyAmount: c.weeklyAmount || 0,
          currentWeek,
          totalWeeks,
          lockedCount,
          eligibleStart: lockedCount + 1,
          hasWon: c.hasWon || false,
          winningAmount: c.winningAmount || priceAmount,
          status: isWithdrawn ? 'withdrawn' : (isRequested ? 'requested' : (isUnlocked ? 'unlocked' : 'active')),
          joinedAt: c.joinedAt,
        };
      });

      // Pocket Money investments
      const pocketMoneyPlans = (pocketMoneyRes?.data || []);
      const pocketMoneyItems = pocketMoneyPlans
        .filter(pm => pm.status === 'active' || pm.status === 'completed')
        .map(pm => ({
          _id: pm._id,
          isPocketMoney: true,
          type: 'pocket_money',
          amount: pm.investedAmount || 0,
          investedAmount: pm.investedAmount || 0,
          remainingAmount: pm.remainingAmount || 0,
          totalPaidOut: pm.totalPaidOut || 0,
          payoutAmount: pm.payoutAmount || 0,
          payoutCount: pm.payoutCount || 0,
          frequency: pm.frequency || 'daily',
          nextPayoutDate: pm.nextPayoutDate,
          finalPayoutDate: pm.finalPayoutDate,
          status: pm.status,
          startDate: pm.startDate,
          bonusAmount: pm.bonusAmount || 0,
          totalFinalValue: pm.totalFinalValue || 0,
        }));

      // SIP Investments
      const sipPlans = sipRes?.sips || [];
      const sipItems = sipPlans.map(s => {
        const totalPaid = Number(s.totalPaidAmount) || 0;
        const withdrawn = Number(s.withdrawnAmount) || 0;
        const isPlanCompleted = s.status === 'completed' || (s.totalContributions && Number(s.contributionsCompleted) >= Number(s.totalContributions));
        const available = isPlanCompleted
          ? (s.availableToWithdraw !== undefined
              ? Math.max(0, Number(s.availableToWithdraw))
              : Math.max(0, totalPaid + (Number(s.expectedInterest) || 0) - withdrawn))
          : 0;
        return {
          _id: s._id,
          sipId: s.sipId,
          isSIP: true,
          type: 'sip',
          amount: totalPaid,
          monthlyAmount: s.amount,
          totalPaidAmount: totalPaid,
          withdrawnAmount: withdrawn,
          availableToWithdraw: available,
          interestEarned: s.interestEarned || 0,
          status: s.status,
          contributionsCompleted: s.contributionsCompleted,
          totalContributions: s.totalContributions,
          frequency: s.frequency,
          startDate: s.createdAt,
          interestRate: s.interestRate || 26,
          isPlanCompleted,
        };
      });

      setInvestments([...validInvestments, ...activeChitItems, ...pocketMoneyItems, ...sipItems]);
    } catch (error) {
      console.error('Error fetching user profile & investments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPlanDisplayName = (type) => {
    if (type === 'saving') return 'Saving Deposit';
    if (type === 'fixed') return 'Fixed Deposit';
    if (type === '15_days') return '15 Days Plan';
    if (type === '1_month') return '1 Month Plan';
    if (type === '3_months') return '3 Months Plan';
    if (type === '6_months') return '6 Months Plan';
    if (type === '1_year') return '1 Year Plan';
    return 'Investment Plan';
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  // Polling for auto-updating UI
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchUserData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const formatCurrency = (amount) => {
    return `₹${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyNoDecimals = (amount) => {
    return `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;
  };

  // ── Calculation of Available To Withdraw Breakdown Per Category ──
  // 1. Fixed & Savings Investments
  const validInvestmentsOnly = investments.filter(inv => !inv.isChit && !inv.isPocketMoney && !inv.isSIP);
  const investmentEarnings = validInvestmentsOnly.reduce((sum, inv) => {
    const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
    const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
    const totalDeducted = Number(inv.withdrawnAmount) || 0;
    if (isMatured && !isWithdrawn && inv.status === 'approved') {
      const full = Number(inv.maturityAmount) || (Number(inv.amount) + (Number(inv.totalInterest) || 0));
      return sum + Math.max(0, full - totalDeducted);
    }
    const intendedDate = inv.intendedWithdrawalDate || inv.selectedWithdrawalDate;
    const isEarlyUnlocked = intendedDate && new Date() >= new Date(intendedDate) && !isWithdrawn && inv.status === 'approved';
    if (isEarlyUnlocked && !isMatured) {
      const principal = Number(inv.earlyPrincipalOnlyAmount) || Number(inv.amount) || 0;
      return sum + Math.max(0, principal - totalDeducted);
    }
    return sum;
  }, 0);

  // For Fixed & Savings investments, only matured/unlocked fixed deposit funds belong here
  const serverMaturedAvailable = Number(dashboardData?.balances?.maturedAvailableOnly ?? userData?.maturedAvailableOnly ?? 0);
  const investmentAvailable = serverMaturedAvailable > 0 ? serverMaturedAvailable : investmentEarnings;
  const activeInvestmentsCount = validInvestmentsOnly.filter(inv => {
    const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
    return (inv.status === 'approved' || inv.status === 'active') && !isMatured && inv.status !== 'withdrawn' && inv.status !== 'rejected';
  }).length;

  // 2. Chit Fund
  const activeChitItems = investments.filter(inv => inv.isChit);
  const eligibleMaturedChits = activeChitItems.filter(inv => {
    if (inv.isWithdrawn || inv.withdrawalStatus === 'completed' || inv.withdrawalStatus === 'withdrawn' || inv.withdrawalStatus === 'approved') {
      return false;
    }
    if (inv.isRequested || inv.withdrawalStatus === 'requested') {
      return false;
    }
    return inv.isUnlocked || inv.hasWon;
  });

  const selectedChit = (selectedChitId ? eligibleMaturedChits.find(c => String(c._id) === String(selectedChitId)) : null) || eligibleMaturedChits[0] || null;
  const selectedChitPayout = selectedChit ? (Number(selectedChit.priceAmount) || Number(selectedChit.winningAmount) || Number(selectedChit.amount) || 0) : 0;

  const chitAvailable = activeChitItems.reduce((sum, inv) => {
    if (inv.isWithdrawn || inv.withdrawalStatus === 'completed' || inv.withdrawalStatus === 'withdrawn' || inv.withdrawalStatus === 'approved') {
      return sum;
    }
    if (inv.isRequested || inv.withdrawalStatus === 'requested') {
      return sum;
    }
    if (inv.isUnlocked) {
      return sum + (Number(inv.priceAmount) || Number(inv.amount) || 0);
    }
    if (inv.hasWon) {
      return sum + (Number(inv.winningAmount) || 0);
    }
    return sum;
  }, 0);
  const activeChitsCount = activeChitItems.filter(inv => !inv.isWithdrawn).length;
  const chitTotalPaid = activeChitItems.reduce((sum, inv) => sum + (Number(inv.totalPaid) || Number(inv.amount) || 0), 0);

  // 3. SIP Plans
  const activeSIPItems = investments.filter(inv => inv.isSIP);
  const sipAvailable = activeSIPItems.reduce((sum, inv) => sum + (Number(inv.availableToWithdraw) || 0), 0);
  const activeSIPCount = activeSIPItems.filter(inv => inv.status === 'active').length;
  const sipTotalInvested = activeSIPItems.reduce((sum, inv) => sum + (Number(inv.totalPaidAmount) || Number(inv.amount) || 0), 0);

  // 4. Pocket Money
  const activePMItems = investments.filter(inv => inv.isPocketMoney);
  const pocketMoneyAvailable = activePMItems.reduce((sum, pm) => {
    if (pm.status === 'completed') {
      return sum + (Number(pm.remainingAmount) || 0);
    }
    return sum + (Number(pm.payoutAmount) || Number(pm.remainingAmount) || 0);
  }, 0);
  const activePMCount = activePMItems.filter(inv => inv.status === 'active').length;
  const pmTotalPaidOut = activePMItems.reduce((sum, inv) => sum + (Number(inv.totalPaidOut) || 0), 0);

  // Category balance dictionary
  const categoryBalances = {
    investment: {
      available: investmentAvailable,
      stat1Label: 'Active Deposits',
      stat1Val: activeInvestmentsCount,
      stat2Label: 'Matured Returns',
      stat2Val: formatCurrency(investmentAvailable),
    },
    chit: {
      available: chitAvailable,
      stat1Label: 'Active Chits',
      stat1Val: activeChitsCount,
      stat2Label: 'Total Paid In',
      stat2Val: formatCurrencyNoDecimals(chitTotalPaid),
    },
    sip: {
      available: sipAvailable,
      stat1Label: 'Active SIPs',
      stat1Val: activeSIPCount,
      stat2Label: 'Total Accumulated',
      stat2Val: formatCurrencyNoDecimals(sipTotalInvested),
    },
    pocket_money: {
      available: pocketMoneyAvailable,
      stat1Label: 'Active Plans',
      stat1Val: activePMCount,
      stat2Label: 'Total Released',
      stat2Val: formatCurrencyNoDecimals(pmTotalPaidOut),
    },
  };

  const currentCategoryConfig = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  const currentCategoryAvailable = categoryBalances[activeCategory]?.available || 0;

  const selectCategory = (catId, idx) => {
    setActiveCategory(catId);
    if (catId === 'chit') {
      setAmount(selectedChitPayout > 0 ? String(selectedChitPayout) : '');
    } else {
      setAmount('');
    }
    carouselRef.current?.scrollTo({ x: idx * (CARD_WIDTH + 14), animated: true });
  };

  const handleChitWithdrawal = (chitItem) => {
    const payoutAmt = Number(chitItem.priceAmount) || Number(chitItem.amount) || 0;
    showAlert(
      'confirm',
      'Confirm Chit Payout Withdrawal',
      `Are you sure you want to withdraw your Chit payout price amount of ${formatCurrency(payoutAmt)} now? You can only withdraw once per Chit cycle.`,
      'Withdraw',
      async () => {
        try {
          setLoading(true);
          const res = await chitFundService.withdrawChitPayout(chitItem._id);
          showAlert(
            'payout',
            'Withdrawal Requested ⌛',
            res?.message || `Your Chit payout request of ${formatCurrency(payoutAmt)} has been submitted successfully and is pending admin approval.`,
            'Got It'
          );
          fetchUserData();
        } catch (err) {
          const errMsg = err?.response?.data?.message || err?.message || 'Could not process chit withdrawal.';
          showAlert('error', 'Withdrawal Failed', errMsg);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const openWithdrawModal = (type) => {
    setWithdrawType(type);
    const targetInv = investments.find(inv => String(inv._id) === String(type));
    if (targetInv) {
      if (targetInv.isChit) {
        handleChitWithdrawal(targetInv);
        return;
      }
      const defaultAmt = targetInv.availableToWithdraw || targetInv.earlyPrincipalOnlyAmount || targetInv.amount || 0;
      setAmount(String(defaultAmt || ''));
    }
    if (bankInfo?.upiId) {
      setUpiId(bankInfo.upiId);
    } else if (userData?.upiId) {
      setUpiId(userData.upiId);
    }
    setWithdrawModalVisible(true);
  };

  const handleMainWithdrawRequest = () => {
    if (activeCategory === 'chit') {
      if (!selectedChit || selectedChitPayout <= 0) {
        showAlert('warning', 'No Eligible Chit', 'You currently do not have any matured or unlocked Chit Fund eligible for withdrawal.');
        return;
      }
      setAmount(String(selectedChitPayout));
    } else {
      if (currentCategoryAvailable <= 0) {
        showAlert('warning', 'No Available Balance', `You currently do not have any available balance to withdraw in ${currentCategoryConfig.name}.`);
        return;
      }
      const numAmt = parseFloat(amount);
      if (!amount || isNaN(numAmt) || numAmt <= 0) {
        showAlert('warning', 'Enter Amount', `Please enter a valid amount to withdraw from ${currentCategoryConfig.name}.`);
        return;
      }
      if (numAmt > currentCategoryAvailable) {
        showAlert(
          'warning',
          'Exceeds Category Balance',
          `The entered amount (₹${numAmt}) exceeds your available ${currentCategoryConfig.name} balance of ${formatCurrency(currentCategoryAvailable)}. You can only withdraw up to ${formatCurrency(currentCategoryAvailable)} from ${currentCategoryConfig.name}.`
        );
        return;
      }
    }

    if (!bankInfo?.accountNumber && !bankInfo?.upiId && !userData?.upiId) {
      showAlert(
        'warning',
        'Bank Account Required',
        'Please link your Bank Account or UPI ID before requesting a withdrawal.',
        'Add Bank Details',
        () => navigation.navigate('BankDetails')
      );
      return;
    }

    // Pre-populate UPI / Bank ID
    setUpiId(bankInfo?.upiId || userData?.upiId || `${bankInfo?.accountNumber || 'bank'}@upi`);
    setWithdrawType(activeCategory);
    setWithdrawModalVisible(true);
  };

  const handleWithdraw = async () => {
    const isChitCategory = activeCategory === 'chit' || withdrawType === 'chit';
    const numAmt = isChitCategory ? selectedChitPayout : parseFloat(amount);
    if (!isChitCategory && (!amount || isNaN(numAmt) || numAmt <= 0)) {
      showAlert('warning', 'Invalid Amount', 'Please enter a valid amount to withdraw.');
      return;
    }

    if (!isChitCategory && numAmt > currentCategoryAvailable) {
      showAlert(
        'warning',
        'Exceeds Balance',
        `The entered amount exceeds your available ${currentCategoryConfig.name} balance of ${formatCurrency(currentCategoryAvailable)}.`
      );
      return;
    }

    if (!upiId || !upiId.trim()) {
      showAlert('warning', 'Invalid UPI ID', 'Please enter your UPI ID (e.g. username@okhdfcbank)');
      return;
    }
    
    if (!/^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,64}$/.test(upiId.trim())) {
      showAlert('warning', 'Invalid UPI ID', 'Please enter a valid UPI ID format (e.g. username@okhdfcbank or 9876543210@paytm).');
      return;
    }
    
    setWithdrawing(true);
    try {
      if (isChitCategory) {
        if (!selectedChit) {
          showAlert('warning', 'No Chit Selected', 'Please select a matured Chit Fund to withdraw.');
          return;
        }
        await chitFundService.withdrawChitPayout(selectedChit._id, {
          amount: selectedChitPayout,
          upiId: upiId.trim(),
        });
        showAlert(
          'payout',
          'Chit Payout Requested ⌛',
          `Your Chit payout withdrawal request of ${formatCurrency(selectedChitPayout)} for ${selectedChit.chitName || 'Chit Fund'} has been submitted successfully and is pending admin approval. Once approved, this chit cycle will be completed.`,
          'Got It'
        );
      } else if (activeCategory === 'sip') {
        // Find single SIP that can cover the full requested amount first
        const sortedSIPs = [...activeSIPItems]
          .filter(s => (s.availableToWithdraw || 0) > 0)
          .sort((a, b) => (b.availableToWithdraw || 0) - (a.availableToWithdraw || 0));

        const singleFitSIP = sortedSIPs.find(s => s.availableToWithdraw >= numAmt);
        if (singleFitSIP) {
          await sipService.withdrawSIP(singleFitSIP._id, numAmt, upiId.trim());
        } else if (sortedSIPs.length > 0) {
          // If no single SIP covers total, deduct across available SIPs
          let remainingToWithdraw = numAmt;
          for (const s of sortedSIPs) {
            if (remainingToWithdraw <= 0) break;
            const deduct = Math.min(remainingToWithdraw, s.availableToWithdraw);
            if (deduct > 0) {
              await sipService.withdrawSIP(s._id, deduct, upiId.trim());
              remainingToWithdraw -= deduct;
            }
          }
        } else {
          await withdrawalService.createWithdrawal({
            amount: numAmt,
            upiId: upiId.trim(),
            userName: userData?.name || userData?.username || 'User',
            userEmail: userData?.email || userData?.mobileNumber || '',
            withdrawType: 'sip',
          });
        }
        showAlert(
          'payout',
          'SIP Withdrawal Requested ⌛',
          `Your SIP withdrawal request of ${formatCurrency(numAmt)} has been submitted successfully and is pending admin approval.`,
          'Got It'
        );
      } else if (activeCategory === 'pocket_money') {
        const eligiblePM = activePMItems.find(pm => (pm.payoutAmount > 0 || pm.remainingAmount > 0) && pm.status !== 'completed') || activePMItems[0];
        if (eligiblePM) {
          await api.post(`/pocket-money/request-payout/${eligiblePM._id}`);
        } else {
          await withdrawalService.createWithdrawal({
            amount: numAmt,
            upiId: upiId.trim(),
            userName: userData?.name || userData?.username || 'User',
            userEmail: userData?.email || userData?.mobileNumber || '',
            withdrawType: 'pocket_money',
          });
        }
        showAlert(
          'payout',
          'Pocket Money Release Requested ⌛',
          `Your Pocket Money release request of ${formatCurrency(numAmt)} has been submitted successfully.`,
          'Got It'
        );
      } else {
        const effectiveWithdrawType = (withdrawType && withdrawType !== 'investment' && withdrawType !== 'all') ? withdrawType : 'saving';
        await withdrawalService.createWithdrawal({
          amount: numAmt,
          upiId: upiId.trim(),
          userName: userData?.name || userData?.username || 'User',
          userEmail: userData?.email || userData?.mobileNumber || '',
          withdrawType: effectiveWithdrawType,
        });
        showAlert(
          'payout',
          'Withdrawal Requested ⌛',
          `Your investment withdrawal request of ${formatCurrency(numAmt)} has been submitted successfully and is pending admin approval.`,
          'Got It'
        );
      }
      setWithdrawModalVisible(false);
      setAmount('');
      fetchUserData();
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || error?.error || (typeof error === 'string' ? error : 'Failed to process withdrawal request');
      showAlert('error', 'Withdrawal Failed', errMsg);
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerPlaceholder, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.headerSub}>Withdraw</Text>
          <Text style={styles.headerTitle}>Move money out</Text>
        </View>
        <SkeletonLoader variant="form" />
      </View>
    );
  }

  // Display user bank account formatting
  const bankDisplayTitle = bankInfo?.bankName
    ? `${bankInfo.bankName} •••• ${bankInfo.accountNumber ? String(bankInfo.accountNumber).slice(-4) : '••••'}`
    : (userData?.upiId ? `UPI: ${userData.upiId}` : 'Add Bank Account / UPI');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.headerSub}>Withdraw</Text>
        <Text style={styles.headerTitle}>Move money out</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, colors.secondary]}
          />
        }
      >
        {/* ── Category Pill Switcher ── */}
        <View style={styles.categoryPillsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsContent}
          >
            {CATEGORIES.map((cat, idx) => {
              const isSelected = activeCategory === cat.id;
              const catBal = categoryBalances[cat.id]?.available || 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryPill,
                    isSelected && styles.categoryPillActive,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => selectCategory(cat.id, idx)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={15}
                    color={isSelected ? '#FFFFFF' : (isDarkMode ? '#9CA3AF' : '#686D62')}
                  />
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                  {catBal > 0 && (
                    <View style={[styles.categoryPillDot, isSelected && styles.categoryPillDotActive]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Top Swipeable Main Cards Carousel (Single focused category front card) ── */}
        <View style={styles.carouselOuterWrapper}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + 14}
            snapToAlignment="center"
            contentContainerStyle={styles.carouselScrollContent}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / (CARD_WIDTH + 14));
              if (idx >= 0 && idx < CATEGORIES.length) {
                setActiveCategory(CATEGORIES[idx].id);
                setAmount('');
              }
            }}
          >
            {CATEGORIES.map((cat, idx) => {
              const balData = categoryBalances[cat.id] || {};
              const availAmt = balData.available || 0;

              return (
                <View key={cat.id} style={[styles.heroOuter, { width: CARD_WIDTH }]}>
                  <LinearGradient
                    colors={cat.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                  >
                    <View style={[styles.heroBlob, { backgroundColor: cat.blobColor }]} />
                    
                    <View style={styles.heroTopRow}>
                      <View style={styles.heroCategoryBadge}>
                        <MaterialCommunityIcons name={cat.icon} size={13} color={cat.accent} />
                        <Text style={[styles.heroCategoryBadgeText, { color: cat.accent }]}>{cat.name} • {cat.badge}</Text>
                      </View>
                      <View style={styles.swipeHintBadge}>
                        <Text style={styles.swipeHintText}>{idx + 1}/{CATEGORIES.length}</Text>
                      </View>
                    </View>

                    <Text style={styles.heroLabel}>Available to withdraw</Text>
                    <Text style={styles.heroAmount}>{formatCurrency(availAmt)}</Text>
                    <Text style={styles.heroNote}>Direct UPI Payouts • Bank Level Security</Text>

                    <View style={styles.heroBottomRow}>
                      <View>
                        <Text style={styles.heroBottomLabel}>{balData.stat1Label}</Text>
                        <Text style={styles.heroBottomValue}>{balData.stat1Val}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.heroBottomLabel}>{balData.stat2Label}</Text>
                        <Text style={[styles.heroBottomValue, { color: cat.accent }]}>
                          {balData.stat2Val}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </ScrollView>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {CATEGORIES.map((cat, idx) => {
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => selectCategory(cat.id, idx)}
                  style={[styles.dot, isActive && styles.dotActive]}
                />
              );
            })}
          </View>
        </View>

        {/* ── Withdrawal Form Section (Bounded strictly to active front card) ── */}
        <View style={styles.section}>
          <View style={styles.formSectionHeader}>
            <Text style={styles.formSectionLabel}>Withdraw from {currentCategoryConfig.name}</Text>
            {currentCategoryAvailable > 0 && (
              <Text style={styles.formSectionSub}>Limit: {formatCurrency(currentCategoryAvailable)}</Text>
            )}
          </View>

          {/* Amount Input Card */}
          {activeCategory === 'chit' ? (
            <View>
              {/* Interactive Chit Selector if user has multiple matured chits */}
              {eligibleMaturedChits.length > 1 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Select Matured Chit Fund to Withdraw ({eligibleMaturedChits.length} Available)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                    {eligibleMaturedChits.map((c) => {
                      const isSelected = selectedChit?._id === c._id;
                      const cPayout = Number(c.priceAmount) || Number(c.winningAmount) || Number(c.amount) || 0;
                      return (
                        <TouchableOpacity
                          key={c._id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedChitId(c._id);
                            setAmount(String(cPayout));
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 14,
                            backgroundColor: isSelected
                              ? (isDarkMode ? 'rgba(52, 211, 153, 0.2)' : '#DCFCE7')
                              : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                            borderWidth: 1.5,
                            borderColor: isSelected ? '#34D399' : (isDarkMode ? '#334155' : '#E2E8F0'),
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isSelected ? 'check-circle' : 'circle-outline'}
                            size={18}
                            color={isSelected ? '#059669' : (isDarkMode ? '#94A3B8' : '#64748B')}
                          />
                          <View>
                            <Text style={{ fontSize: 12.5, fontWeight: '800', color: isSelected ? (isDarkMode ? '#34D399' : '#059669') : (isDarkMode ? '#F8FAFC' : '#0F172A') }}>
                              {c.chitName || 'Chit Fund'}
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                              Payout: {formatCurrency(cPayout)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {eligibleMaturedChits.length === 0 ? (
                <View style={[styles.amountInputCard, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color={isDarkMode ? '#F59E0B' : '#D97706'} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#FBBF24' : '#D97706' }}>
                      No Matured Chit Fund Available Yet
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 6, lineHeight: 17 }}>
                    Your Chit Funds will become eligible for withdrawal once their cycle reaches the designated unlock week or settlement.
                  </Text>
                </View>
              ) : (
                <View style={[styles.amountInputCard, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={[styles.heroStatLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                        {selectedChit?.chitName ? `${selectedChit.chitName} Payout` : 'Full Chit Payout Amount'}
                      </Text>
                      <Text style={[styles.amountTextInput, { fontSize: 24, fontWeight: '800', color: currentCategoryConfig.accent }]}>
                        {formatCurrency(selectedChitPayout)}
                      </Text>
                    </View>
                    <View style={[styles.primaryBadge, { backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.15)' : '#DCFCE7', borderWidth: 1, borderColor: '#34D399', paddingHorizontal: 10, paddingVertical: 5 }]}>
                      <Text style={[styles.primaryBadgeText, { color: isDarkMode ? '#34D399' : '#059669', fontWeight: '700' }]}>Single Chit Payout</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 8, lineHeight: 16 }}>
                    💡 Chit fund rule: You are withdrawing {formatCurrency(selectedChitPayout)} specifically from {selectedChit?.chitName || 'this chit fund'}. Your other chit funds remain active and untouched.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.amountInputCard}>
              <View style={styles.amountLeft}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.amountTextInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                />
              </View>

              <TouchableOpacity
                style={styles.availableBadge}
                activeOpacity={0.7}
                onPress={() => setAmount(String(currentCategoryAvailable > 0 ? currentCategoryAvailable : ''))}
              >
                <Text style={styles.availableBadgeLabel}>Available</Text>
                <Text style={[styles.availableBadgeValue, { color: currentCategoryConfig.accent }]}>
                  {formatCurrency(currentCategoryAvailable)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bank Account / UPI Card */}
          <TouchableOpacity
            style={styles.bankAccountCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('BankDetails')}
          >
            <View style={styles.bankMintIconBox}>
              <MaterialCommunityIcons name="bank-outline" size={20} color={isDarkMode ? '#34D399' : '#0E3D23'} />
            </View>
            <View style={styles.bankInfoContent}>
              <Text style={styles.bankLabel}>Bank account / UPI</Text>
              <Text style={styles.bankTitle} numberOfLines={1}>{bankDisplayTitle}</Text>
            </View>
            {bankInfo?.bankName ? (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? '#6B7280' : '#8E9486'} />
            )}
          </TouchableOpacity>

          {/* Request Withdrawal Button — Enabled only for current category available balance */}
          {currentCategoryAvailable > 0 ? (
            <>
              <TouchableOpacity
                style={styles.requestBtnOuter}
                activeOpacity={0.85}
                onPress={handleMainWithdrawRequest}
              >
                <LinearGradient
                  colors={currentCategoryConfig.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.requestBtnGradient}
                >
                  <MaterialCommunityIcons name="arrow-top-right" size={18} color="#FFFFFF" />
                  <Text style={styles.requestBtnText}>
                    {activeCategory === 'chit' && selectedChit?.chitName
                      ? `Request ${selectedChit.chitName} Withdrawal (${formatCurrency(selectedChitPayout)})`
                      : `Request ${currentCategoryConfig.name} Withdrawal`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.securityFooterNote}>
                <MaterialCommunityIcons name="shield-check-outline" size={14} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                <Text style={styles.securityFooterText}>
                  Withdrawals from {currentCategoryConfig.name} are processed only up to {formatCurrency(currentCategoryAvailable)}.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noBalanceNotice}>
              <MaterialCommunityIcons name="information-outline" size={16} color={themeColors.textMuted} />
              <Text style={styles.noBalanceNoticeText}>
                No matured {currentCategoryConfig.name} balance available to withdraw at this time.
              </Text>
            </View>
          )}
        </View>

        {/* ── My Investments Overview List (Filtered by Active Category) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionHeaderTitle}>
                {listFilter === 'all' ? 'All Investments & Assets' : `${currentCategoryConfig.name} Plans`}
              </Text>
              <Text style={styles.sectionHeaderCount}>
                ({investments.filter(inv => {
                  if (listFilter === 'all') return true;
                  if (activeCategory === 'chit') return inv.isChit;
                  if (activeCategory === 'sip') return inv.isSIP;
                  if (activeCategory === 'pocket_money') return inv.isPocketMoney;
                  return !inv.isChit && !inv.isPocketMoney && !inv.isSIP;
                }).length})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setListFilter(prev => prev === 'all' ? 'auto' : 'all')}
              style={styles.filterToggleBtn}
            >
              <Text style={styles.filterToggleBtnText}>{listFilter === 'all' ? 'Show Selected' : 'Show All'}</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const displayItems = investments.filter(inv => {
              if (listFilter === 'all') return true;
              if (activeCategory === 'chit') return inv.isChit === true;
              if (activeCategory === 'sip') return inv.isSIP === true;
              if (activeCategory === 'pocket_money') return inv.isPocketMoney === true;
              return !inv.isChit && !inv.isPocketMoney && !inv.isSIP;
            });

            if (displayItems.length === 0) {
              return (
                <View style={styles.emptyInvestmentsCard}>
                  <MaterialCommunityIcons name={currentCategoryConfig.icon} size={36} color={themeColors.textTertiary} />
                  <Text style={styles.emptyInvestmentsText}>
                    No {currentCategoryConfig.name} plans found in your account.
                  </Text>
                  <TouchableOpacity
                    style={[styles.exploreBtn, { backgroundColor: currentCategoryConfig.colors[0] }]}
                    onPress={() => {
                      if (activeCategory === 'chit') navigation.navigate('ChitFunds');
                      else if (activeCategory === 'sip') navigation.navigate('SIPDashboard');
                      else if (activeCategory === 'pocket_money') navigation.navigate('PocketMoney');
                      else navigation.navigate('Investments');
                    }}
                  >
                    <Text style={styles.exploreBtnText}>Explore {currentCategoryConfig.name}</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            return (
              <View style={styles.investmentsGroupCard}>
                {displayItems.map((inv, idx) => {
                  const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
                  const isReinvested = inv.status === 'reinvested' || inv.withdrawalStatus === 'reinvested';
                  const isPocketMoney = inv.isPocketMoney === true;
                  const isChit = inv.isChit === true;
                  const isSIP = inv.isSIP === true;
                  const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
                  const isFullEligible = inv.isEligibleForFullBenefits === true || isMatured;

                  // Title & subtitle
                  let planTitle = getPlanDisplayName(inv.type);
                  let planSubtitle = `Invested: ${formatCurrency(inv.amount)} • ${inv.interestRate || 12}% p.a.`;
                  let iconName = 'trending-up';
                  let badgeLabel = isWithdrawn ? 'WITHDRAWN' : isReinvested ? 'REINVESTED' : isFullEligible ? 'MATURED' : 'ACTIVE';
                  let badgeBg = isWithdrawn ? (isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9') : isReinvested ? (isDarkMode ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE') : isFullEligible ? '#DCFCE7' : '#FEF3C7';
                  let badgeColor = isWithdrawn ? (isDarkMode ? '#9CA3AF' : '#64748B') : isReinvested ? (isDarkMode ? '#60A5FA' : '#2563EB') : isFullEligible ? '#059669' : '#D97706';

                  if (isSIP) {
                    const isCompleted = inv.status === 'completed' || (inv.totalContributions && Number(inv.contributionsCompleted) >= Number(inv.totalContributions));
                    planTitle = `SIP Plan (${inv.sipId || 'SIP'})`;
                    planSubtitle = isCompleted
                      ? `Matured: ${formatCurrency(inv.availableToWithdraw || inv.totalPaidAmount)} • All ${inv.totalContributions} Paid`
                      : `Progress: ${inv.contributionsCompleted || 0}/${inv.totalContributions || 0} • Unlocks on Completion`;
                    iconName = 'calendar-clock';
                    badgeLabel = isCompleted ? 'COMPLETED' : inv.status === 'cancelled' ? 'CANCELLED' : 'ACTIVE';
                    badgeBg = isCompleted ? '#DCFCE7' : inv.status === 'cancelled' ? (isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9') : '#FEF3C7';
                    badgeColor = isCompleted ? '#059669' : inv.status === 'cancelled' ? (isDarkMode ? '#9CA3AF' : '#64748B') : '#D97706';
                  } else if (isPocketMoney) {
                    planTitle = 'Pocket Money Plan';
                    planSubtitle = `Invested: ${formatCurrency(inv.investedAmount)} • ${inv.frequency || 'Daily'}`;
                    iconName = 'wallet-giftcard';
                    badgeLabel = inv.status === 'completed' ? 'COMPLETED' : 'ACTIVE';
                    badgeBg = inv.status === 'completed' ? '#DCFCE7' : '#FEF3C7';
                    badgeColor = inv.status === 'completed' ? '#059669' : '#D97706';
                  } else if (isChit) {
                    planTitle = inv.chitName || 'Chit Fund Plan';
                    iconName = 'account-group-outline';

                    if (inv.isWithdrawn || inv.withdrawalStatus === 'completed' || inv.withdrawalStatus === 'withdrawn' || inv.withdrawalStatus === 'approved') {
                      planSubtitle = `Withdrawn: ${formatCurrency(inv.withdrawalAmount || inv.priceAmount || inv.amount)} • Wk ${inv.withdrawalWeek || inv.currentWeek || 1}`;
                      badgeLabel = 'WITHDRAWN';
                      badgeBg = isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
                      badgeColor = isDarkMode ? '#9CA3AF' : '#64748B';
                    } else if (inv.isRequested || inv.withdrawalStatus === 'requested') {
                      planSubtitle = `Requested: ${formatCurrency(inv.withdrawalAmount || inv.priceAmount || inv.amount)} • Pending Approval`;
                      badgeLabel = 'PENDING';
                      badgeBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
                      badgeColor = isDarkMode ? '#FBBF24' : '#D97706';
                    } else if (inv.isUnlocked) {
                      planSubtitle = `Price Amount: ${formatCurrency(inv.priceAmount)} (Unlocked) • Wk ${inv.currentWeek || 1}/${inv.totalWeeks || 10}`;
                      badgeLabel = 'UNLOCKED';
                      badgeBg = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7';
                      badgeColor = isDarkMode ? '#34D399' : '#059669';
                    } else {
                      planSubtitle = `Paid: ${formatCurrency(inv.totalPaid || inv.amount)} • Unlocks at Wk ${(inv.lockedCount || 0) + 1}`;
                      badgeLabel = 'LOCKED';
                      badgeBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
                      badgeColor = isDarkMode ? '#FBBF24' : '#D97706';
                    }
                  }

                  return (
                    <View key={String(inv._id || idx)}>
                      {idx > 0 && <View style={styles.cardDivider} />}
                      <TouchableOpacity
                        style={styles.investmentOverviewRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (isSIP) {
                            if (!inv.isPlanCompleted && (Number(inv.availableToWithdraw) || 0) <= 0) {
                              showAlert(
                                'warning',
                                'SIP Plan In Progress',
                                `This SIP plan is currently in progress (${inv.contributionsCompleted || 0}/${inv.totalContributions || 0} contributions). As per SIP rules, funds can only be withdrawn once the entire plan is completed.`
                              );
                              return;
                            }
                            setActiveCategory('sip');
                            setAmount(String(inv.availableToWithdraw || ''));
                            setWithdrawType(inv._id);
                            if (bankInfo?.upiId) setUpiId(bankInfo.upiId);
                            setWithdrawModalVisible(true);
                          } else if (isChit) {
                            if (inv.isUnlocked || inv.hasWon) {
                              setActiveCategory('chit');
                              setSelectedChitId(inv._id);
                              const cPayout = Number(inv.priceAmount) || Number(inv.winningAmount) || Number(inv.amount) || 0;
                              setAmount(String(cPayout));
                              carouselRef.current?.scrollTo({ x: 1 * (CARD_WIDTH + 14), animated: true });
                            } else {
                              setSelectedDeposit(inv);
                            }
                          } else {
                            setSelectedDeposit(inv);
                          }
                        }}
                      >
                        <View style={styles.invMintIconBox}>
                          <MaterialCommunityIcons name={iconName} size={20} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                        </View>

                        <View style={styles.invTextContent}>
                          <Text style={styles.invTitleText} numberOfLines={1}>{planTitle}</Text>
                          <Text style={styles.invSubText} numberOfLines={1}>{planSubtitle}</Text>
                        </View>

                        <View style={[styles.invBadgePill, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.invBadgePillText, { color: badgeColor }]}>{badgeLabel}</Text>
                        </View>

                        <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? '#6B7280' : '#8E9486'} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Withdraw Modal Confirmation / Input ── */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrapper}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setWithdrawModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Confirm {currentCategoryConfig.name} Withdrawal</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Amount Section */}
            {activeCategory === 'chit' || withdrawType === 'chit' ? (
              <View style={[styles.modalBalanceBox, { backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.1)' : '#F0FDF4', marginVertical: 8, borderColor: 'rgba(52, 211, 153, 0.3)', borderWidth: 1 }]}>
                <Text style={styles.modalBalanceLabel}>Full Chit Payout (Non-partial)</Text>
                <Text style={[styles.modalBalanceAmount, { color: isDarkMode ? '#34D399' : '#0E3D23', fontSize: 24 }]}>
                  {formatCurrency(currentCategoryAvailable)}
                </Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94A3B8' : '#64748B', marginTop: 6, lineHeight: 16 }}>
                  ⚠️ Chit rule: Partial withdrawals are not permitted. Withdrawing this payout will complete your chit plan.
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.modalBalanceBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F0FDF4' }]}>
                  <Text style={styles.modalBalanceLabel}>Eligible {currentCategoryConfig.name} Available</Text>
                  <Text style={[styles.modalBalanceAmount, { color: isDarkMode ? '#34D399' : '#0E3D23' }]}>
                    {formatCurrency(currentCategoryAvailable)}
                  </Text>
                </View>

                {/* Amount Input */}
                <Text style={styles.inputLabel}>Withdrawal Amount</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              </>
            )}

            {/* UPI / Bank Input */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Payout UPI ID</Text>
            <View style={styles.upiInputRow}>
              <MaterialCommunityIcons name="bank" size={18} color={themeColors.textMuted} />
              <TextInput
                style={styles.upiInput}
                value={upiId}
                onChangeText={(v) => setUpiId(v.toLowerCase().trim())}
                placeholder="e.g. username@okhdfcbank"
                placeholderTextColor={themeColors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setWithdrawModalVisible(false)}
                disabled={withdrawing}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtnOuter, withdrawing && styles.submitBtnDisabled]}
                onPress={handleWithdraw}
                disabled={withdrawing}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={currentCategoryConfig.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtnGradient}
                >
                  {!withdrawing && <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />}
                  <Text style={styles.submitBtnText}>{withdrawing ? 'Processing...' : 'Confirm Withdrawal'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Deposit Detail Modal Popup ── */}
      <DepositDetailModal
        visible={!!selectedDeposit}
        item={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
        onWithdraw={(inv) => {
          setSelectedDeposit(null);
          if (inv.isChit) {
            handleChitWithdrawal(inv);
          } else {
            openWithdrawModal(inv._id);
          }
        }}
        onReinvest={(item) => {
          setSelectedDeposit(null);
          const principal = Number(item.amount || item.investedAmount) || 0;
          const rate = Number(item.interestRate) || 12;
          const durationDays = Number(item.durationDays) || 365;
          const dailyInterest = (principal * rate) / 100 / 365;
          const totalInterest = dailyInterest * durationDays;
          const maturedAmount = Number(item.maturityAmount) || (principal + (item.totalInterest || totalInterest));
          const sourceRef = item.ref || item.refId || (item._id ? `INV-${String(item._id).slice(-6).toUpperCase()}` : '');

          navigation.navigate('InvestmentAmount', {
            isReinvestment: true,
            sourceInvestmentId: item._id,
            sourceRef,
            initialPlan: item.type,
            initialAmount: String(Number(maturedAmount.toFixed(2))),
            maturedAmount: Number(maturedAmount.toFixed(2)),
          });
        }}
      />

      {/* Modern Alert Modal */}
      <ModernAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        primaryButtonText={alertConfig.primaryText}
        onPrimaryPress={alertConfig.onPrimary}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const getStyles = (themeColors, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  headerPlaceholder: { paddingHorizontal: 20, paddingBottom: 16 },

  // Page Header
  pageHeader: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: themeColors.background },
  headerSub: { fontSize: 12, color: themeColors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: themeColors.text, letterSpacing: -0.6, marginTop: 2 },

  // Category Pill Switcher
  categoryPillsContainer: {
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryPillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F0F2EB',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
  },
  categoryPillActive: {
    backgroundColor: isDarkMode ? '#1E293B' : '#0E3D23',
    borderColor: isDarkMode ? '#334155' : '#0E3D23',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDarkMode ? '#9CA3AF' : '#686D62',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  categoryPillDotActive: {
    backgroundColor: '#34D399',
  },

  // Carousel
  carouselOuterWrapper: {
    marginBottom: 8,
  },
  carouselScrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  heroOuter: {
    marginRight: 0,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
    minHeight: 180,
  },
  heroBlob: {
    position: 'absolute',
    bottom: -35,
    right: -25,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 20,
  },
  heroCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swipeHintBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  swipeHintText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  heroLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  heroNote: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
    fontWeight: '500',
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 10,
    marginTop: 12,
  },
  heroBottomLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroBottomValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAF9',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
  },
  dotActive: {
    width: 18,
    borderRadius: 4,
    backgroundColor: isDarkMode ? '#34D399' : '#0E3D23',
  },

  // Section
  section: { paddingHorizontal: 16, marginTop: 14 },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  formSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: isDarkMode ? '#9CA3AF' : '#686D62',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  formSectionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textMuted,
  },
  noBalanceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E5E7EB',
    marginBottom: 8,
  },
  noBalanceNoticeText: {
    fontSize: 12,
    color: themeColors.textMuted,
    flex: 1,
  },
  filterToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F0F2EB',
  },
  filterToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textMuted,
  },

  // Amount Input Card
  amountInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: themeColors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  amountLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  currencyPrefix: { fontSize: 24, fontWeight: '700', color: isDarkMode ? '#9CA3AF' : '#6B7280', marginRight: 6 },
  amountTextInput: { flex: 1, fontSize: 24, fontWeight: '700', color: themeColors.text, padding: 0 },
  availableBadge: { alignItems: 'flex-end', paddingLeft: 8 },
  availableBadgeLabel: { fontSize: 11, fontWeight: '500', color: themeColors.textMuted },
  availableBadgeValue: { fontSize: 13, fontWeight: '700', color: themeColors.text, marginTop: 1 },

  // Bank Account / UPI Card
  bankAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    marginBottom: 14,
  },
  bankMintIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankInfoContent: { flex: 1 },
  bankLabel: { fontSize: 11, fontWeight: '600', color: themeColors.textMuted },
  bankTitle: { fontSize: 15, fontWeight: '700', color: themeColors.text, marginTop: 2 },
  primaryBadge: {
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  primaryBadgeText: { fontSize: 11, fontWeight: '700', color: isDarkMode ? '#34D399' : '#065F46' },

  // Request Button
  requestBtnOuter: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 8,
  },
  requestBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  requestBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  securityFooterNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  securityFooterText: { fontSize: 11, color: themeColors.textMuted, textAlign: 'center' },

  // ── My Investments Overview Group ──
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: isDarkMode ? '#9CA3AF' : '#686D62',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textMuted,
  },
  investmentsGroupCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#EFF1E9',
    marginHorizontal: 16,
  },
  investmentOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  invMintIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  invTextContent: { flex: 1, minWidth: 0 },
  invTitleText: { fontSize: 15, fontWeight: '700', color: themeColors.text },
  invSubText: { fontSize: 12, fontWeight: '500', color: themeColors.textMuted, marginTop: 2 },
  invBadgePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 2,
  },
  invBadgePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  emptyInvestmentsCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
  },
  emptyInvestmentsText: {
    fontSize: 13,
    color: themeColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  exploreBtn: {
    marginTop: 14,
    backgroundColor: '#0E3D23',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exploreBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: themeColors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
    alignSelf: 'center', marginBottom: 20,
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: themeColors.text, letterSpacing: -0.4 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F0F2EB',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBalanceBox: {
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    borderRadius: 16,
    padding: 14, marginBottom: 18,
  },
  modalBalanceLabel: { fontSize: 12, color: themeColors.textMuted, fontWeight: '500' },
  modalBalanceAmount: { fontSize: 22, fontWeight: '800', color: isDarkMode ? '#34D399' : '#0E3D23', letterSpacing: -0.5, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text, marginBottom: 8 },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: themeColors.background, borderRadius: 14,
    paddingHorizontal: 16, height: 54,
    borderWidth: 1.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    marginBottom: 8,
  },
  currencySymbol: { fontSize: 20, fontWeight: '700', color: themeColors.textMuted, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', color: themeColors.text, padding: 0 },
  upiInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: themeColors.background, borderRadius: 14,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6', gap: 8,
  },
  upiInput: { flex: 1, fontSize: 14, color: themeColors.text, padding: 0 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: themeColors.textSecondary },
  submitBtnOuter: { flex: 2 },
  submitBtnGradient: {
    height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
});

export default WithdrawScreen;
