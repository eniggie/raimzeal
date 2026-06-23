// Web stub — expo-av Audio recording is native-only.
// Metro picks this file on web builds, preventing the duplicate-React
// crash caused by expo-av's web shim initialising its own React instance.
export const Audio = {
  setAudioModeAsync: async (_mode: unknown): Promise<void> => {},
  requestPermissionsAsync: async () => ({
    granted: false,
    status: "denied" as const,
    canAskAgain: false,
    expires: "never" as const,
  }),
  Recording: {
    createAsync: async (
      _options: unknown
    ): Promise<never> => {
      throw new Error("Audio recording is not supported on web");
    },
  },
  RecordingOptionsPresets: {
    HIGH_QUALITY: {},
  },
} as const;
