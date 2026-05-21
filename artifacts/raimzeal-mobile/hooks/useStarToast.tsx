import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export function useStarToast({ bottomOffset }: { bottomOffset: number }) {
  const colors = useColors();
  const [starToastMessage, setStarToastMessage] = useState<string | null>(null);
  const starToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starToastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (starToastTimerRef.current) clearTimeout(starToastTimerRef.current);
    };
  }, []);

  function showStarToast(added: boolean) {
    if (starToastTimerRef.current) clearTimeout(starToastTimerRef.current);
    setStarToastMessage(added ? "Added to Favorites" : "Removed from Favorites");
    starToastAnim.setValue(0);
    Animated.spring(starToastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    starToastTimerRef.current = setTimeout(() => {
      Animated.timing(starToastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setStarToastMessage(null);
      });
      starToastTimerRef.current = null;
    }, 2000);
  }

  const starToastElement =
    starToastMessage !== null ? (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.starToast,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [
              {
                translateY: starToastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
            opacity: starToastAnim,
            bottom: bottomOffset,
          },
        ]}
      >
        <Ionicons name="star" size={16} color="#f59f0a" style={{ marginRight: 6 }} />
        <Text style={[styles.starToastText, { color: colors.foreground }]}>
          {starToastMessage}
        </Text>
      </Animated.View>
    ) : null;

  return { showStarToast, starToastElement };
}

const styles = StyleSheet.create({
  starToast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  starToastText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
