import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable } from 'react-native';

const BOOKS = [
  { id: '1', title: 'Science Grade 5', author: 'NCERT', color: '#D5F5E3' },
  { id: '2', title: 'Story Collection', author: 'Roald Dahl', color: '#FAD7A0' },
  { id: '3', title: 'Basic Math', author: 'RS Aggarwal', color: '#AED6F1' },
];

const BooksScreen = ({ navigation }) => (
  <View style={styles.container}>
    <Pressable onPress={() => navigation.goBack()}>
        <Text>Back</Text>
      </Pressable>
    <Text style={styles.header}>Fill a Child's Library 📚</Text>
    <FlatList
      data={BOOKS}
      numColumns={2}
      renderItem={({ item }) => (
        <View style={[styles.bookCard, { backgroundColor: item.color }]}>
          <Text style={styles.bookTitle}>{item.title}</Text>
          <Text style={styles.author}>{item.author}</Text>
          <Pressable style={styles.donateSmall}><Text>Donate</Text></Pressable>
        </View>
      )}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FFF' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  bookCard: { flex: 1, margin: 10, height: 180, borderRadius: 15, padding: 15, justifyContent: 'space-between' },
  bookTitle: { fontSize: 16, fontWeight: 'bold' },
  author: { fontSize: 12, color: '#555' },
  donateSmall: { backgroundColor: '#FFF', padding: 5, borderRadius: 5, alignItems: 'center' }
});

export default BooksScreen;