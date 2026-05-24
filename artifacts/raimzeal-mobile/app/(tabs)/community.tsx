import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { useRouter } from "expo-router";
import { usePermissionToast } from "@/hooks/usePermissionToast";
import { useTier } from "@/hooks/useTier";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  CommunityPost,
  CommunityComment,
  fetchCommunityPosts,
  createCommunityPost,
  createLegacyCommunityPost,
  fetchComments,
  createComment,
  toggleLike,
  checkUserLikes,
  getApiBase,
  getImageUploadUrl,
} from "@/lib/db";

import { STRIPE_DONATION_URL, DONATION_ACTIVE } from "@/lib/constants";

type FeedTab = "feed" | "questions" | "inner-circle";

interface PostState extends CommunityPost {
  liked: boolean;
  expanded: boolean;
  comments: CommunityComment[];
  loadingComments: boolean;
  commentInput: string;
  submittingComment: boolean;
  imageUrl?: string | null;
}


function PostImage({ uri, colors }: { uri: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.muted as string }}>
      {!loaded && (
        <ActivityIndicator
          size="small"
          color={colors.mutedForeground as string}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%", opacity: loaded ? 1 : 0 }}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}

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
  const router = useRouter();
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
  const { tier } = useTier(userId);

  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostType, setNewPostType] = useState<"post" | "question" | "win" | "tip" | "challenge">("post");
  const [newPostContent, setNewPostContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newPostImageUri, setNewPostImageUri] = useState<string | null>(null);
  const [newPostImageUploading, setNewPostImageUploading] = useState(false);

  const { showPermissionToast, permissionToastElement } = usePermissionToast();

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
        const isInnerCircle = tab === "inner-circle";
        const filter = tab === "questions" ? "question" : undefined;
        let fetched: CommunityPost[] = await fetchCommunityPosts(filter, 30, isInnerCircle);

        if (!isSupabaseConfigured) {
          fetched = [];
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
        setPosts([]);
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
    if (isExpanding && post.comments.length === 0) {
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

    // Upload image if selected before closing the modal
    let uploadedImageUrl: string | null = null;
    if (newPostImageUri && isSupabaseConfigured) {
      setNewPostImageUploading(true);
      try {
        const ext = newPostImageUri.split(".").pop()?.toLowerCase() ?? "jpg";
        const urls = await getImageUploadUrl(ext);
        if (urls) {
          const fileRes = await fetch(newPostImageUri);
          const blob = await fileRes.blob();
          const putRes = await fetch(urls.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": blob.type || "image/jpeg" },
            body: blob,
          });
          if (putRes.ok) uploadedImageUrl = urls.publicUrl;
        }
      } catch { /* best-effort — post without image */ }
      setNewPostImageUploading(false);
    }

    const optimistic: PostState = {
      id: `opt-${Date.now()}`,
      userId: userId ?? "local",
      userName,
      content,
      postType: newPostType,
      imageUrl: uploadedImageUrl ?? newPostImageUri, // show local preview optimistically
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
    setNewPostImageUri(null);

    if (isSupabaseConfigured && userId) {
      try {
        const saved = feedTab === "inner-circle"
          ? await createLegacyCommunityPost(userId, userName, content, newPostType, uploadedImageUrl)
          : await createCommunityPost(userId, userName, content, newPostType, uploadedImageUrl);
        if (saved) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === optimistic.id
                ? { ...p, ...saved, liked: false, expanded: false, comments: [], loadingComments: false, commentInput: "", submittingComment: false }
                : p
            )
          );
        } else {
          // API returned null — remove the optimistic post so the user doesn't
          // see a post that was never actually saved on the server.
          setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
          Alert.alert("Post Failed", "Your post could not be saved. Please try again.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setSubmitting(false);
          return;
        }
      } catch {
        // Network/server error — roll back the optimistic post.
        setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
        Alert.alert("Post Failed", "Could not connect to the server. Please check your connection and try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSubmitting(false);
        return;
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.postUserName, { color: colors.foreground }]}>
                {item.userName}
              </Text>
              {item.authorTier === "rise" && (
                <View style={{ backgroundColor: "#3b82f620", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: "#60a5fa", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 }}>RISE</Text>
                </View>
              )}
              {item.authorTier === "reign" && (
                <View style={{ backgroundColor: "#a855f720", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: "#c084fc", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 }}>REIGN</Text>
                </View>
              )}
              {item.authorTier === "legacy" && (
                <View style={{ backgroundColor: "#eab30820", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: "#fbbf24", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 }}>LEGACY</Text>
                </View>
              )}
            </View>
            <Text style={[styles.postTime, { color: colors.mutedForeground }]}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
          <View
            style={[
              styles.postTypeBadge,
              {
                backgroundColor:
                  item.postType === "question" ? colors.secondary + "20"
                  : item.postType === "win"      ? "#f59e0b20"
                  : item.postType === "tip"      ? "#10b98120"
                  : item.postType === "challenge"? "#8b5cf620"
                  : colors.primary + "20",
              },
            ]}
          >
            <Text
              style={[
                styles.postTypeBadgeText,
                {
                  color:
                    item.postType === "question" ? colors.secondary
                    : item.postType === "win"      ? "#f59e0b"
                    : item.postType === "tip"      ? "#10b981"
                    : item.postType === "challenge"? "#8b5cf6"
                    : colors.primary,
                },
              ]}
            >
              {item.postType === "question" ? "QUESTION"
               : item.postType === "win"      ? "WIN"
               : item.postType === "tip"      ? "TIP"
               : item.postType === "challenge"? "CHALLENGE"
               : "POST"}
            </Text>
          </View>
        </View>

        <Text style={[styles.postContent, { color: colors.foreground }]}>
          {item.content}
        </Text>

        {!!item.imageUrl && (
          <PostImage uri={item.imageUrl} colors={colors} />
        )}

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
            setNewPostImageUri(null);
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
        {(["feed", "questions", "inner-circle"] as FeedTab[]).map((t) => {
          const isActive = feedTab === t;
          const isIC = t === "inner-circle";
          return (
            <TouchableOpacity
              key={t}
              onPress={() => {
                Haptics.selectionAsync();
                setFeedTab(t);
              }}
              style={[
                styles.tabBtn,
                isActive && { backgroundColor: isIC ? "#92400e" : colors.card },
              ]}
            >
              <Ionicons
                name={
                  isIC
                    ? isActive ? "trophy" : "trophy-outline"
                    : t === "feed"
                    ? isActive ? "people" : "people-outline"
                    : isActive ? "help-circle" : "help-circle-outline"
                }
                size={15}
                color={
                  isIC && isActive
                    ? "#fbbf24"
                    : isActive
                    ? colors.foreground
                    : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      isIC && isActive
                        ? "#fbbf24"
                        : isActive
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {t === "feed" ? "Feed" : t === "questions" ? "Q&A" : "Inner Circle"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedTab === "inner-circle" && tier !== "legacy" && (
        <View style={[styles.centered, { padding: 32, gap: 12 }]}>
          <Ionicons name="trophy" size={48} color="#fbbf24" />
          <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: "center", fontSize: 18 }]}>
            Legacy Members Only
          </Text>
          <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular" }}>
            The Inner Circle is a private space for Legacy founders to connect, share insights, and support each other.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: "#fbbf24", paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12, marginTop: 4 }}
            onPress={() => router.push("/membership")}
          >
            <Text style={{ color: "#000", fontFamily: "Inter_700Bold", fontSize: 14 }}>Upgrade to Legacy</Text>
          </TouchableOpacity>
        </View>
      )}

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
                <Text style={[styles.donateTitle, { color: colors.foreground }]}>The Foundation Plan is free forever — no subscription, no catch.</Text>
                <Text style={[styles.donateSubtitle, { color: colors.mutedForeground }]}>
                  {DONATION_ACTIVE
                    ? 'The Foundation Plan is free forever. If it has helped you, a voluntary donation keeps the staff and platform running for everyone.'
                    : 'The Foundation Plan is free forever, built for fitness, food therapy, wellness, and healthcare support.'}
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
                onPress={() => { setShowNewPost(false); setNewPostImageUri(null); }}
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
                disabled={!newPostContent.trim() || submitting || newPostImageUploading}
                style={[
                  styles.modalSubmitBtn,
                  {
                    backgroundColor: newPostContent.trim() && !newPostImageUploading
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
                {(
                  [
                    { id: "post", label: "Update", icon: "megaphone-outline", color: colors.primary },
                    { id: "question", label: "Question", icon: "help-circle-outline", color: colors.secondary },
                    { id: "win", label: "Win 🏆", icon: "trophy-outline", color: "#f59e0b" },
                    { id: "tip", label: "Tip 💡", icon: "bulb-outline", color: "#10b981" },
                    { id: "challenge", label: "Challenge 🔥", icon: "flash-outline", color: "#ef4444" },
                  ] as const
                ).map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setNewPostType(t.id)}
                    style={[
                      styles.typeBtn,
                      newPostType === t.id && {
                        backgroundColor: t.color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={t.icon}
                      size={15}
                      color={
                        newPostType === t.id
                          ? colors.primaryForeground
                          : colors.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        styles.typeBtnText,
                        {
                          color:
                            newPostType === t.id
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          fontFamily:
                            newPostType === t.id
                              ? "Inter_600SemiBold"
                              : "Inter_400Regular",
                        },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                {newPostType === "win" ? "SHARE YOUR WIN" : newPostType === "tip" ? "YOUR TIP" : newPostType === "challenge" ? "ISSUE THE CHALLENGE" : newPostType === "question" ? "YOUR QUESTION" : "YOUR POST"}
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

              <TouchableOpacity
                style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={() => {
                  Alert.alert(
                    "Add a photo",
                    undefined,
                    [
                      {
                        text: "Take Photo",
                        onPress: async () => {
                          const { status } = await ImagePicker.requestCameraPermissionsAsync();
                          if (status !== "granted") {
                            showPermissionToast("Camera access blocked — tap to open Settings");
                            return;
                          }
                          const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                            allowsEditing: false,
                          });
                          if (!result.canceled && result.assets[0]) {
                            setNewPostImageUri(result.assets[0].uri);
                          }
                        },
                      },
                      {
                        text: "Choose from Library",
                        onPress: async () => {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== "granted") {
                            showPermissionToast("Photo access blocked — tap to open Settings");
                            return;
                          }
                          const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                            allowsEditing: false,
                          });
                          if (!result.canceled && result.assets[0]) {
                            setNewPostImageUri(result.assets[0].uri);
                          }
                        },
                      },
                      { text: "Cancel", style: "cancel" },
                    ]
                  );
                }}
              >
                <Ionicons name="image-outline" size={18} color={colors.mutedForeground} />
                <Text style={[styles.imagePickerText, { color: colors.mutedForeground }]}>
                  {newPostImageUri ? "Change photo" : "Add a photo (optional)"}
                </Text>
              </TouchableOpacity>

              {!!newPostImageUri && (
                <View style={styles.imagePreviewRow}>
                  {newPostImageUploading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ margin: 8 }} />
                  ) : (
                    <>
                      <Image
                        source={{ uri: newPostImageUri }}
                        style={styles.imagePreviewThumb}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => setNewPostImageUri(null)}
                        style={[styles.imageRemoveBtn, { backgroundColor: colors.destructive }]}
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {permissionToastElement}
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
  postImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1a1a1a",
  },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  imagePickerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  imagePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  imagePreviewThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  imageRemoveBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
    marginBottom: 60,
  },
});
