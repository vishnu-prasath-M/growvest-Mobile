import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';

const AboutUsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text || colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Intro / Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Image
              source={require('../../../assets/growvest-logo.png')}
              style={{ width: 56, height: 56, borderRadius: 16 }}
            />
          </View>
          <Text style={styles.logoText}>Growvest</Text>
          <Text style={styles.tagline}>Smart Investment Platform</Text>
          <Text style={styles.brandDesc}>
            Growvest is a modern financial platform designed to help individuals save, invest, and manage their money through simple and accessible financial products. Our platform provides a seamless experience to discover investment opportunities, track progress, manage payouts, and monitor overall financial growth.
          </Text>
        </View>

        {/* Mission */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="target" size={22} color="#d97706" />
            <Text style={styles.sectionTitle}>Our Mission</Text>
          </View>
          <Text style={styles.sectionText}>
            Our mission is to make investing and financial planning simple, accessible, and transparent for everyone. Growvest aims to provide users with easy-to-understand financial products and tools that help them manage their money with confidence.
          </Text>
        </View>

        {/* Vision */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="eye" size={22} color="#2563eb" />
            <Text style={styles.sectionTitle}>Our Vision</Text>
          </View>
          <Text style={styles.sectionText}>
            Our vision is to build a trusted and user-friendly financial platform where users can manage different types of investments, track their progress, and work towards their financial goals through a simple digital experience.
          </Text>
        </View>

        {/* Investment Options */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="chart-box-outline" size={22} color="#16a34a" />
            <Text style={styles.sectionTitle}>Our Investment Options</Text>
          </View>

          {/* Chit Funds */}
          <View style={styles.subOptionItem}>
            <View style={styles.subOptionHeader}>
              <MaterialCommunityIcons name="treasure-chest" size={18} color={themeColors.primary || colors.primary} />
              <Text style={styles.subOptionTitle}>Chit Funds</Text>
            </View>
            <Text style={styles.subOptionText}>
              Join structured chit fund groups with scheduled contributions, defined durations, member slots, and applicable payout or withdrawal rules. Users can track their contributions, payment progress, and chit status directly from the app.
            </Text>
          </View>

          <View style={styles.subDivider} />

          {/* Pocket Money */}
          <View style={styles.subOptionItem}>
            <View style={styles.subOptionHeader}>
              <MaterialCommunityIcons name="wallet-giftcard" size={18} color="#7c3aed" />
              <Text style={styles.subOptionTitle}>Pocket Money</Text>
            </View>
            <Text style={styles.subOptionText}>
              Pocket Money helps users invest an amount into a structured payout plan. Users can track their investment, payout schedule, released amounts, remaining balance, and payout history from the app.
            </Text>
          </View>

          <View style={styles.subDivider} />

          {/* New Investments */}
          <View style={styles.subOptionItem}>
            <View style={styles.subOptionHeader}>
              <MaterialCommunityIcons name="finance" size={18} color="#0284c7" />
              <Text style={styles.subOptionTitle}>New Investments</Text>
            </View>
            <Text style={styles.subOptionText}>
              Growvest provides flexible investment plans with clearly defined durations, returns, maturity dates, and withdrawal conditions. Users can view their investment details, track earnings, and withdraw eligible amounts according to the applicable plan rules.
            </Text>
          </View>
        </View>

        {/* Transparency & Security */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="shield-check" size={22} color="#059669" />
            <Text style={styles.sectionTitle}>Transparency & Security</Text>
          </View>
          <Text style={styles.sectionText}>
            We aim to keep investment information clear and easy to understand. Investment amounts, earnings, payment status, payout history, maturity dates, withdrawal eligibility, and other important details are shown clearly within the app.
          </Text>
          <Text style={[styles.sectionText, { marginTop: 10, fontStyle: 'italic' }]}>
            Users should always review the applicable terms and conditions of each investment before making a payment or investment.
          </Text>
        </View>

        {/* Manage Everything in One Place */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="layers-triple" size={22} color="#0891b2" />
            <Text style={styles.sectionTitle}>Manage Everything in One Place</Text>
          </View>
          <Text style={styles.sectionText}>
            With Growvest, users can manage their investments, Chit Fund memberships, Pocket Money plans, payouts, withdrawals, transaction history, notifications, and rewards from one convenient platform.
          </Text>
        </View>

        {/* Refer & Earn */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="gift-outline" size={22} color="#e11d48" />
            <Text style={styles.sectionTitle}>Refer & Earn</Text>
          </View>
          <Text style={styles.sectionText}>
            Invite friends and family to Growvest through your referral link and earn rewards when eligible referral conditions are completed. Referral rewards are credited to the user's rewards wallet according to the applicable referral rules.
          </Text>
        </View>

        {/* Contact Details */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Contact Us</Text>
          
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => {
              Linking.openURL('https://wa.me/918300278515?text=Hello Growvest Support, I need assistance.');
            }}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#dcfce7' }]}>
              <MaterialCommunityIcons name="whatsapp" size={22} color="#25d366" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>+91 8300278515</Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={20} color={themeColors.textTertiary || colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.contactItem}>
            <View style={[styles.contactIcon, { backgroundColor: '#dbeafe' }]}>
              <MaterialCommunityIcons name="email" size={22} color="#3b82f6" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>support@growvest.com</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (themeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background || colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: themeColors.surface || colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.borderLight || colors.borderLight,
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
    color: themeColors.text || colors.text,
  },
  scrollContent: {
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: themeColors.surface || colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: themeColors.borderLight || colors.borderLight,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: themeColors.primary || colors.primary,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: themeColors.textSecondary || colors.textSecondary,
    fontWeight: '500',
    marginBottom: 14,
  },
  brandDesc: {
    fontSize: 14,
    color: themeColors.textSecondary || colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '400',
  },
  sectionCard: {
    backgroundColor: themeColors.surface || colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: themeColors.borderLight || colors.borderLight,
  },
  sectionIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: themeColors.text || colors.text,
    marginLeft: 10,
  },
  sectionText: {
    fontSize: 14,
    color: themeColors.textSecondary || colors.textSecondary,
    lineHeight: 22,
    fontWeight: '400',
  },
  subOptionItem: {
    paddingVertical: 8,
  },
  subOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  subOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: themeColors.text || colors.text,
    marginLeft: 8,
  },
  subOptionText: {
    fontSize: 14,
    color: themeColors.textSecondary || colors.textSecondary,
    lineHeight: 21,
    fontWeight: '400',
  },
  subDivider: {
    height: 1,
    backgroundColor: themeColors.borderLight || colors.borderLight,
    marginVertical: 10,
  },
  contactCard: {
    backgroundColor: themeColors.surface || colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: themeColors.borderLight || colors.borderLight,
  },
  contactTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: themeColors.text || colors.text,
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 13,
    color: themeColors.textSecondary || colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    color: themeColors.text || colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: themeColors.borderLight || colors.borderLight,
    marginVertical: 12,
    marginLeft: 58,
  },
});

export default AboutUsScreen;