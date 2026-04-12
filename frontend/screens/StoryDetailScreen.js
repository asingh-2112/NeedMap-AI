import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const StoryDetailScreen = ({ route, navigation }) => {
  const { story } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* --- FULL WIDTH IMAGE --- */}
        <View>
          <Image source={{ uri: story.img }} style={styles.headerImage} />
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </Pressable>
        </View>

        {/* --- STORY CONTENT --- */}
        <View style={styles.detailsContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SUCCESS STORY</Text>
          </View>
          
          <Text style={styles.title}>{story.name}</Text>
          <Text style={styles.summary}>{story.story}</Text>
          
          <View style={styles.divider} />

          <Text style={styles.contentHeader}>The Full Story</Text>
          <Text style={styles.fullDescription}>{story.description}</Text>

          {/* IMPACT CARD */}
          <View style={styles.impactCard}>
            <Ionicons name="heart" size={24} color="#FF6B6B" />
            <Text style={styles.impactTitle}>How you helped</Text>
            <Text style={styles.impactDescription}>
              This story was made possible by the support of 450 donors through the "New Horizons" fund.
            </Text>
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FOOTER ACTION */}
      <View style={styles.footer}>
        <Pressable style={styles.shareBtn} onPress={() => alert("Shared!")}>
          <Ionicons name="share-social-outline" size={20} color="#1A237E" />
          <Text style={styles.shareText}>Share this Story</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  headerImage: { width: width, height: 450 },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 8 },
  detailsContainer: { padding: 25, marginTop: -40, backgroundColor: '#FAFAFA', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  badge: { backgroundColor: '#E8EAF6', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 15 },
  badgeText: { color: '#3F51B5', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1A237E' },
  summary: { fontSize: 18, color: '#7986CB', marginTop: 5, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 25 },
  contentHeader: { fontSize: 20, fontWeight: 'bold', color: '#2D3436', marginBottom: 15 },
  fullDescription: { fontSize: 16, color: '#636E72', lineHeight: 26 },
  impactCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginTop: 30, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  impactTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginVertical: 10 },
  impactDescription: { color: '#7986CB', fontSize: 14, lineHeight: 20 },
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: '#FFF' },
  shareBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1A237E', padding: 15, borderRadius: 20 },
  shareText: { color: '#1A237E', fontWeight: 'bold', marginLeft: 10 }
});

export default StoryDetailScreen;