import React, { useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  Platform,
  StyleProp,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

interface AnimatedPressableProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  disabled?: boolean;
  scale?: number;
  activeOpacity?: number;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  style,
  children,
  disabled = false,
  scale = 0.95,
  activeOpacity = 1,
  hitSlop,
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: disabled ? 1 : scale,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 60,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 30,
      bounciness: 4,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={disabled ? undefined : onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        disabled={disabled}
        style={style}
        hitSlop={hitSlop}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
