import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FOOD_ITEMS = [
  { id: '1', name: 'Rice Bag (5kg)', price: '$10', img: 'https://cdn-icons-png.flaticon.com/512/3014/3014838.png' },
  { id: '2', name: 'Bread & Butter', price: '$5', img: 'https://cdn-icons-png.flaticon.com/512/3014/3014881.png' },
  { id: '3', name: 'Fresh Fruits', price: '$12', img: 'https://cdn-icons-png.flaticon.com/512/3194/3194591.png' },
];

const FoodScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER WITH BACK BUTTON --- */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#1A237E" />
        </Pressable>
        <Text style={styles.title}>Select Meal Kits 🍱</Text>
      </View>

      <FlatList
        data={FOOD_ITEMS}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.img }} style={styles.img} />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{item.price} per kit</Text>
            </View>
            <Pressable style={styles.addBtn}>
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>ADD</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable style={styles.checkout}>
          <Text style={styles.checkoutText}>Proceed to Donate</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFEFE' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
    backgroundColor: '#F1F2F6',
    borderRadius: 12,
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#2D3436',
    flex: 1 
  },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    padding: 15, 
    borderRadius: 20, 
    marginBottom: 15, 
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  img: { width: 60, height: 60 },
  name: { fontSize: 18, fontWeight: '600' },
  price: { color: '#7FB3D5', marginTop: 5 },
  addBtn: { backgroundColor: '#FF9F43', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  footer: { padding: 20, backgroundColor: '#FFF' },
  checkout: { 
    backgroundColor: '#1A237E', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center' 
  },
  checkoutText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});

export default FoodScreen;