import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

const BG = "#09090b";
const EMERALD = "#2E8B57";
const GOLD = "#D4AF37";

// Total time the branded animation plays before the overlay fades itself out.
// Kept short so boot never feels sluggish.
const HOLD_MS = 1400;
const FADE_OUT_MS = 400;

interface PulseRingProps {
  size: number;
  delay: number;
  color: string;
}

/** An expanding, fading ring emanating from behind the logo — a heartbeat ripple. */
function PulseRing({ size, delay, color }: PulseRingProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.45, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

interface AnimatedSplashProps {
  /** Called once the splash has fully faded out and can be unmounted. */
  onDone: () => void;
}

/**
 * Branded animated splash. Renders the same splash artwork as the native
 * splash screen (full-width, contained, on the same background) so the
 * native→JS handoff is seamless, then plays a heartbeat pulse with rippling
 * rings and a mission tagline before dissolving into the app.
 */
export function AnimatedSplash({ onDone }: AnimatedSplashProps) {
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width, 420);

  const heartbeat = useRef(new Animated.Value(1)).current;
  const textReveal = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => mounted && setReduceMotion(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Hard safety net: no matter what happens with the animation callbacks
  // (dropped frames, backgrounding mid-animation), never let the opaque
  // overlay pin over the app. Fire onDone at most ~3.5s after mount.
  useEffect(() => {
    const failsafe = setTimeout(onDone, 3500);
    return () => clearTimeout(failsafe);
  }, [onDone]);

  useEffect(() => {
    if (reduceMotion === null) return;

    const fadeOut = Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });

    if (reduceMotion) {
      // Respect Reduce Motion: no pulse, just a brief hold and gentle fade.
      const anim = Animated.sequence([Animated.delay(350), fadeOut]);
      anim.start(({ finished }) => finished && onDone());
      return () => anim.stop();
    }

    // "Lub-dub" heartbeat on the logo, matching the ECG line in the artwork.
    const beat = (peak: number, up: number, down: number) =>
      Animated.sequence([
        Animated.timing(heartbeat, {
          toValue: peak,
          duration: up,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heartbeat, {
          toValue: 1,
          duration: down,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    const heartbeatLoop = Animated.loop(
      Animated.sequence([
        beat(1.045, 110, 110),
        beat(1.06, 120, 160),
        Animated.delay(520),
      ]),
    );

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(textReveal, {
          toValue: 1,
          duration: 500,
          delay: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_MS - 750),
      fadeOut,
    ]);

    heartbeatLoop.start();
    anim.start(({ finished }) => finished && onDone());
    return () => {
      heartbeatLoop.stop();
      anim.stop();
    };
  }, [reduceMotion, heartbeat, textReveal, overlayOpacity, onDone]);

  const textTranslate = textReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { opacity: overlayOpacity }]}>
      <View style={styles.center}>
        {reduceMotion === false && (
          <>
            <PulseRing size={logoSize * 0.9} delay={0} color={EMERALD} />
            <PulseRing size={logoSize * 0.9} delay={400} color={GOLD} />
          </>
        )}
        <Animated.View style={{ transform: [{ scale: heartbeat }] }}>
          <Image
            source={require("../assets/images/splash.png")}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
            fadeDuration={0}
          />
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.textBlock, { opacity: textReveal, transform: [{ translateY: textTranslate }] }]}
      >
        <Text style={styles.wordmark}>RAIMZEAL</Text>
        <Text style={styles.tagline}>Fitness · Food Therapy · Health Awareness</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  textBlock: {
    position: "absolute",
    bottom: 96,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  wordmark: {
    color: "#f5f5f6",
    fontSize: 26,
    letterSpacing: 6,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  tagline: {
    color: "#9a9aa3",
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 8,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
