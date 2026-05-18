import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, Heart, MessageCircle, Send, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { communityPosts, type CommunityPost } from '@/lib/store';

export function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>(communityPosts);
  const [newPost, setNewPost] = useState('');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          liked: !post.liked,
          likes: post.liked ? post.likes - 1 : post.likes + 1,
        };
      }
      return post;
    }));
  };

  const handlePost = () => {
    if (!newPost.trim()) return;

    const post: CommunityPost = {
      id: crypto.randomUUID(),
      userId: 'self',
      userName: 'You',
      content: newPost,
      likes: 0,
      liked: false,
      comments: [],
      createdAt: new Date().toISOString(),
    };
    setPosts([post, ...posts]);
    setNewPost('');
  };

  const handleComment = (postId: string) => {
    if (!newComment.trim()) return;

    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [
            ...post.comments,
            {
              id: crypto.randomUUID(),
              userName: 'You',
              content: newComment,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      return post;
    }));
    setNewComment('');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold font-display">Community</h1>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-border">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-3">
            <Avatar>
              <AvatarFallback>Y</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Share your progress..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                data-testid="input-new-post"
              />
              <Button onClick={handlePost} disabled={!newPost.trim()} data-testid="button-post">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-4" data-testid={`post-${post.id}`}>
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {post.userName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{post.userName}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(post.createdAt)}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>
                    
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleLike(post.id)}
                        data-testid={`like-${post.id}`}
                      >
                        <Heart className={cn(
                          'w-4 h-4 mr-1',
                          post.liked && 'fill-destructive text-destructive'
                        )} />
                        <span className="text-xs">{post.likes}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                        data-testid={`comment-toggle-${post.id}`}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        <span className="text-xs">{post.comments.length}</span>
                      </Button>
                    </div>

                    {expandedPost === post.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-border space-y-3"
                      >
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="flex items-start gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs">
                                {comment.userName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-muted rounded-lg p-2">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium">{comment.userName}</span>
                                <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
                              </div>
                              <p className="text-xs">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Write a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                            className="h-8 text-sm"
                            data-testid={`input-comment-${post.id}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleComment(post.id)}
                            disabled={!newComment.trim()}
                            data-testid={`send-comment-${post.id}`}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}