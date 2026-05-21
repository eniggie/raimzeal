import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  CommunityPost,
  CommunityComment,
  fetchCommunityPosts,
  createCommunityPost,
  fetchComments,
  createComment,
  toggleLike,
  checkUserLikes,
  getApiBase,
} from "@/lib/db";

const STRIPE_DONATION_URL = 'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00';
const DONATION_ACTIVE = Boolean(
  STRIPE_DONATION_URL &&
  STRIPE_DONATION_URL.startsWith('https://donate.stripe.com/') &&
  !STRIPE_DONATION_URL.includes('PLACEHOLDER')
);

type FeedTab = "feed" | "questions";

interface PostState extends CommunityPost {
  liked: boolean;
  expanded: boolean;
  comments: CommunityComment[];
  loadingComments: boolean;
  commentInput: string;
  submittingComment: boolean;
}

const DEMO_POSTS: CommunityPost[] = [
  {
    id: "demo-1",
    userId: "demo-user-1",
    userName: "Sarah K.",
    content: "Just hit a new personal record on deadlifts today — 120 kg! Six months ago I could barely do 60 kg. Consistency really is everything. Keep going everyone!",
    postType: "post",
    likesCount: 34,
    commentsCount: 7,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "demo-2",
    userId: "demo-user-2",
    userName: "Mohammed A.",
    content: "Best pre-workout meal for someone training at 6 AM? I currently just have black coffee but I feel like I'm running on empty by the time I get to my third set.",
    postType: "question",
    likesCount: 18,
    commentsCount: 12,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "demo-3",
    userId: "demo-user-3",
    userName: "Priya S.",
    content: "Week 3 of the 8-week beginner program and already noticing my jeans feel looser. The nutrition tracking in RAIMZEAL has completely changed how I eat — I had no idea I was barely hitting 60g protein per day before.",
    postType: "post",
    likesCount: 51,
    commentsCount: 9,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: "demo-4",
    userId: "demo-user-4",
    userName: "James T.",
    content: "How do you all handle training during Ramadan? I find my energy really drops in the afternoon before Iftar but I still want to maintain my muscle. Any tips?",
    postType: "question",
    likesCount: 27,
    commentsCount: 19,
    createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
  },
  {
    id: "demo-5",
    userId: "demo-user-5",
    userName: "Aisha M.",
    content: "30-day check in — down 4.2 kg and up on every single lift. The combination of RAIMZEAL tracking and Ovia AI coaching is genuinely different from anything I have tried before.",
    postType: "post",
    likesCount: 89,
    commentsCount: 23,
    createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
  },
];

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommunityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useFitness();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84;

  const [feedTab, setFeedTab] = useState<FeedTab>("feed");
  const [posts, setPosts] = useState<PostState[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostType, setNewPostType] = useState<"post" | "question">("post");
  const [newPostContent, setNewPostContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        setUserId(data.session?.user?.id ?? null);
      });
    }
  }, []);

  const loadPosts = useCallback(
    async (tab: FeedTab = feedTab) => {
      try {
        const filter = tab === "questions" ? "question" : undefined;
        let fetched: CommunityPost[] = await fetchCommunityPosts(filter);

        if (!isSupabaseConfigured) {
          fetched = tab === "questions"
            ? DEMO_POSTS.filter((p) => p.postType === "question")
            : DEMO_POSTS;
        }

        let likedSet = new Set<string>();
        if (userId) {
          likedSet = await checkUserLikes(fetched.map((p) => p.id), userId);
        }

        setPosts(
          fetched.map((p) => ({
            ...p,
            liked: likedSet.has(p.id),
            expanded: false,
            comments: [],
            loadingComments: false,
            commentInput: "",
            submittingComment: false,
          }))
        );
      } catch {
        const fallback = tab === "questions"
          ? DEMO_POSTS.filter((p) => p.postType === "question")
          : DEMO_POSTS;
        setPosts(
          fallback.map((p) => ({
            ...p,
            liked: false,
            expanded: false,
            comments: [],
            loadingComments: false,
            commentInput: "",
            submittingComment: false,
          }))
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [feedTab, userId]
  );

  useEffect(() => {
    setLoading(true);
    loadPosts(feedTab);
  }, [feedTab]);

  useEffect(() => {
    if (userId !== null) {
      loadPosts(feedTab);
    }
  }, [userId]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadPosts(feedTab);
  }

  async function handleLike(postId: string) {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to like posts.");
      return;
    }
    const isDemoPost = postId.startsWith("demo-");
    if (isDemoPost) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !p.liked, likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1 }
            : p
        )
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1 }
          : p
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await toggleLike(postId, userId);
      if (result.newCount < 0) throw new Error("like write failed");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked: result.liked, likesCount: result.newCount } : p
        )
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !p.liked, likesCount: p.liked ? p.likesCount + 1 : p.likesCount - 1 }
            : p
        )
      );
    }
  }

  async function handleExpandComments(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const isExpanding = !post.expanded;
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, expanded: isExpanding } : p))
    );
    if (isExpanding && post.comments.length === 0 && !postId.startsWith("demo-")) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, loadingComments: true } : p))
      );
      try {
        const fetched = await fetchComments(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, comments: fetched, loadingComments: false } : p
          )
        );
      } catch {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, loadingComments: false } : p))
        );
      }
    }
  }

  async function handleSubmitComment(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.commentInput.trim()) return;
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to comment.");
      return;
    }
    const content = post.commentInput.trim();
    const userName = user?.name ?? "Anonymous";
    const optimisticComment: CommunityComment = {
      id: `opt-${Date.now()}`,
      postId,
      userId,
      userName,
      content,
      createdAt: new Date().toISOString(),
    };
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentInput: "",
              submittingComment: true,
              comments: [...p.comments, optimisticComment],
              commentsCount: p.commentsCount + 1,
            }
          : p
      )
    );
    if (!postId.startsWith("demo-")) {
      try {
        const saved = await createComment(postId, userId, userName, content);
        if (saved) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    submittingComment: false,
                    comments: p.comments.map((c) =>
                      c.id === optimisticComment.id ? saved : c
                    ),
                  }
                : p
            )
          );
        } else {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, submittingComment: false } : p
            )
          );
        }
      } catch {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, submittingComment: false } : p))
        );
      }
    } else {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, submittingComment: false } : p))
      );
    }
  }

  async function handleCreatePost() {
    if (!newPostContent.trim()) return;
    if (!userId && isSupabaseConfigured) {
      Alert.alert("Sign in required", "Please sign in to post.");
      return;
    }
    setSubmitting(true);
    const userName = user?.name ?? "Anonymous";
    const content = newPostContent.trim();

    const optimistic: PostState = {
      id: `opt-${Date.now()}`,
      userId: userId ?? "local",
      userName,
      content,
      postType: newPostType,
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      liked: false,
      expanded: false,
      comments: [],
      loadingComments: false,
      commentInput: "",
      submittingComment: false,
    };

    setPosts((prev) => [optimistic, ...prev]);
    setShowNewPost(false);
    setNewPostContent("");

    if (isSupabaseConfigured && userId) {
      try {
        const saved = await createCommunityPost(userId, userName, content, newPostType);
        if (saved) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === optimistic.id
                ? { ...p, ...saved, liked: false, expanded: false, comments: [], loadingComments: false, commentInput: "", submittingComment: false }
                : p
            )
          );
        }
      } catch {
        /* keep optimistic */
      }
    }
    setSubmitting(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function renderPost({ item }: { item: PostState }) {
    const isQuestion = item.postType === "question";
    return (
      <View
        style={[
          styles.postCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.postHeader}>
          <View
            style={[
              styles.postAvatar,
              {
                backgroundColor: isQuestion
                  ? colors.secondary + "25"
                  : colors.primary + "25",
              },
            ]}
          >
            <Text
              style={[
                styles.postAvatarText,
                { color: isQuestion ? colors.secondary : colors.primary },
              ]}
            >
              {item.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.postMeta}>
            <Text style={[styles.postUserName, { color: colors.foreground }]}>
              {item.userName}
            </Text>
            <Text style={[styles.postTime, { color: colors.mutedForeground }]}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
          <View
            style={[
              styles.postTypeBadge,
              {
                backgroundColor: isQuestion
                  ? colors.secondary + "20"
                  : colors.primary + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.postTypeBadgeText,
                { color: isQuestion ? colors.secondary : colors.primary },
              ]}
            >
              {isQuestion ? "QUESTION" : "POST"}
            </Text>
          </View>
        </View>

        <Text style={[styles.postContent, { color: colors.foreground }]}>
          {item.content}
        </Text>

        <View style={[styles.postActions, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => handleLike(item.id)}
            style={styles.actionBtn}
          >
            <Ionicons
              name={item.liked ? "heart" : "heart-outline"}
              size={18}
              color={item.liked ? colors.destructive : colors.mutedForeground}
            />
            <Text
              style={[
                styles.actionText,
                {
                  color: item.liked ? colors.destructive : colors.mutedForeground,
                },
              ]}
            >
              {item.likesCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleExpandComments(item.id)}
            style={styles.actionBtn}
          >
            <Ionicons
              name={item.expanded ? "chatbubble" : "chatbubble-outline"}
              size={17}
              color={item.expanded ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.actionText,
                { color: item.expanded ? colors.primary : colors.mutedForeground },
              ]}
            >
              {item.commentsCount}
            </Text>
          </TouchableOpacity>
        </View>

        {item.expanded && (
          <View
            style={[styles.commentsSection, { borderTopColor: colors.border }]}
          >
            {item.loadingComments ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ paddingVertical: 12 }}
              />
            ) : (
              <>
                {item.comments.map((c) => (
                  <View key={c.id} style={styles.commentItem}>
                    <View
                      style={[
                        styles.commentAvatar,
                        { backgroundColor: colors.muted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.commentAvatarText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {c.userName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.commentBubble,
                        { backgroundColor: colors.muted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.commentUserName,
                          { color: colors.primary },
                        ]}
                      >
                        {c.userName}
                      </Text>
                      <Text
                        style={[
                          styles.commentContent,
                          { color: colors.foreground },
                        ]}
                      >
                        {c.content}
                      </Text>
                    </View>
                  </View>
                ))}

                {item.comments.length === 0 && (
                  <Text
                    style={[
                      styles.noComments,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    No comments yet. Be the first to reply.
                  </Text>
                )}

                <View
                  style={[
                    styles.commentInputRow,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={item.commentInput}
                    onChangeText={(text) =>
                      setPosts((prev) =>
                        prev.map((p) =>
                          p.id === item.id ? { ...p, commentInput: text } : p
                        )
                      )
                    }
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.commentInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.foreground,
                        borderColor: colors.border,
                      },
                    ]}
                    returnKeyType="send"
                    onSubmitEditing={() => handleSubmitComment(item.id)}
                    editable={!item.submittingComment}
                  />
                  <TouchableOpacity
                    onPress={() => handleSubmitComment(item.id)}
                    disabled={!item.commentInput.trim() || item.submittingComment}
                    style={[
                      styles.commentSendBtn,
                      {
                        backgroundColor: item.commentInput.trim()
                          ? colors.primary
                          : colors.muted,
                      },
                    ]}
                  >
                    {item.submittingComment ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Ionicons
                        name="arrow-up"
                        size={16}
                        color={
                          item.commentInput.trim()
                            ? colors.primaryForeground
                            : colors.mutedForeground
                        }
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Community
        </Text>
        <TouchableOpacity
          onPress={() => {
            setNewPostContent("");
            setNewPostType("post");
            setShowNewPost(true);
          }}
          style={[styles.newPostBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={18} color={colors.primaryForeground} />
          <Text style={[styles.newPostBtnText, { color: colors.primaryForeground }]}>
            New Post
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
        {(["feed", "questions"] as FeedTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => {
              Haptics.selectionAsync();
              setFeedTab(t);
            }}
            style={[
              styles.tabBtn,
              feedTab === t && { backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name={
                t === "feed"
                  ? feedTab === t
                    ? "people"
                    : "people-outline"
                  : feedTab === t
                  ? "help-circle"
                  : "help-circle-outline"
              }
              size={15}
              color={feedTab === t ? colors.foreground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: feedTab === t ? colors.foreground : colors.mutedForeground,
                  fontFamily:
                    feedTab === t ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
            >
              {t === "feed" ? "Community Feed" : "Questions"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={renderPost}
          ListHeaderComponent={
            <TouchableOpacity
              style={[styles.donateBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={async () => {
                if (!DONATION_ACTIVE) return;
                try {
                  const r = await fetch(`${getApiBase()}/stripe/donation-health`);
                  const { ok } = await r.json() as { ok: boolean };
                  if (!ok) throw new Error('unhealthy');
                  await Linking.openURL(STRIPE_DONATION_URL);
                } catch {
                  Alert.alert('Unavailable', 'Donation link temporarily unavailable — please try again shortly.');
                }
              }}
              activeOpacity={DONATION_ACTIVE ? 0.75 : 1}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.donateTitle, { color: colors.foreground }]}>Enjoying RAIMZEAL?</Text>
                <Text style={[styles.donateSubtitle, { color: colors.mutedForeground }]}>
                  {DONATION_ACTIVE
                    ? 'We are free forever. Donations keep the lights on for everyone.'
                    : 'Donation link coming soon. RAIMZEAL remains free forever.'}
                </Text>
              </View>
              {DONATION_ACTIVE && (
                <View style={[styles.donateBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="heart" size={13} color={colors.primaryForeground} />
                  <Text style={[styles.donateBtnText, { color: colors.primaryForeground }]}>Donate</Text>
                </View>
              )}
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={52}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No posts yet
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
              >
                Be the first to share your progress or ask a question.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showNewPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewPost(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[styles.modalScreen, { backgroundColor: colors.background }]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <TouchableOpacity
                onPress={() => setShowNewPost(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                New Post
              </Text>
              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={!newPostContent.trim() || submitting}
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor: newPostContent.trim()
                      ? colors.primary
                      : colors.muted,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.modalSubmitText,
                      {
                        color: newPostContent.trim()
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    Post
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                TYPE
              </Text>
              <View
                style={[
                  styles.typeToggle,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                {(["post", "question"] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setNewPostType(t)}
                    style={[
                      styles.typeBtn,
                      newPostType === t && {
                        backgroundColor: t === "question" ? colors.secondary : colors.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        t === "post"
                          ? "megaphone-outline"
                          : "help-circle-outline"
                      }
                      size={15}
                      color={
                        newPostType === t
                          ? colors.primaryForeground
                          : colors.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        styles.typeBtnText,
                        {
                          color:
                            newPostType === t
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          fontFamily:
                            newPostType === t
                              ? "Inter_600SemiBold"
                              : "Inter_400Regular",
                        },
                      ]}
                    >
                      {t === "post" ? "Share Update" : "Ask Question"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                {newPostType === "post" ? "YOUR POST" : "YOUR QUESTION"}
              </Text>
              <TextInput
                value={newPostContent}
                onChangeText={setNewPostContent}
                placeholder={
                  newPostType === "post"
                    ? "Share a workout win, progress update, tip, or motivation..."
                    : "Ask the community for advice, recommendations, or experiences..."
                }
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={500}
                style={[
                  styles.contentInput,
                  {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
                autoFocus
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                {newPostContent.length}/500
              </Text>

              <View
                style={[
                  styles.noMediaNotice,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.noMediaText, { color: colors.mutedForeground }]}
                >
                  Text-only posts. Images, videos, and audio will be available in a future update.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  newPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newPostBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabRow: {
    flexDirection: "row",
    margin: 12,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabLabel: { fontSize: 13 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 12, gap: 12 },
  postCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingBottom: 10,
  },
  postAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  postAvatarText: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  postMeta: { flex: 1, gap: 1 },
  postUserName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  postTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  postTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  postTypeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  postContent: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  postActions: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  commentsSection: { borderTopWidth: 1, padding: 12, gap: 8 },
  commentItem: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  commentAvatarText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  commentBubble: {
    flex: 1,
    borderRadius: 10,
    padding: 9,
    gap: 2,
  },
  commentUserName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  commentContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  noComments: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 8,
  },
  commentInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  commentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === "ios" ? 14 : 14,
  },
  modalCloseBtn: { padding: 4 },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  modalSubmitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  modalSubmitText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalBody: { flex: 1, padding: 16, gap: 10 },
  modalLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  typeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    gap: 3,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  typeBtnText: { fontSize: 13 },
  contentInput: {
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 140,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  noMediaNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  noMediaText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  donateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  donateTitle: { fontSize: 13, fontFamily: "SpaceGrotesk_700Bold", marginBottom: 2 },
  donateSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  donateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
  },
  donateBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
