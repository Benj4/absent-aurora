import AntdProvider from './AntdProvider';
import PostCard from './PostCard';

interface IndicatorPostsClientProps {
  posts?: any[];
}

export default function IndicatorPostsClient({ posts = [] }: IndicatorPostsClientProps) {
  if (!posts.length) {
    return null;
  }

  return (
    <AntdProvider>
      <div className="space-y-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </AntdProvider>
  );
}
