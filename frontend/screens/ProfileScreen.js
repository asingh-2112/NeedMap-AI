import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Pressable onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="black" />
      </Pressable>
        {/* --- PROFILE HEADER --- */}
        <View style={styles.profileHeader}>
          <Image 
            source={{ uri: "https://i.pravatar.cc/150?u=ngo" }} 
            style={styles.avatar} 
          />
          <Text style={styles.userName}>Alex Changemaker</Text>
          <Text style={styles.userEmail}>alex.help@ngo.com</Text>
          
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>🏆 Gold Philanthropist</Text>
          </View>
        </View>

        {/* --- IMPACT STATS --- */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>24</Text>
            <Text style={styles.statLab}>Donations</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>150</Text>
            <Text style={styles.statLab}>Hours</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>$1.2k</Text>
            <Text style={styles.statLab}>Total</Text>
          </View>
        </View>

        {/* --- MENU OPTIONS --- */}
        <View style={styles.menuSection}>
          <Pressable style={styles.menuItem}>
            <Ionicons name="heart-outline" size={24} color="#1A237E" />
            <Text style={styles.menuText}>My Impact History</Text>
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={24} color="#1A237E" />
            <Text style={styles.menuText}>Notifications</Text>
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Ionicons name="settings-outline" size={24} color="#1A237E" />
            <Text style={styles.menuText}>Settings</Text>
          </Pressable>
          <Pressable 
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate("Login")}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
            <Text style={[styles.menuText, { color: '#FF6B6B' }]}>Logout</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  profileHeader: { alignItems: 'center', padding: 30, backgroundColor: '#FFF' },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 15, borderWidth: 3, borderColor: '#1A237E' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#1A237E' },
  userEmail: { fontSize: 14, color: '#7986CB', marginTop: 5 },
  badgeContainer: { backgroundColor: '#E8EAF6', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginTop: 15 },
  badgeText: { color: '#3F51B5', fontWeight: 'bold', fontSize: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 25, backgroundColor: '#FFF', marginTop: 10 },
  statBox: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
  statLab: { fontSize: 12, color: '#7986CB' },
  menuSection: { marginTop: 20, backgroundColor: '#FFF', paddingHorizontal: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F2F6' },
  menuText: { fontSize: 16, marginLeft: 15, color: '#2D3436', fontWeight: '500' }
});

export default ProfileScreen;