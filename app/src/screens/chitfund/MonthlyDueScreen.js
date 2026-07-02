import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const MonthlyDueScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedChit, setSelectedChit] = useState(null);
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetchMyChits();
  }, []);

  const fetchMyChits = async () => {
    try {
      const data = await chitFundService.getMyChits();
      // Filter out completed ones or those without nextDueAmount
      const activeDues = data.filter(c => c.status === 'active' && c.currentMonth < c.duration);
      setChits(activeDues);
    } catch (error) {
      console.error('Error fetching chits for dues:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const handlePayNow = (chit) => {
    setSelectedChit(chit);
    setShowConfirm(true);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Dues</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Dues...</Text>
          </View>
        ) : chits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You have no upcoming dues!</Text>
          </View>
        ) : (
          chits.map((chit) => (
          <View key={chit._id} style={styles.dueCard}>
            <View style={styles.dueCardHeader}>
              <View style={styles.dueIconWrap}>
                <MaterialCommunityIcons name="calendar-clock" size={24} color={colors.primary} />
              </View>
              <View style={styles.dueInfo}>
                <Text style={styles.dueChitName}>{chit.chitName}</Text>
                <Text style={styles.dueChitDetail}>Month {chit.currentMonth} of {chit.duration}</Text>
              </View>
            </View>

            <View style={styles.dueDivider} />

            <View style={styles.dueAmountRow}>
              <View>
                <Text style={styles.dueLabel}>Current Due</Text>
                <Text style={styles.dueAmount}>{formatCurrency(chit.nextDueAmount)}</Text>
              </View>
              <View style={styles.dueDateWrap}>
                <Text style={styles.dueLabel}>Due Date</Text>
                <Text style={styles.dueDate}>{chit.nextDueDate}</Text>
              </View>
            </View>

            <View style={styles.lateFeeRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.lateFeeText}>Late fee of ₹10/day applies after due date</Text>
            </View>

            <View style={styles.dueActions}>
              <TouchableOpacity
                style={styles.payNowBtn}
                activeOpacity={0.85}
                onPress={() => handlePayNow(chit)}
              >
                <Text style={styles.payNowBtnText}>Pay Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reminderBtn} activeOpacity={0.85}>
                <MaterialCommunityIcons name="bell-outline" size={20} color={colors.primary} />
                <Text style={styles.reminderBtnText}>Remind</Text>
              </TouchableOpacity>
            </View>
          </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showConfirm} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowConfirm(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="cash-check" size={44} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Amount</Text>
              <Text style={styles.modalValue}>{formatCurrency(selectedChit?.nextDueAmount)}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Late Fee</Text>
              <Text style={styles.modalValue}>₹0</Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalRow}>
              <Text style={styles.modalTotalLabel}>Total</Text>
              <Text style={styles.modalTotalValue}>{formatCurrency(selectedChit?.nextDueAmount)}</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => {
                  setShowConfirm(false);
                  navigation.navigate('ChitPayment', {
                    chitId: selectedChit?.chitId,
                    memberId: selectedChit?._id,
                    month: (selectedChit?.currentMonth || 0) + 1,
                    amount: selectedChit?.nextDueAmount,
                    lateFee: 0,
                    type: 'due',
                    chitName: selectedChit?.chitName,
                  });
                }}
              >
                <Text style={styles.payBtnText}>Pay {formatCurrency(selectedChit?.nextDueAmount)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  dueCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  dueCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dueIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  dueInfo: { flex: 1 },
  dueChitName: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 2 },
  dueChitDetail: { fontSize: 12, color: colors.textSecondary },
  dueDivider: { height: 1, backgroundColor: colors.borderLight, marginBottom: 16 },
  dueAmountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dueLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  dueAmount: { fontSize: 28, fontWeight: '800', color: colors.text },
  dueDate: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'right' },
  dueDateWrap: { alignItems: 'flex-end' },
  lateFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, padding: 10, backgroundColor: '#fef9c3', borderRadius: 10 },
  lateFeeText: { fontSize: 12, color: colors.warning, fontWeight: '500', flex: 1 },
  dueActions: { flexDirection: 'row', gap: 12 },
  payNowBtn: { flex: 2, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', ...colors.shadow.button },
  payNowBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  reminderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingVertical: 14, borderRadius: 14 },
  reminderBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.white, borderRadius: 24, padding: 24, ...colors.shadow.elevated },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 20 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalLabel: { fontSize: 14, color: colors.textSecondary },
  modalValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  modalTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  modalTotalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  payBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', ...colors.shadow.button },
  payBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});

export default MonthlyDueScreen;