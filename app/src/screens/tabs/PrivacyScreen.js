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

const PrivacyScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.lastUpdated}>Last Updated: June 2026</Text>

          <Text style={styles.paragraph}>
            Your privacy is important to Growvest. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
          </Text>

          <Text style={styles.heading}>1. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We may collect personal information including but not limited to your name, username, email address, phone number, and financial information necessary for investment transactions.
          </Text>

          <Text style={styles.heading}>2. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            Your information is used to provide and improve our services, process transactions, communicate with you about your account, send important updates, and comply with legal obligations.
          </Text>

          <Text style={styles.heading}>3. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement industry-standard security measures to protect your personal information. This includes encryption, secure servers, and regular security audits. However, no method of transmission over the internet is 100% secure.
          </Text>

          <Text style={styles.heading}>4. Information Sharing</Text>
          <Text style={styles.paragraph}>
            We do not sell, trade, or rent your personal information to third parties. We may share information with trusted service providers who assist in operating our platform, subject to confidentiality agreements.
          </Text>

          <Text style={styles.heading}>5. Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your personal information for as long as your account is active or as needed to provide services. We may retain certain information as required by law or for legitimate business purposes.
          </Text>

          <Text style={styles.heading}>6. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to access, update, or delete your personal information. You may also request a copy of the data we hold about you. Contact us to exercise these rights.
          </Text>

          <Text style={styles.heading}>7. Cookies and Tracking</Text>
          <Text style={styles.paragraph}>
            We may use cookies and similar tracking technologies to enhance your experience. You can control cookie preferences through your device settings.
          </Text>

          <Text style={styles.heading}>8. Third-Party Links</Text>
          <Text style={styles.paragraph}>
            Our platform may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review their privacy policies.
          </Text>

          <Text style={styles.heading}>9. Changes to Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy periodically. Users will be notified of material changes. Continued use after changes constitutes acceptance of the updated policy.
          </Text>

          <Text style={styles.heading}>10. Contact Us</Text>
          <Text style={styles.paragraph}>
            For questions about this Privacy Policy, contact us via WhatsApp at +91 8300278515 or email at support@growvest.com.
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

export default PrivacyScreen;