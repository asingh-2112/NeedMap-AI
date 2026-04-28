import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CampaignDetailScreen = ({ route, navigation }) => {
  const { campaign } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* --- HERO IMAGE --- */}
        <View>
          <Image source={{ uri: campaign.image }} style={styles.heroImage} />
          <Pressable style={styles.backCircle} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </Pressable>
        </View>

        {/* --- CONTENT --- */}
        <View style={styles.contentCard}>
          <Text style={styles.categoryTag}>URGENT CAUSE</Text>
          <Text style={styles.mainTitle}>{campaign.title}</Text>
          
          {/* FUNDING PROGRESS */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.raisedText}>{campaign.raised} <Text style={styles.subText}>raised</Text></Text>
              <Text style={styles.goalText}>Goal: {campaign.goal}</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: '45%' }]} />
            </View>
          </View>

          {/* DESCRIPTION */}
          <Text style={styles.sectionHeading}>About this Campaign</Text>
          <Text style={styles.description}>
            This initiative aims to provide direct support to those in need. 100% of your contributions go toward 
            purchasing essential supplies and infrastructure. We have already reached 45% of our goal thanks 
            to 1,200+ generous donors like you.
          </Text>

          {/* IMPACT PREVIEW */}
          <View style={styles.impactGrid}>
            <View style={styles.impactBox}>
              <Text style={styles.impactEmoji}>💧</Text>
              <Text style={styles.impactVal}>500+</Text>
              <Text style={styles.impactLab}>Liters Sent</Text>
            </View>
            <View style={styles.impactBox}>
              <Text style={styles.impactEmoji}>🏠</Text>
              <Text style={styles.impactVal}>12</Text>
              <Text style={styles.impactLab}>Shelters Built</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* --- STICKY FOOTER DONATE BUTTON --- */}
      <View style={styles.footer}>
        <Pressable style={styles.donateBtn} onPress={() => alert("Redirecting to Secure Payment...")}>
          <Text style={styles.donateBtnText}>Donate to this Cause</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  heroImage: { width: width, height: 350 },
  backCircle: { 
    position: 'absolute', top: 50, left: 20, 
    backgroundColor: '#FFF', padding: 10, borderRadius: 25,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.2 
  },
  contentCard: { 
    marginTop: -30, backgroundColor: '#FFF', 
    borderTopLeftRadius: 35, borderTopRightRadius: 35, 
    padding: 25 
  },
  categoryTag: { color: '#FF6B6B', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#1A237E', marginTop: 10 },
  
  progressSection: { marginVertical: 20 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  raisedText: { fontSize: 20, fontWeight: 'bold', color: '#34A853' },
  subText: { fontSize: 14, color: '#7986CB', fontWeight: 'normal' },
  goalText: { color: '#7986CB', fontSize: 14, marginTop: 5 },
  barBg: { height: 12, backgroundColor: '#F1F2F6', borderRadius: 6 },
  barFill: { height: 12, backgroundColor: '#34A853', borderRadius: 6 },

  sectionHeading: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 10 },
  description: { color: '#636E72', lineHeight: 24, fontSize: 15 },

  impactGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  impactBox: { 
    width: '48%', backgroundColor: '#F8F9FA', padding: 15, 
    borderRadius: 20, alignItems: 'center' 
  },
  impactEmoji: { fontSize: 24, marginBottom: 5 },
  impactVal: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
  impactLab: { fontSize: 12, color: '#7986CB' },

  footer: { 
    position: 'absolute', bottom: 0, width: '100%', 
    padding: 25, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' 
  },
  donateBtn: { 
    backgroundColor: '#1A237E', padding: 20, 
    borderRadius: 20, alignItems: 'center', elevation: 5 
  },
  donateBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 }
});

export default CampaignDetailScreen;