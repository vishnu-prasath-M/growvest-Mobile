import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';

const PaymentFailedScreen = ({ navigation, route }) => {
  const { amount } = route.params || {};

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.errorCircle}>
          <MaterialCommunityIcons name="close" size={48} color={colors.error} />
        </View>
        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.subtitle}>
          Your payment could not be processed. Please try again or contact support.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryBtn}
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="refresh" size={20} color={colors.white} />
            <Text style={styles.retryBtnText}>Retry Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.navigate('ChitFundHome')}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => navigation.navigate('ChitSupport')}
          >
            <MaterialCommunityIcons name="headset" size={18} color={colors.primary} />
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  actions: { width: '100%', gap: 12 },
  retryBtn: { flexDirection: 'row', backgroundColor: colors.error, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  retryBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  cancelBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  supportBtn: { flexDirection: 'row', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight, gap: 6 },
  supportBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});

export default PaymentFailedScreen;