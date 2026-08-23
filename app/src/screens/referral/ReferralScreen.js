import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Share,
  Clipboard,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import StatusChip from '../../components/StatusChip';

const ReferralScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchReferralData = async () => {
    try {
      const res = await api.get('/referral/info');
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReferralData();
  }, []);

  const handleCopyCode = () => {
    if (data?.referralCode) {
      Clipboard.setString(data.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (data?.referralLink) {
      Clipboard.setString(data.referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    try {
      const code = data?.referralCode || '';
      const link = data?.referralLink || `https://growvest-mobile.onrender.com/ref/${code}`;
      const message = `Join Growvest and start your investment journey with high-yield savings & chit funds!\n\nUse my referral code: ${code}\nLink: ${link}`;

      await Share.share({
        message,
        title: 'Growvest Referral Invitation',
        url: link,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const stats = data?.stats || {};
  const history = data?.history || [];

  return (
    <View style={styles.container}>
      <TopBar title="Refer & Earn" navigation={navigation} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Banner Hero */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={isDarkMode ? ['#121F17', '#1A3324'] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>REFERRAL REWARDS</Text>
            </View>
            <Text style={styles.heroTitle}>Invite Friends & Earn Coins</Text>
            <Text style={styles.heroSub}>
              Earn +100 reward coins for every friend who joins & completes their first successful investment!
            </Text>
          </LinearGradient>
        </View>

        {/* Referral Code & Link Box */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeVal}>{data?.referralCode || '—'}</Text>
            <TouchableOpacity style={styles.copyBtn} activeOpacity={0.8} onPress={handleCopyCode}>
              <MaterialCommunityIcons
                name={copiedCode ? 'check' : 'content-copy'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.copyBtnText}>{copiedCode ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 16 }} />

          <Text style={styles.cardSectionLabel}>Your Referral Link</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>
              {data?.referralLink || 'https://growvest-mobile.onrender.com/ref/...'}
            </Text>
            <TouchableOpacity style={styles.copyLinkBtn} activeOpacity={0.8} onPress={handleCopyLink}>
              <MaterialCommunityIcons
                name={copiedLink ? 'check' : 'link-variant'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.copyLinkText}>{copiedLink ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.shareBtn} activeOpacity={0.88} onPress={handleNativeShare}>
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shareGradient}
            >
              <MaterialCommunityIcons name="share-variant" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.shareText}>Share Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Referral Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.totalInvited || 0}</Text>
            <Text style={styles.statLabel}>Total Invited</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.registered || 0}</Text>
            <Text style={styles.statLabel}>Registered</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#1A5C39' }]}>{stats.successful || 0}</Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#B45309' }]}>🪙 {stats.totalCoinsEarned || 0}</Text>
            <Text style={styles.statLabel}>Coins Earned</Text>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How It Works</Text>
          <View style={styles.stepsList}>
            {[
              { num: '1', title: 'Share your referral link', desc: 'Send your referral link via WhatsApp, SMS, or Social Media.' },
              { num: '2', title: 'Friend opens link & installs', desc: 'Your friend opens the link, downloads the APK, and installs Growvest.' },
              { num: '3', title: 'Creates account', desc: 'Your friend registers an account using your referral code.' },
              { num: '4', title: 'Completes successful investment', desc: 'Your friend starts & verifies a successful investment plan.' },
              { num: '5', title: 'You receive +100 Coins', desc: 'After payment confirmation, 100 reward coins are credited to your Coin Wallet.' },
            ].map((step) => (
              <View key={step.num} style={styles.stepItem}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.num}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Referral Rules */}
        <View style={styles.rulesBox}>
          <Text style={styles.rulesTitle}>📋 Referral Rules</Text>
          <Text style={styles.rulesBullet}>• Rewards are credited ONLY after your referred friend completes a successful qualifying investment.</Text>
          <Text style={styles.rulesBullet}>• Downloading or registering alone does NOT generate coin rewards.</Text>
          <Text style={styles.rulesBullet}>• Cancelled or failed payments do not qualify for referral coins.</Text>
          <Text style={styles.rulesBullet}>• Self-referrals are strictly prohibited.</Text>
        </View>

        {/* Referral History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Referral History</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : history.length > 0 ? (
          <View style={styles.historyList}>
            {history.map((item) => (
              <View key={item._id} style={styles.historyCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{item.displayName}</Text>
                  <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusChip status={item.status} />
                  {item.rewardCoins > 0 && (
                    <Text style={styles.historyReward}>+{item.rewardCoins} Coins</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="account-group-outline" size={44} color={themeColors.textSecondary} />
            <Text style={styles.emptyTitle}>No Referrals Yet</Text>
            <Text style={styles.emptySub}>
              Share your referral link with friends to start building your referral history!
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    heroOuter: {
      paddingHorizontal: 20,
      marginTop: 16,
      marginBottom: 16,
    },
    heroCard: {
      borderRadius: 24,
      padding: 24,
      elevation: 6,
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
    heroBadge: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginBottom: 12,
    },
    heroBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FDE047',
      letterSpacing: 0.5,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#FFFFFF',
      marginBottom: 6,
    },
    heroSub: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.8)',
      lineHeight: 18,
    },
    card: {
      marginHorizontal: 20,
      marginBottom: 16,
      padding: 20,
      backgroundColor: themeColors.surface || (isDarkMode ? '#141E18' : '#FFFFFF'),
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeColors.border,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: themeColors.text,
      marginBottom: 16,
    },
    cardSectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F8FAF9',
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    codeVal: {
      fontSize: 22,
      fontWeight: '900',
      color: '#B45309',
      letterSpacing: 2,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    copyBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F8FAF9',
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: 16,
    },
    linkText: {
      flex: 1,
      fontSize: 12,
      color: themeColors.textSecondary,
      marginRight: 8,
    },
    copyLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E8F5E9',
    },
    copyLinkText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    shareBtn: {
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 4,
    },
    shareGradient: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 14,
    },
    shareText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 16,
    },
    statBox: {
      width: '48%',
      padding: 16,
      backgroundColor: themeColors.surface || (isDarkMode ? '#141E18' : '#FFFFFF'),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
    },
    statVal: {
      fontSize: 20,
      fontWeight: '900',
      color: themeColors.text,
    },
    statLabel: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
    },
    stepsList: {
      gap: 14,
    },
    stepItem: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    stepNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#E8F5E9',
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#1A5C39',
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text,
    },
    stepDesc: {
      fontSize: 12,
      color: themeColors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    rulesBox: {
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 16,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#FEF3C7',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#FCD34D',
    },
    rulesTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: isDarkMode ? '#FDE047' : '#92400E',
      marginBottom: 8,
    },
    rulesBullet: {
      fontSize: 12,
      color: isDarkMode ? themeColors.textSecondary : '#78350F',
      marginBottom: 6,
      lineHeight: 16,
    },
    sectionHeader: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: themeColors.text,
    },
    loadingBox: {
      paddingVertical: 30,
      alignItems: 'center',
    },
    historyList: {
      paddingHorizontal: 20,
      gap: 10,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: themeColors.surface || (isDarkMode ? '#141E18' : '#FFFFFF'),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    historyName: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text,
    },
    historyDate: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    historyReward: {
      fontSize: 13,
      fontWeight: '800',
      color: '#1A5C39',
    },
    emptyCard: {
      marginHorizontal: 20,
      padding: 32,
      alignItems: 'center',
      backgroundColor: themeColors.surface2 || (isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF9'),
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 12,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
  });

export default ReferralScreen;
