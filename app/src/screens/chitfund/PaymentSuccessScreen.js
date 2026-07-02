import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const PaymentSuccessScreen = ({ navigation, route }) => {
  const insets = useScreenInsets(8);
  const { chitId, amount, type } = route.params || {};
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const transactionId = 'TXN' + Date.now().toString().slice(-8);
  const formatCurrency = (val) => `₹${(val || 0)?.toLocaleString('en-IN') || '0'}`;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 8,
        stiffness: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Success Animation */}
        <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#16a34a', '#15803d']}
            style={styles.successCircleInner}
          >
            <MaterialCommunityIcons name="check" size={48} color={colors.white} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>Payment Successful!</Text>
          <Text style={styles.subtitle}>
            {type === 'join' ? 'You have successfully joined the chit fund' : 'Your payment has been processed'}
          </Text>

          {/* Receipt Card */}
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <MaterialCommunityIcons name="receipt" size={24} color={colors.primary} />
              <Text style={styles.receiptTitle}>Payment Receipt</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Transaction ID</Text>
              <Text style={styles.receiptValue}>{transactionId}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Amount</Text>
              <Text style={styles.receiptAmount}>{formatCurrency(amount)}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Date</Text>
              <Text style={styles.receiptValue}>{new Date().toLocaleDateString('en-IN')}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Success</Text>
              </View>
            </View>

            <View style={styles.receiptDivider} />

            <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.85}>
              <MaterialCommunityIcons name="download" size={18} color={colors.primary} />
              <Text style={styles.downloadBtnText}>Download Receipt</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MyChits')}
            >
              <Text style={styles.primaryBtnText}>Go To My Chits</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('ChitFundHome')}
            >
              <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successCircle: { width: 100, height: 100, borderRadius: 50, marginBottom: 24 },
  successCircleInner: { width: '100%', height: '100%', borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  // Receipt
  receiptCard: {
    width: '100%', backgroundColor: colors.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card, marginBottom: 24,
  },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  receiptTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  receiptLabel: { fontSize: 13, color: colors.textSecondary },
  receiptValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  receiptAmount: { fontSize: 16, fontWeight: '800', color: colors.primary },
  statusBadge: { backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.success },
  receiptDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  downloadBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  // Actions
  actions: { width: '100%', gap: 12 },
  primaryBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', ...colors.shadow.button },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  secondaryBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: colors.primaryLight },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});

export default PaymentSuccessScreen;