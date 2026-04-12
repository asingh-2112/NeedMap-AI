import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Built-in with Expo

const VolunteerScreen = ({ navigation }) => {
  return (
    <ScrollView style={styles.container}>
      {/* HEADER IMAGE & BACK BUTTON */}
      <View>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1559027615-cd26735550b4?w=800' }} 
          style={styles.heroImg} 
        />
        <Pressable 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.tag}>URGENT HELP NEEDED</Text>
        <Text style={styles.title}>Weekend Soup Kitchen</Text>
        <Text style={styles.desc}>
          Join us this Saturday to help distribute meals to over 200 families in the downtown area. No experience needed!
        </Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>📍 5th Avenue Hub</Text>
          <Text style={styles.infoText}>⏰ 09:00 AM - 02:00 PM</Text>
        </View>

        <Pressable style={styles.joinBtn} onPress={() => alert("Application Sent!")}>
          <Text style={styles.joinText}>Apply to Volunteer</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  heroImg: { width: '100%', height: 300 },
  backButton: { 
    position: 'absolute', 
    top: 50, 
    left: 20, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    padding: 8, 
    borderRadius: 20 
  },
  content: { 
    padding: 25, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    marginTop: -40, 
    backgroundColor: '#FFF' 
  },
  tag: { color: '#FF6B6B', fontWeight: 'bold', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: 'bold', marginVertical: 10 },
  desc: { color: '#636E72', lineHeight: 22, fontSize: 16 },
  infoRow: { marginTop: 20, padding: 15, backgroundColor: '#F1F2F6', borderRadius: 15 },
  infoText: { fontSize: 14, color: '#2D3436', marginBottom: 5 },
  joinBtn: { backgroundColor: '#00CFE8', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 30 },
  joinText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 }
});

export default VolunteerScreen;