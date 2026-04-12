import React, { useState, useEffect, useRef } from "react";
import { 
  StyleSheet, Text, View, ScrollView, 
  Image, FlatList, Pressable, Dimensions, 
  Animated, ActivityIndicator, StatusBar 
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get("window");

// --- MOCK DATA ---
const SERVICES = [
  { id: "1", name: "Food", icon: "🍱", color: "#FF9F43" },
  { id: "2", name: "Volunteer", icon: "🤝", color: "#00CFE8" },
  { id: "3", name: "Books", icon: "📖", color: "#1B9CFC" },
  { id: "4", name: "Health", icon: "💉", color: "#FF6B6B" },
];

const CAMPAIGNS = [
  {
    id: "101",
    title: "Clean Water for All",
    image: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=500",
    raised: "$4,500",
    goal: "$10,000",
  },
  {
    id: "102",
    title: "Plant 1 Million Trees",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500",
    raised: "$2,200",
    goal: "$5,000",
  },
];

const IMPACT_STORIES = [
  { 
    id: "s1", 
    name: "Sarah's Journey", 
    story: "From homeless to a home...", 
    description: "After two years of searching for stability, Sarah found a community-supported housing project. With your help, she now has a safe place to sleep and is pursuing a degree.",
    img: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400" 
  },
  { 
    id: "s2", 
    name: "Green Park", 
    story: "10,000 trees planted in...", 
    description: "Local volunteers transformed a vacant lot into a thriving community park, cooling the neighborhood and providing a safe space for children to play.",
    img: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400" 
  },
];

const HomeScreen = ({ navigation }) => {
  const [locationAddress, setLocationAddress] = useState("Fetching location...");
  const [loadingLocation, setLoadingLocation] = useState(true);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // --- LOCATION LOGIC ---
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationAddress("Permission denied");
        setLoadingLocation(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      let reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        let address = reverseGeocode[0];
        // Matches the format: 1 Stockton St, San Francisco
        let displayAddress = `${address.name || ''} ${address.street || ''}, ${address.city || ''}`;
        setLocationAddress(displayAddress);
      }
      setLoadingLocation(false);
    })();

    // Floating animation for button
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.circleBg} />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        
        {/* --- HEADER --- */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingTitle}>NGO Connect</Text>
            <Text style={styles.subGreeting}>Small acts, big impact ✨</Text>
            
            {/* LOCATION ROW */}
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#FF6B6B" />
              {loadingLocation ? (
                <ActivityIndicator size="small" color="#7986CB" style={{ marginLeft: 5 }} />
              ) : (
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationAddress}
                </Text>
              )}
            </View>
          </View>

          <Pressable onPress={() => navigation.navigate("Profile")}>
            <Image 
              source={{ uri: "https://i.pravatar.cc/150?u=ngo" }} 
              style={styles.profileImg} 
            />
          </Pressable>
        </View>

        {/* --- GLOBAL IMPACT STATS --- */}
        <View style={styles.glassCard}>
           <Text style={styles.glassTitle}>Global Impact Today</Text>
           <View style={styles.statGrid}>
              <View style={styles.statItem}><Text style={styles.statNum}>$2.4M</Text><Text style={styles.statLab}>Raised</Text></View>
              <View style={styles.statItem}><Text style={styles.statNum}>85k</Text><Text style={styles.statLab}>Helpers</Text></View>
              <View style={styles.statItem}><Text style={styles.statNum}>120</Text><Text style={styles.statLab}>NGOs</Text></View>
           </View>
        </View>

        {/* --- CATEGORIES --- */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {SERVICES.map((item) => (
            <Pressable 
                key={item.id} 
                style={styles.catCard}
                onPress={() => navigation.navigate(item.name)}
            >
              <View style={[styles.catIcon, { backgroundColor: item.color + '22' }]}>
                <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              </View>
              <Text style={styles.catText}>{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* --- URGENT CAMPAIGNS --- */}
        <Text style={styles.sectionTitle}>Urgent Campaigns</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CAMPAIGNS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable 
              style={styles.campaignCard}
              onPress={() => navigation.navigate("CampaignDetail", { campaign: item })}
            >
              <Image source={{ uri: item.image }} style={styles.campaignImage} />
              <View style={styles.campaignInfo}>
                <Text style={styles.campaignTitle}>{item.title}</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: '65%' }]} />
                </View>
                <Text style={styles.campaignGoal}>Raised: {item.raised} / {item.goal}</Text>
              </View>
            </Pressable>
          )}
        />

        {/* --- IMPACT STORIES --- */}
        <Text style={styles.sectionTitle}>Impact Stories</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={IMPACT_STORIES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable 
              style={styles.storyCard}
              onPress={() => navigation.navigate("StoryDetail", { story: item })}
            >
              <Image source={{ uri: item.img }} style={styles.storyImg} />
              <View style={styles.storyOverlay}>
                 <Text style={styles.storyName}>{item.name}</Text>
                 <Text style={styles.storyText}>{item.story}</Text>
              </View>
            </Pressable>
          )}
        />

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* --- FLOATING ACTION BUTTON --- */}
      <Animated.View style={[styles.floatBtnContainer, { transform: [{ translateY: floatAnim }] }]}>
         <Pressable 
            style={styles.floatBtn} 
            onPress={() => navigation.navigate('Cart')}
         >
            <Text style={styles.floatBtnIcon}>🎁</Text>
            <Text style={styles.floatBtnText}>Quick Gift</Text>
         </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  circleBg: { 
    position: 'absolute', top: -50, right: -50, 
    width: 250, height: 250, borderRadius: 125, 
    backgroundColor: '#E3F2FD', zIndex: -1 
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1 },
  greetingTitle: { fontSize: 28, fontWeight: '900', color: '#1A237E' },
  subGreeting: { fontSize: 16, color: '#7986CB' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { fontSize: 13, color: '#636E72', marginLeft: 4, fontWeight: '500' },
  profileImg: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#1A237E' },
  
  glassCard: {
    margin: 20, padding: 25, borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 10
  },
  glassTitle: { fontSize: 18, fontWeight: '700', color: '#3F51B5', marginBottom: 20 },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#1A237E' },
  statLab: { fontSize: 12, color: '#7986CB', marginTop: 4 },

  sectionTitle: { fontSize: 22, fontWeight: '800', marginHorizontal: 25, marginTop: 25 },
  catScroll: { paddingLeft: 20, marginTop: 15 },
  catCard: { 
    alignItems: 'center', marginRight: 25, 
    backgroundColor: '#FFF', padding: 10, borderRadius: 20,
    width: 85, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2
  },
  catIcon: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  catText: { fontSize: 13, fontWeight: '600', color: '#5C6BC0' },

  campaignCard: { 
    backgroundColor: "#FFF", borderRadius: 25, marginLeft: 20, marginTop: 15,
    width: width * 0.75, overflow: "hidden", borderWidth: 1, borderColor: "#F1F2F6"
  },
  campaignImage: { width: "100%", height: 160 },
  campaignInfo: { padding: 15 },
  campaignTitle: { fontSize: 17, fontWeight: "bold", color: '#2D3436' },
  progressBarBg: { height: 8, backgroundColor: "#F1F2F6", borderRadius: 4, marginVertical: 10 },
  progressBarFill: { height: 8, backgroundColor: "#34A853", borderRadius: 4 },
  campaignGoal: { fontSize: 12, color: "#636E72" },

  storyCard: { width: width * 0.8, height: 200, marginLeft: 20, marginTop: 15, borderRadius: 25, overflow: 'hidden' },
  storyImg: { width: '100%', height: '100%' },
  storyOverlay: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  storyName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  storyText: { color: '#EEE', fontSize: 12, marginTop: 5 },

  floatBtnContainer: { position: 'absolute', bottom: 30, alignSelf: 'center' },
  floatBtn: { 
    flexDirection: 'row', backgroundColor: '#1A237E', paddingHorizontal: 30, 
    paddingVertical: 18, borderRadius: 35, alignItems: 'center', elevation: 12,
    shadowColor: '#1A237E', shadowOpacity: 0.4, shadowRadius: 10
  },
  floatBtnIcon: { fontSize: 22, marginRight: 12 },
  floatBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 }
});