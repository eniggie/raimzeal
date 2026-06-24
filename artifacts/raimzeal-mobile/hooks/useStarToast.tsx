import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useToastSwipeHint } from "@/hooks/useToastSwipeHint";

export function useStarToast({ bottomOffset }: { bottomOffset: number }) {
  const colors = useColors();
  const [starToastMessage, setStarToastMessage] = useState<string | null>(null);
  const starToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starToastAnim = useRef(new Animated.Value(0)).current;
  const starToastSwipeY = useRef(new Animated.Value(0)).current;

  const {
    hintSeen,
    swipeHintOpacity,
    swipeHintSlideAnim,
    triggerToastSwipeHint,
    dismissToastSwipeHint,
  } = useToastSwipeHint();

  useEffect(() => {
    return () => {
      if (starToastTimerRef.current) clearTimeout(starToastTimerRef.current);
    };
  }, []);

  // Stable ref so PanResponder callbacks always call the latest version.
  const dismissAnimatedRef = useRef<() => void>(() => {});

  function dismissStarToastAnimated() {
    if (starToastTimerRef.current) {
      clearTimeout(starToastTimerRef.current);
      starToastTimerRef.current = null;
    }
    dismissToastSwipeHint();
    Animated.parallel([
      Animated.timing(starToastSwipeY, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(starToastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStarToastMessage(null);
      starToastSwipeY.setValue(0);
    });
  }
  dismissAnimatedRef.current = dismissStarToastAnimated;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy < -8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,
      onPanResponderMove: (_, gs) => {
        starToastSwipeY.setValue(Math.min(0, gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40 || gs.vy < -0.4) {
          dismissAnimatedRef.current();
        } else {
          Animated.spring(starToastSwipeY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 200,
            friction: 20,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(starToastSwipeY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 20,
        }).start();
      },
    })
  ).current;

  function showStarToast(added: boolean) {
    if (starToastTimerRef.current) clearTimeout(starToastTimerRef.current);
    setStarToastMessage(added ? "Added to Favorites" : "Removed from Favorites");
    starToastSwipeY.setValue(0);
    starToastAnim.setValue(0);
    Animated.spring(starToastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start();
    if (!hintSeen) {
      triggerToastSwipeHint();
    }
    starToastTimerRef.current = setTimeout(() => {
      dismissToastSwipeHint();
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
      <View style={[styles.container, { bottom: bottomOffset }]}>
        <TouchableOpacity
          onPress={() => dismissToastSwipeHint()}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
        >
          <Animated.View
            style={[
              styles.swipeHint,
              {
                opacity: swipeHintOpacity,
                transform: [{ translateY: swipeHintSlideAnim }],
              },
            ]}
          >
            <Ionicons name="chevron-up" size={10} color="#fff" />
            <Text style={styles.swipeHintText}>swipe to dismiss</Text>
          </Animated.View>
        </TouchableOpacity>
        <Animated.View
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
                { translateY: starToastSwipeY },
              ],
              opacity: starToastAnim,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Ionicons name="star" size={16} color="#f59f0a" style={{ marginRight: 6 }} />
          <Text style={[styles.starToastText, { color: colors.foreground }]}>
            {starToastMessage}
          </Text>
        </Animated.View>
      </View>
    ) : null;

  return { showStarToast, starToastElement };
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginBottom: 4,
  },
  swipeHintText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    opacity: 0.7,
    letterSpacing: 0.2,
  },
  starToast: {
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
