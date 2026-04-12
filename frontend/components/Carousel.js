import React, { useRef, useState } from "react";
import { StyleSheet, View, Image, ScrollView, Dimensions } from "react-native";

const IMAGES = [
  "https://media.istockphoto.com/id/1247884083/vector/laundry-service-room-vector-illustration-washing-and-drying-machines-with-cleansers-on-shelf.jpg?s=612x612&w=0&k=20&c=myaNEKlqX7R--bzWGDoMI7PhdxG_zdQTKYEBlymJQGk=",
  "https://images.pexels.com/photos/5591581/pexels-photo-5591581.jpeg?auto=compress&cs=tinysrgb&w=800",
];

const windowWidth = Dimensions.get("window").width;

const Carousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleMomentumScrollEnd = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        {IMAGES.map((uri, index) => (
          <Image key={`${uri}-${index}`} source={{ uri }} style={styles.image} />
        ))}
      </ScrollView>
      <View style={styles.pagination}>
        {IMAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default Carousel;

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    alignItems: "center",
  },
  image: {
    width: windowWidth * 0.94,
    height: 200,
    borderRadius: 10,
    marginHorizontal: windowWidth * 0.03,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "#13274F",
  },
  dotInactive: {
    backgroundColor: "#90A4AE",
  },
});
