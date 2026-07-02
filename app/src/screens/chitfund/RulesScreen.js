import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
const RULES_DATA = {
  whatIsChitFund: {
    title: 'What is Chit Fund?',
    content: 'A chit fund is a traditional savings and borrowing mechanism that has been modernized by Growvest. It brings together a group of members who contribute a fixed amount every month for a predetermined duration. The total monthly collection (called the "pot") is awarded to one member through a transparent auction process. This continues until every member has had a chance to win the pot. Chit funds combine the discipline of regular savings with the excitement of winning a large sum, while also providing dividends to non-winning members.',
  },
  monthlyPayment: {
    title: 'Monthly Payment',
    content: 'Every member must pay a fixed monthly installment on or before the due date (usually the 1st of every month). Payments can be made via UPI, Net Banking, Debit Card, or Credit Card. A grace period of 3 days is provided. Late payments attract a nominal late fee of ₹10 per day. Consistent timely payments ensure you remain eligible for auctions and dividends.',
  },
  auction: {
    title: 'Auction Process',
    content: 'Auctions are held monthly on a scheduled date. During the auction, members bid to take the pot. The member who bids the lowest amount (offering the highest discount) wins. The winning amount is the pot minus the discount. The discount is then distributed as dividend among all non-winning members. Members who have already won are not eligible for future auctions. Auctions are conducted online through the Growvest platform in real-time.',
  },
  winner: {
    title: 'Winner Selection & Benefits',
    content: 'The winner is selected through the auction process. The winner receives the pot amount minus the discount they offered and a small processing fee. The winner is then excluded from future auctions but continues to pay monthly installments. Winners also receive a certificate of winning. The winning amount is credited to the member\'s wallet within 24 hours of the auction.',
  },
  penalty: {
    title: 'Penalty & Default',
    content: 'Late Payment: ₹10 per day after the 3-day grace period. Missed Payment (1 month): ₹500 penalty + late fees. Missed Payment (2 consecutive months): ₹1,000 penalty + late fees + membership suspension. Missed Payment (3 consecutive months): Automatic cancellation with forfeiture of 20% of total paid amount as penalty. The remaining amount is refunded within 30 days.',
  },
  cancellation: {
    title: 'Cancellation Policy',
    content: 'Members can request cancellation at any time. Cancellation within 3 months of joining: 10% of total paid amount is deducted as processing fee. Cancellation after 3 months: 5% of total paid amount is deducted. Cancellation after 12 months: No deduction, full refund of paid amount minus any winnings received. Refunds are processed within 15 working days of cancellation approval.',
  },
  refund: {
    title: 'Refund Policy',
    content: 'Refunds are processed for cancelled memberships or overpayments. Refund timeline: 15-30 working days from the date of request. Refunds are credited to the original payment method or bank account on file. A refund confirmation will be sent via email and SMS. For any refund-related queries, please contact our support team.',
  },
};

const RulesScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [expanded, setExpanded] = useState(null);

  const rules = Object.values(RULES_DATA);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rules & Guidelines</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <MaterialCommunityIcons name="book-open-variant" size={40} color={colors.primary} />
          <Text style={styles.introTitle}>Chit Fund Rules</Text>
          <Text style={styles.introText}>
            Please read the following rules and guidelines carefully. By participating in a chit fund, you agree to abide by these terms.
          </Text>
        </View>

        {rules.map((rule, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.ruleCard, expanded === index && styles.ruleCardExpanded]}
            activeOpacity={0.85}
            onPress={() => setExpanded(expanded === index ? null : index)}
          >
            <View style={styles.ruleHeader}>
              <View style={styles.ruleIconWrap}>
                <MaterialCommunityIcons
                  name={expanded === index ? 'book-open' : 'book-outline'}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.ruleTitle}>{rule.title}</Text>
              <MaterialCommunityIcons
                name={expanded === index ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textTertiary}
              />
            </View>
            {expanded === index && (
              <View style={styles.ruleContent}>
                <Text style={styles.ruleText}>{rule.content}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
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
  introCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  introTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 8 },
  introText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  ruleCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  ruleCardExpanded: { borderColor: colors.primaryLight },
  ruleHeader: { flexDirection: 'row', alignItems: 'center' },
  ruleIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  ruleTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  ruleContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  ruleText: { fontSize: 13, color: colors.textSecondary, lineHeight: 22 },
});

export default RulesScreen;