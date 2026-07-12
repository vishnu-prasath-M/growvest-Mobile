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
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const PaymentSuccessScreen = ({ navigation, route }) => {
  const { title, message, nextScreen, amount, type } = route.params || {};
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
        <Animated.View style={[styles.successCircleOuter, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.successCircleInner}
          >
            <MaterialCommunityIcons name="check" size={48} color={colors.gold} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, width: '100%', alignItems: 'center' }}>
          <Text style={styles.title}>{title || 'Payment Successful!'}</Text>
          <Text style={styles.subtitle}>
            {message || (type === 'join' ? 'You have successfully joined the chit fund' : 'Your payment has been processed')}
          </Text>

          {/* Receipt Card */}
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIconWrap}>
                <MaterialCommunityIcons name="receipt" size={20} color={colors.primary} />
              </View>
              <Text style={styles.receiptTitle}>Payment Receipt</Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Transaction ID</Text>
              <Text style={styles.receiptValue}>{transactionId}</Text>
            </View>
            {amount && (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount</Text>
                <Text style={styles.receiptAmount}>{formatCurrency(amount)}</Text>
              </View>
            )}
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
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtnOuter}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(nextScreen || 'MyChits')}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.primaryBtnGradient}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
              </LinearGradient>
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
  
  successCircleOuter: { width: 100, height: 100, borderRadius: 50, marginBottom: 24, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  successCircleInner: { width: '100%', height: '100%', borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22, paddingHorizontal: 20 },
  
  // Receipt
  receiptCard: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 24, padding: 24,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 32,
  },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  receiptIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  receiptTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  receiptLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  receiptValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  receiptAmount: { fontSize: 18, fontWeight: '800', color: colors.primary },
  statusBadge: { backgroundColor: colors.successLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.success },
  
  // Actions
  actions: { width: '100%' },
  primaryBtnOuter: { shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  primaryBtnGradient: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});

export default PaymentSuccessScreen;