import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
const FAQ_DATA = [
  {
    id: 'faq_1',
    question: 'What is a Chit Fund?',
    answer: 'A chit fund is a savings and borrowing scheme where a group of members contribute a fixed amount every month. The total collected amount (pot) is given to one member through an auction process. Each member gets a chance to win the pot, and non-winning members receive dividends from the auction discount.',
  },
  {
    id: 'faq_2',
    question: 'How does the Auction work?',
    answer: 'Every month, an auction is conducted where members bid to take the pot. The member who bids the lowest amount (discount) wins the auction. The discount is then distributed equally among the remaining members as dividend. The winner receives the pot minus the discount and a small processing fee.',
  },
  {
    id: 'faq_3',
    question: 'Can I exit a Chit Fund early?',
    answer: 'Yes, you can exit a chit fund, but early exit may incur a penalty as per the terms. The penalty amount depends on how many months have passed. Please refer to the Rules section for detailed cancellation and refund policies.',
  },
  {
    id: 'faq_4',
    question: 'What happens if I make a late payment?',
    answer: 'Late payments attract a nominal late fee as mentioned in the chit fund terms. The late fee is calculated per day of delay. We recommend setting up auto-pay or reminders to avoid late fees.',
  },
  {
    id: 'faq_5',
    question: 'What is the penalty for missing payments?',
    answer: 'If a member misses consecutive payments, a penalty is applied. Continued default may result in cancellation of membership. The penalty amount and cancellation terms are clearly mentioned in the chit fund rules.',
  },
  {
    id: 'faq_6',
    question: 'How is the dividend calculated?',
    answer: 'The dividend is the discount amount from the auction divided equally among all non-winning members. For example, if the discount is ₹2,000 and there are 9 non-winning members, each member gets approximately ₹222 as dividend.',
  },
  {
    id: 'faq_7',
    question: 'Is my money safe?',
    answer: 'Yes, Growvest Chit Funds are fully regulated and transparent. All transactions are recorded, and every member gets a detailed receipt. The platform uses secure payment gateways and follows strict compliance guidelines.',
  },
  {
    id: 'faq_8',
    question: 'Can I join multiple chit funds?',
    answer: 'Absolutely! You can join multiple chit funds simultaneously. Each chit fund is independent, and you can manage all of them from your dashboard.',
  },
];

const FAQScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [expandedId, setExpandedId] = useState(null);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <MaterialCommunityIcons name="frequently-asked-questions" size={40} color={colors.primary} />
          <Text style={styles.introTitle}>Frequently Asked Questions</Text>
          <Text style={styles.introText}>Everything you need to know about chit funds</Text>
        </View>

        {FAQ_DATA.map((faq) => (
          <TouchableOpacity
            key={faq.id}
            style={[styles.faqCard, expandedId === faq.id && styles.faqCardExpanded]}
            activeOpacity={0.85}
            onPress={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <MaterialCommunityIcons
                name={expandedId === faq.id ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textTertiary}
              />
            </View>
            {expandedId === faq.id && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{faq.answer}</Text>
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
  introText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  faqCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  faqCardExpanded: { borderColor: colors.primaryLight },
  faqHeader: { flexDirection: 'row', alignItems: 'center' },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, marginRight: 8 },
  faqAnswer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  faqAnswerText: { fontSize: 13, color: colors.textSecondary, lineHeight: 22 },
});

export default FAQScreen;