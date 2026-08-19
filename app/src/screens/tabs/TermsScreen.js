import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

// Investment plans – must match backend configuration exactly
const INVESTMENT_PLANS = [
  { label: '1 Year Plan',    duration: '365 days', rate: '24%', example: { principal: 10000, interest: 2400, maturity: 12400, daily: (2400/365).toFixed(2) } },
  { label: '6 Months Plan',  duration: '180 days', rate: '20%', example: { principal: 10000, interest: 2000, maturity: 12000, daily: (2000/180).toFixed(2) } },
  { label: '3 Months Plan',  duration: '90 days',  rate: '18%', example: { principal: 10000, interest: 1800, maturity: 11800, daily: (1800/90).toFixed(2) } },
  { label: '1 Month Plan',   duration: '30 days',  rate: '15%', example: { principal: 10000, interest: 1500, maturity: 11500, daily: (1500/30).toFixed(2) } },
  { label: '15 Days Plan',   duration: '15 days',  rate: '12%', example: { principal: 10000, interest: 1200, maturity: 11200, daily: (1200/15).toFixed(2) } },
];

const Section = ({ number, title, children, themeColors }) => (
  <View style={{ marginBottom: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.primary }}>{number}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text, flex: 1 }}>{title}</Text>
    </View>
    {children}
  </View>
);

const BulletPoint = ({ text, themeColors }) => (
  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
    <Text style={{ color: themeColors.primary, fontWeight: '700', marginTop: 2 }}>•</Text>
    <Text style={{ fontSize: 13, color: themeColors.textSecondary, lineHeight: 20, flex: 1 }}>{text}</Text>
  </View>
);

const TermsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero Banner */}
        <LinearGradient colors={['#064e3b', '#065f46', '#047857']} style={styles.heroBanner}>
          <MaterialCommunityIcons name="file-document-outline" size={36} color="#fff" />
          <Text style={styles.heroTitle}>Investment Terms & Conditions</Text>
          <Text style={styles.heroSubtitle}>Last Updated: August 2026</Text>
        </LinearGradient>

        <Text style={styles.introText}>
          Please read these Investment Terms & Conditions carefully before making any investment through Growvest. By proceeding with an investment, you agree to be bound by these terms.
        </Text>

        {/* ─── Section 1: Investment Plans ─── */}
        <View style={styles.card}>
          <Section number="1" title="Investment Plans" themeColors={themeColors}>
            <Text style={styles.para}>Growvest offers the following fixed-term investment plans. Each plan has a unique duration and interest rate:</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Plan</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.5 }]}>Duration</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Rate</Text>
              </View>
              {INVESTMENT_PLANS.map((plan, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: themeColors.background }]}>
                  <Text style={[styles.tableCell, { flex: 2, color: themeColors.text, fontWeight: '600' }]}>{plan.label}</Text>
                  <Text style={[styles.tableCell, { flex: 1.5, color: themeColors.textSecondary }]}>{plan.duration}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: themeColors.primary, fontWeight: '700' }]}>{plan.rate}</Text>
                </View>
              ))}
            </View>
          </Section>

          {/* ─── Section 2: Investment Duration ─── */}
          <Section number="2" title="Investment Duration" themeColors={themeColors}>
            <BulletPoint text="Each investment plan has a fixed duration as listed above." themeColors={themeColors} />
            <BulletPoint text="The duration begins from the date your investment is activated/approved." themeColors={themeColors} />
            <BulletPoint text="Different investment plans can have different maturity dates depending on when they were individually activated." themeColors={themeColors} />
            <BulletPoint text="Each investment must be treated independently — maturity dates and returns are calculated separately for each." themeColors={themeColors} />
          </Section>

          {/* ─── Section 3: Applicable Rate ─── */}
          <Section number="3" title="Applicable Interest Rate" themeColors={themeColors}>
            <BulletPoint text="The applicable rate is fixed at the time of investment selection and does not change during the tenure." themeColors={themeColors} />
            <BulletPoint text="The rate shown is the total percentage return for the full duration of the plan (not per annum compounded)." themeColors={themeColors} />
            <BulletPoint text="The interest rate is applied only to the principal amount invested by the user." themeColors={themeColors} />
          </Section>

          {/* ─── Section 4: Interest/Profit Calculation ─── */}
          <Section number="4" title="Interest / Profit Calculation" themeColors={themeColors}>
            <Text style={styles.para}>The following formulas govern how interest is calculated:</Text>
            <View style={[styles.formulaBox, { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary }]}>
              <Text style={[styles.formulaText, { color: themeColors.primary }]}>Total Interest = Principal × Rate ÷ 100</Text>
              <Text style={[styles.formulaText, { color: themeColors.primary, marginTop: 4 }]}>Maturity Value = Principal + Total Interest</Text>
              <Text style={[styles.formulaText, { color: themeColors.primary, marginTop: 4 }]}>Daily Interest = Total Interest ÷ Duration Days</Text>
            </View>
            <Text style={[styles.para, { marginTop: 12, fontWeight: '600' }]}>Example — ₹10,000 in the 15-Day Plan at 12%:</Text>
            <View style={styles.exampleBox}>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Principal</Text>
                <Text style={styles.exampleValue}>₹10,000</Text>
              </View>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Interest (12%)</Text>
                <Text style={[styles.exampleValue, { color: themeColors.primary }]}>+ ₹1,200</Text>
              </View>
              <View style={[styles.exampleRow, { borderTopWidth: 1, borderTopColor: themeColors.borderLight, paddingTop: 8 }]}>
                <Text style={[styles.exampleLabel, { fontWeight: '700' }]}>Maturity Value</Text>
                <Text style={[styles.exampleValue, { fontWeight: '800', color: themeColors.primary }]}>₹11,200</Text>
              </View>
              <View style={styles.exampleRow}>
                <Text style={styles.exampleLabel}>Daily Profit</Text>
                <Text style={styles.exampleValue}>₹8/day (₹1,200 ÷ 15)</Text>
              </View>
            </View>
            <Text style={[styles.para, { color: themeColors.textTertiary, fontSize: 12 }]}>
              The same formula applies dynamically for each plan. The Daily Interest shown in the app is informational and represents the average daily accrual.
            </Text>
          </Section>

          {/* ─── Section 5: Lock-in Period ─── */}
          <Section number="5" title="Lock-in Period" themeColors={themeColors}>
            <BulletPoint text="All investments are locked for the full duration of the selected plan." themeColors={themeColors} />
            <BulletPoint text="No partial withdrawals are allowed during the lock-in period." themeColors={themeColors} />
            <BulletPoint text="The lock-in period begins from the date the investment is approved and activated in the system." themeColors={themeColors} />
          </Section>

          {/* ─── Section 6: Maturity ─── */}
          <Section number="6" title="Maturity" themeColors={themeColors}>
            <BulletPoint text="Your investment matures on the date calculated from your actual investment/approval date plus the plan duration." themeColors={themeColors} />
            <BulletPoint text="Upon maturity, the full maturity value (principal + total interest) becomes eligible for withdrawal." themeColors={themeColors} />
            <BulletPoint text="Maturity dates may vary between different investments made by the same user." themeColors={themeColors} />
          </Section>

          {/* ─── Section 7: Withdrawal Rules ─── */}
          <Section number="7" title="Withdrawal Rules" themeColors={themeColors}>
            <BulletPoint text="Withdrawal is NOT allowed before the maturity date." themeColors={themeColors} />
            <BulletPoint text="Early withdrawal requests will not be processed." themeColors={themeColors} />
            <BulletPoint text="After maturity, withdrawal requests are processed upon admin verification." themeColors={themeColors} />
            <BulletPoint text="Growvest reserves the right to request additional verification before processing withdrawals." themeColors={themeColors} />
          </Section>

          {/* ─── Section 8: Investment Status ─── */}
          <Section number="8" title="Investment Status" themeColors={themeColors}>
            <BulletPoint text="Pending: Investment submitted but awaiting admin approval." themeColors={themeColors} />
            <BulletPoint text="Active: Investment approved and running. Interest is accruing." themeColors={themeColors} />
            <BulletPoint text="Matured: Investment has reached its end date and is ready for withdrawal." themeColors={themeColors} />
            <BulletPoint text="Completed: Investment has been withdrawn and the cycle is closed." themeColors={themeColors} />
          </Section>

          {/* ─── Section 9: Important Notes ─── */}
          <Section number="9" title="Important Notes" themeColors={themeColors}>
            <BulletPoint text="Past performance does not guarantee future returns." themeColors={themeColors} />
            <BulletPoint text="Interest rates shown are specific to each plan and may be updated for future plans." themeColors={themeColors} />
            <BulletPoint text="Investment amounts must meet any minimum or maximum thresholds defined in the app at the time of investment." themeColors={themeColors} />
            <BulletPoint text="Do not share your Growvest credentials with anyone. You are responsible for all investment activity under your account." themeColors={themeColors} />
            <BulletPoint text="Growvest is not responsible for losses arising from unauthorized account access." themeColors={themeColors} />
          </Section>

          {/* ─── Section 10: User Acknowledgement ─── */}
          <Section number="10" title="User Acknowledgement" themeColors={themeColors}>
            <View style={{ backgroundColor: themeColors.primaryLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: themeColors.primary }}>
              <Text style={{ fontSize: 13, color: themeColors.text, lineHeight: 22 }}>
                By proceeding with any investment on Growvest, you confirm that:{'\n\n'}
                ✅  You have read and understood these Terms & Conditions.{'\n'}
                ✅  You understand the lock-in period and maturity rules.{'\n'}
                ✅  You agree that interest is calculated on your actual invested amount.{'\n'}
                ✅  You accept that early withdrawal is not permitted.{'\n'}
                ✅  You are making this investment of your own free will.
              </Text>
            </View>
          </Section>

          {/* Contact */}
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <Text style={{ fontSize: 12, color: themeColors.textTertiary, textAlign: 'center', lineHeight: 18 }}>
              For any queries, contact us at{'\n'}
              <Text style={{ color: themeColors.primary, fontWeight: '600' }}>camohanrajbullbear@gmail.com</Text>
              {'\n'}or WhatsApp: +91 98765 43210
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  scrollContent: {
    padding: 16,
  },
  heroBanner: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  introText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  para: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  // Table
  table: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableHeader: {
    backgroundColor: colors.primary,
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  tableCell: {
    fontSize: 13,
  },
  // Formula
  formulaBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  formulaText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
  },
  // Example
  exampleBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  exampleLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  exampleValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});

export default TermsScreen;