import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated } from "react-native";

/**
 * Briefly flashes a row background when `active` transitions to `true`.
 *
 * Usage:
 *   const [rowActive, setRowActive] = useState(false);
 *   const { animatedStyle } = useHighlightRow(rowActive);
 *   // To fire: setRowActive(true); setTimeout(() => setRowActive(false), 1100);
 *
 * Returns `animatedStyle` ready to spread onto an Animated.View's style prop.
 * Respects the system reduce-motion preference.
 */
export function useHighlightRow(active: boolean) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    anim.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        anim.setValue(1);
        setTimeout(() => anim.setValue(0), 1200);
      } else {
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: false }),
        ]).start();
      }
    });
  }, [active, anim]);

  const animatedStyle = {
    backgroundColor: anim.interpolate({
      inputRange: [0, 1],
      outputRange: ["rgba(99,179,237,0)", "rgba(99,179,237,0.22)"],
    }),
    borderRadius: 10 as const,
  };

  return { animatedStyle };
}
