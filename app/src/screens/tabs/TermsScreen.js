import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';

const TermsScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.lastUpdated}>Last Updated: June 2026</Text>

          <Text style={styles.paragraph}>
            Welcome to Growvest. By using our mobile application and services, you agree to the following terms and conditions. Please read them carefully.
          </Text>

          <Text style={styles.heading}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using the Growvest platform, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions. If you do not agree, please do not use our services.
          </Text>

          <Text style={styles.heading}>2. Eligibility</Text>
          <Text style={styles.paragraph}>
            You must be at least 18 years old to use Growvest. By creating an account, you represent that you are legally capable of entering into binding contracts and that all information provided is accurate and complete.
          </Text>

          <Text style={styles.heading}>3. Account Registration</Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized use of your account. Growvest is not liable for any loss or damage arising from unauthorized access.
          </Text>

          <Text style={styles.heading}>4. Investment Terms</Text>
          <Text style={styles.paragraph}>
            All investments made through Growvest are subject to the specific terms of each investment plan. Returns are calculated based on the plan type (Saving or Fixed) and are subject to change. Past performance does not guarantee future returns.
          </Text>

          <Text style={styles.heading}>5. Withdrawals</Text>
          <Text style={styles.paragraph}>
            Withdrawal requests are processed according to the terms of your investment plan. Processing times may vary. Growvest reserves the right to verify withdrawals and request additional documentation as needed.
          </Text>

          <Text style={styles.heading}>6. User Conduct</Text>
          <Text style={styles.paragraph}>
            You agree not to use the platform for any unlawful purpose or in violation of any applicable laws. Prohibited activities include but are not limited to fraud, money laundering, and unauthorized access to other users' accounts.
          </Text>

          <Text style={styles.heading}>7. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            Growvest shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform. Our total liability is limited to the amount you have invested through our platform.
          </Text>

          <Text style={styles.heading}>8. Termination</Text>
          <Text style={styles.paragraph}>
            We reserve the right to suspend or terminate your account at any time for violation of these terms. You may also close your account at any time by contacting our support team.
          </Text>

          <Text style={styles.heading}>9. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these terms from time to time. Users will be notified of material changes. Continued use of the platform after changes constitutes acceptance of the updated terms.
          </Text>

          <Text style={styles.heading}>10. Contact</Text>
          <Text style={styles.paragraph}>
            For any questions regarding these terms, please contact us via WhatsApp at +91 7305897557 or email at support@growvest.com.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
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
    padding: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    ...colors.shadow.card,
  },
  lastUpdated: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 4,
  },
});

export default TermsScreen;