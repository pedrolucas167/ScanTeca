"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  Bookmark,
  CheckCircle2,
  MessageCircle,
  MoreHorizontal,
  Quote,
  Send,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { TextComposer } from "./TextComposer";

interface Comment {
  id: string;
  author: string;
  avatarUrl?: string | null;
  content: string;
}

interface FeedPost {
  id: string;
  authorId: string;
  isOwner: boolean;
  author: string;
  avatarUrl: string | null;
  initials: string;
  time: string;
  label: string;
  text: string;
  imageUrl?: string | null;
  quotedPost?: {
    id: string;
    author: string;
    text: string;
  } | null;
  book?: { title: string; author: string; cover: string | null };
  likes: number;
  liked: boolean;
  saved: boolean;
  commentsCount: number;
  comments: Comment[];
}

export default function FeedClient() {
  const { user } = useUser();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [quotedPost, setQuotedPost] = useState<FeedPost | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/feed")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o feed.");
        return response.json() as Promise<{ posts: FeedPost[] }>;
      })
      .then((data) => setPosts(data.posts))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Erro ao carregar o feed.");
      })
      .finally(() => setLoading(false));
  }, []);

  const addPost = async (content: string) => {
    let postId: string | null = null;
    
    try {
      // First create the post
      const response = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content,
          quotedPostId: quotedPost?.id,
        }),
      });
      if (!response.ok) throw new Error("Não foi possível publicar o post.");
      const data = (await response.json()) as { post: FeedPost };
      postId = data.post.id;
      
      // If there's an image, upload it
      if (imagePreview) {
        setUploadingImage(true);
        const imageResponse = await fetch("/api/feed/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imagePreview, postId }),
        });
        if (!imageResponse.ok) {
          const error = await imageResponse.json();
          throw new Error(error.error || "Erro ao fazer upload da imagem.");
        }
        const imageData = (await imageResponse.json()) as { imageUrl: string };
        data.post.imageUrl = imageData.imageUrl;
      }
      
      setPosts((current) => [data.post, ...current]);
      setImagePreview(null);
      setQuotedPost(null);
    } catch (error) {
      if (postId) {
        // If post was created but image upload failed, delete the post
        await fetch(`/api/feed/${postId}`, { method: "DELETE" });
      }
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Imagem muito grande. Máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
  };

  const quotePost = (post: FeedPost) => {
    setQuotedPost(post);
  };

  const cancelQuote = () => {
    setQuotedPost(null);
  };

  const addComment = async (postId: string, content: string) => {
    const response = await fetch(`/api/feed/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error("Não foi possível publicar o comentário.");
    const data = (await response.json()) as { comment: Comment };
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, data.comment],
              commentsCount: post.commentsCount + 1,
            }
          : post
      )
    );
  };

  const togglePostState = async (postId: string, kind: "reaction" | "bookmark") => {
    const response = await fetch(`/api/feed/${postId}/${kind}`, { method: "POST" });
    if (!response.ok) throw new Error("Não foi possível atualizar sua ação.");
    const data = (await response.json()) as { liked?: boolean; saved?: boolean };
    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post;
        if (kind === "reaction" && data.liked !== undefined) {
          return { ...post, liked: data.liked, likes: post.likes + (data.liked ? 1 : -1) };
        }
        return data.saved === undefined ? post : { ...post, saved: data.saved };
      })
    );
  };

  const moderatePost = async (post: FeedPost) => {
    const action = window.prompt(
      post.isOwner
        ? "Digite EXCLUIR para remover esta publicação."
        : "Digite DENUNCIAR para denunciar ou BLOQUEAR para bloquear o autor."
    )?.trim().toUpperCase();
    if (!action) return;
    if (post.isOwner && action === "EXCLUIR") {
      const response = await fetch(`/api/feed/${post.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Não foi possível excluir a publicação.");
      setPosts((current) => current.filter((item) => item.id !== post.id));
      return;
    }
    if (!post.isOwner && action === "DENUNCIAR") {
      const response = await fetch("/api/moderation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "POST", targetId: post.id, reason: "OTHER" }),
      });
      if (!response.ok) throw new Error("Não foi possível registrar a denúncia.");
      return;
    }
    if (!post.isOwner && action === "BLOQUEAR") {
      const response = await fetch("/api/moderation/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: post.authorId }),
      });
      if (!response.ok) throw new Error("Não foi possível bloquear o leitor.");
      setPosts((current) => current.filter((item) => item.authorId !== post.authorId));
    }
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 pb-28 text-on-surface">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Comunidade Scanteca
            </p>
            <h1 className="font-headline-lg-mobile text-3xl font-medium tracking-tight">
              Feed de leitores
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Leituras, descobertas e conversas que merecem continuar.
            </p>
          </div>
          <span className="hidden rounded-full border border-primary/20 bg-primary-container/20 px-3 py-1 text-xs text-primary sm:inline-flex">
            ✨ ao vivo
          </span>
        </header>

        <section className="mb-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
              {user?.imageUrl ? (
                <Image src={user.imageUrl} alt="" width={40} height={40} className="h-full w-full rounded-full object-cover" />
              ) : (
                "VC"
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">Compartilhe com a rede</p>
              <p className="text-xs text-on-surface-variant">
                Uma ideia, uma citação ou o avanço da sua leitura.
              </p>
            </div>
          </div>
          
          {imagePreview && (
            <div className="mb-3 relative">
              <div className="relative h-48 w-full overflow-hidden rounded-xl border border-outline-variant/30">
                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={uploadingImage}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-50"
                  aria-label="Remover imagem"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-container/20 disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              Adicionar imagem
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          <TextComposer
            placeholder="O que você está lendo ou pensando? 📖"
            submitLabel={uploadingImage ? "Enviando..." : "Publicar"}
            onSubmit={addPost}
            disabled={uploadingImage}
            quotedPost={quotedPost ? { author: quotedPost.author, text: quotedPost.text } : null}
            onCancelQuote={cancelQuote}
          />
        </section>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline-md text-xl">Da sua rede</h2>
          <button type="button" className="text-xs font-medium text-primary hover:underline">
            Mais recentes
          </button>
        </div>

        <div className="space-y-5">
          {loading && <p className="py-8 text-center text-sm text-on-surface-variant">Carregando a rede... 📚</p>}
          {error && <p className="rounded-xl border border-error/30 bg-error-container/20 p-4 text-sm text-error">{error}</p>}
          {!loading && !error && posts.length === 0 && (
            <p className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
              Ainda não há publicações. Seja o primeiro a compartilhar uma leitura! ✨
            </p>
          )}
          {posts.map((post) => {
            const isLiked = post.liked;
            const isSaved = post.saved;
            const commentsVisible = openComments[post.id] ?? false;
            return (
              <article
                key={post.id}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/90 p-4 shadow-lg sm:p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/40 bg-surface-container-high text-xs font-semibold text-primary">
                      {post.avatarUrl ? (
                        <Image src={post.avatarUrl} alt={`Foto de ${post.author}`} width={44} height={44} className="h-full w-full object-cover" />
                      ) : (
                        post.initials
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{post.author}</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        {post.time} · {post.label}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={() => void moderatePost(post)} aria-label="Mais opções" className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </div>

                <p className="my-4 text-sm leading-6 text-on-surface">{post.text}</p>

                {post.quotedPost && (
                  <div className="mb-4 rounded-xl border-l-4 border-primary bg-surface-container-low px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Quote className="h-3 w-3 text-primary" />
                      <span className="text-xs font-semibold text-primary">{post.quotedPost.author}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant line-clamp-3">{post.quotedPost.text}</p>
                  </div>
                )}

                {post.imageUrl && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-outline-variant/20">
                    <div 
                      className="relative h-96 w-full cursor-pointer"
                      onClick={() => {
                        setLightboxImage(post.imageUrl || null);
                        setLightboxOpen(true);
                      }}
                    >
                      <Image 
                        src={post.imageUrl} 
                        alt="Imagem do post" 
                        fill 
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                  </div>
                )}

                {post.book && (
                  <div className="mb-4 flex gap-3 rounded-xl border border-outline-variant/20 bg-surface-container p-3">
                    {post.book.cover ? (
                      <Image src={post.book.cover} alt={`Capa de ${post.book.title}`} width={56} height={80} className="h-20 w-14 rounded object-cover" />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded bg-surface-container-high text-xl">📖</div>
                    )}
                    <div className="flex min-w-0 flex-col justify-center">
                      <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Livro em destaque
                      </span>
                      <h3 className="font-display text-lg">{post.book.title}</h3>
                      <p className="text-xs text-on-surface-variant">{post.book.author}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void togglePostState(post.id, "reaction")}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${isLiked ? "bg-error-container/20 text-error" : "text-on-surface-variant hover:bg-surface-container hover:text-error"}`}
                    >
                      <span>{isLiked ? "❤️" : "🤍"}</span>
                      {post.likes}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenComments((current) => ({ ...current, [post.id]: !commentsVisible }))}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-on-surface-variant hover:bg-primary-container/20 hover:text-primary"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {post.commentsCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePostState(post.id, "bookmark")}
                      aria-label={isSaved ? "Remover dos salvos" : "Salvar post"}
                      className={`rounded-full p-2 transition ${isSaved ? "text-secondary" : "text-on-surface-variant hover:text-secondary"}`}
                    >
                      <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => quotePost(post)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-primary hover:bg-primary-container/20"
                  >
                    <Quote className="h-4 w-4" />
                    Citar
                  </button>
                </div>

                {commentsVisible && (
                  <div className="mt-3 space-y-3 border-t border-outline-variant/15 pt-3">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2 text-xs">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-container/40 font-semibold text-primary">
                          {comment.author.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="rounded-xl bg-surface-container px-3 py-2">
                          <span className="mr-1 font-semibold text-primary">{comment.author}</span>
                          {comment.content}
                        </p>
                      </div>
                    ))}
                    <TextComposer
                      compact
                      placeholder="Comente com respeito e curiosidade... 💬"
                      submitLabel="Enviar"
                      onSubmit={(content) => addComment(post.id, content)}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
          <Send className="h-3.5 w-3.5 text-primary" />
          O feed social é o primeiro passo do roadmap da comunidade.
        </div>
      </div>

      {lightboxOpen && lightboxImage && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: lightboxImage }]}
        />
      )}
    </main>
  );
}
