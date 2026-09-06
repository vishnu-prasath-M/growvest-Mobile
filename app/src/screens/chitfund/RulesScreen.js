import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
const RULES_DATA = {
  whatIsChitFund: {
    title: 'What is Chit Fund?',
    content: 'A chit fund is a structured savings and borrowing mechanism modernized by Growvest. Members contribute a fixed installment every week (or month) for a predetermined duration. In our weekly plans, all chit batches start every Sunday, with guaranteed returns, auction payouts, and weekly dividends credited transparently.',
  },
  sundaySchedule: {
    title: 'Weekly Sunday Schedule & Start Day',
    content: 'All weekly chit batches officially start on Sunday. When you join during any day of the week, your membership and 1st week payment are confirmed immediately, and your official chit cycle starts on the upcoming Sunday. All subsequent installment dues and auctions take place every Sunday.',
  },
  weeklyPayment: {
    title: 'Weekly Installment & Due Dates',
    content: 'Every member must pay their weekly installment on or before Sunday. Payments can be made seamlessly via UPI, Net Banking, or Card through Razorpay. Timely payments keep your membership active and ensure you remain eligible for weekly auctions, dividends, and full settlement payouts.',
  },
  auction: {
    title: 'Auction & Payout Process',
    content: 'Auctions are scheduled on Sundays. Members who wish to withdraw their pot early can claim the prize amount based on the plan schedule. Non-withdrawing members accumulate dividend returns every week, leading to a high maturity settlement payout.',
  },
  winner: {
    title: 'Winner Selection & Benefits',
    content: 'When an auction is claimed or won, the payout amount is credited directly to the member\'s verified account balance. The member continues paying regular weekly installments until the completion of the tenure.',
  },
  penalty: {
    title: 'Penalty & Missed Payments',
    content: 'Members should ensure their weekly installments are completed on Sunday. A grace period is provided, but repeated delayed payments may incur late charges or affect dividend eligibility.',
  },
  cancellation: {
    title: 'Cancellation & Settlement',
    content: 'Members receive their full settlement payout at the end of the total weeks tenure, which includes the total principal contribution plus all accumulated weekly dividends.',
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