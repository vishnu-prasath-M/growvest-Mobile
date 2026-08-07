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
import { colors, typography } from '../../theme/theme';

const AboutUsScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Image
              source={require('../../../assets/growvest-logo.png')}
              style={{ width: 56, height: 56, borderRadius: 16 }}
            />
          </View>
          <Text style={styles.logoText}>Growvest</Text>
          <Text style={styles.tagline}>Smart Investment Platform</Text>
        </View>

        {/* Introduction */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="information" size={22} color="#7c3aed" />
            <Text style={styles.sectionTitle}>Introduction</Text>
          </View>
          <Text style={styles.sectionText}>
            Growvest is a modern investment platform designed to help individuals grow their wealth through smart, accessible investment options. We provide users with a seamless experience to invest, track, and manage their financial portfolio.
          </Text>
        </View>

        {/* Mission */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="target" size={22} color="#d97706" />
            <Text style={styles.sectionTitle}>Our Mission</Text>
          </View>
          <Text style={styles.sectionText}>
            To empower individuals with accessible and profitable investment opportunities, making wealth growth simple and transparent for everyone.
          </Text>
        </View>

        {/* Vision */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="eye" size={22} color="#2563eb" />
            <Text style={styles.sectionTitle}>Our Vision</Text>
          </View>
          <Text style={styles.sectionText}>
            To become the most trusted and user-friendly investment platform, enabling financial freedom for millions of users across the country.
          </Text>
        </View>

        {/* Platform Description */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionIconHeader}>
            <MaterialCommunityIcons name="chart-line" size={22} color="#16a34a" />
            <Text style={styles.sectionTitle}>Investment Platform</Text>
          </View>
          <Text style={styles.sectionText}>
            Growvest offers flexible investment plans with competitive returns. Our Saving plan provides 12% p.a. returns with easy access to funds, while our Fixed plan offers 24% p.a. returns for long-term growth. All investments are securely tracked and managed through our platform.
          </Text>
        </View>

        {/* Contact Details */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Contact Us</Text>
          
          <TouchableOpacity style={styles.contactItem} onPress={() => {
            Linking.openURL('https://wa.me/918300278515?text=Hello Growvest Support, I need assistance.');
          }}>
            <View style={[styles.contactIcon, { backgroundColor: '#dcfce7' }]}>
              <MaterialCommunityIcons name="whatsapp" size={22} color="#25d366" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>+91 8300278515</Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={20} color={colors.textTertiary} />
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
  logoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    ...colors.shadow.card,
  },
  sectionIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 10,
  },
  sectionText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    fontWeight: '400',
  },
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    ...colors.shadow.card,
  },
  contactTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
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
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
    marginLeft: 58,
  },
});

export default AboutUsScreen;