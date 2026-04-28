import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ADDED { navigation } HERE
const HealthScreen = ({ navigation }) => (
  <ScrollView style={styles.container}>
    
    <View style={styles.banner}>
      <Pressable 
        style={styles.backButton} 
        onPress={() => navigation.goBack()} // Now this will work!
      >
        <Ionicons name="arrow-back" size={28} color="white" />
      </Pressable>
      <Text style={styles.bannerText}>Medical Emergency Fund 🏥</Text>
    </View>
    
    <View style={styles.card}>
      <Text style={styles.cardTitle}>First Aid Kit</Text>
      <Text style={styles.cardDesc}>Basic medicine, bandages, and sanitizers for one family.</Text>
      <Pressable style={styles.btn}><Text style={styles.btnText}>Sponsor for $15</Text></Pressable>
    </View>

    <View style={[styles.card, { borderColor: '#FF6B6B', borderWidth: 1 }]}>
      <Text style={[styles.cardTitle, { color: '#FF6B6B' }]}>Critical Surgery</Text>
      <Text style={styles.cardDesc}>Help fund a life-saving operation for a child in need.</Text>
      <Pressable style={[styles.btn, { backgroundColor: '#FF6B6B' }]}><Text style={styles.btnText}>Support Now</Text></Pressable>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  banner: { 
    backgroundColor: '#1B9CFC', 
    paddingTop: 60, // Added padding for the back button
    paddingBottom: 40, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 55,
    zIndex: 10
  },
  bannerText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', margin: 20, padding: 20, borderRadius: 20, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  cardDesc: { color: '#636E72', marginBottom: 20 },
  btn: { backgroundColor: '#1B9CFC', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' }
});

export default HealthScreen;