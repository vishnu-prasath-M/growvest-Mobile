import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';

const PaymentFailedScreen = ({ navigation, route }) => {
  const { title, message, nextScreen } = route.params || {};

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.errorCircle}>
          <MaterialCommunityIcons name="close" size={48} color={colors.error} />
        </View>
        <Text style={styles.title}>{title || 'Payment Failed'}</Text>
        <Text style={styles.subtitle}>
          {message || 'Your payment could not be processed. Please try again or contact support.'}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryBtn}
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="refresh" size={20} color={colors.white} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.navigate(nextScreen || 'ChitFundHome')}
          >
            <Text style={styles.cancelBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  
  errorCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 4, borderColor: '#fee2e2' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 40, paddingHorizontal: 20 },
  
  actions: { width: '100%', gap: 12 },
  retryBtn: { flexDirection: 'row', backgroundColor: colors.error, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: colors.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  retryBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  cancelBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderLight },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
});

export default PaymentFailedScreen;