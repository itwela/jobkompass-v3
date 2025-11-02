'use client'

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Trash2, X, LogIn } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/providers/jkAuthProvider";

interface Resource {
  _id: Id<"resources">;
  type: string;
  category: string;
  title: string;
  url: string;
  description?: string;
  notes?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

const categoryColors = {
  applied: {
    bg: '#FFFC9B', // bright yellow
    border: '#F4E365',
    shadow: 'rgba(244, 227, 101, 0.4)',
  },
  considering: {
    bg: '#FFB3BA', // pink
    border: '#FF8A95',
    shadow: 'rgba(255, 138, 149, 0.4)',
  },
  networking: {
    bg: '#BAE1FF', // light blue
    border: '#7FB8DA',
    shadow: 'rgba(127, 184, 218, 0.4)',
  },
};

export default function JkCW_ResourcesMode() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const resources = useQuery(api.resources.list, isAuthenticated ? {} : "skip");
  const addResource = useMutation(api.resources.add);
  const updateResource = useMutation(api.resources.update);
  const deleteResource = useMutation(api.resources.remove);

  const [editingId, setEditingId] = useState<Id<"resources"> | null>(null);
  const [newNoteCategory, setNewNoteCategory] = useState<'applied' | 'considering' | 'networking'>('considering');
  const [error, setError] = useState<string | null>(null);

  console.log("Resources mode - Auth state:", { isAuthenticated, authLoading, user, resources });

  if (authLoading || resources === undefined) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const allResources = resources || [];
  
  const handleAddNew = async () => {
    if (!isAuthenticated) {
      setError('Please sign in to add notes');
      return;
    }
    
    try {
      setError(null);
      const newId = await addResource({
        type: 'job_board',
        category: newNoteCategory,
        title: '',
        url: '',
        description: '',
      });
      setEditingId(newId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note. Please sign in.');
    }
  };

  const handleSave = async (id: Id<"resources">, data: { title: string; url: string; description?: string; category: string }) => {
    try {
      setError(null);
      if (!data.title.trim() && !data.url.trim()) {
        // If empty, delete it
        await deleteResource({ id });
        setEditingId(null);
        return;
      }
      await updateResource({ id, ...data, type: 'job_board' });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note. Please try again.');
    }
  };

  const handleDelete = async (id: Id<"resources">) => {
    try {
      setError(null);
      await deleteResource({ id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note. Please try again.');
    }
  };

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-semibold mb-2">Sign in required</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Please sign in to create and manage your resource notes. Click the JobKompass icon in the sidebar to sign in.
            </p>
            <Button 
              onClick={() => {
                const trigger = document.querySelector('button[aria-haspopup]') as HTMLButtonElement;
                trigger?.click();
              }} 
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              Open Sign In
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Links & Resources</h1>
            <p className="text-muted-foreground mt-1">Organize your job boards and resources</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={newNoteCategory}
              onChange={(e) => setNewNoteCategory(e.target.value as any)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              <option value="applied">Applied</option>
              <option value="considering">Considering</option>
              <option value="networking">Networking</option>
            </select>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Sticky Notes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {allResources.map((resource, index) => (
              <StickyNote
                key={resource._id}
                resource={resource}
                isEditing={editingId === resource._id}
                onStartEdit={() => setEditingId(resource._id)}
                onSave={(data) => handleSave(resource._id, data)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(resource._id)}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {allResources.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-semibold mb-2">No notes yet</h2>
            <p className="text-muted-foreground mb-6">
              Click "New Note" to add your first resource
            </p>
            <Button onClick={handleAddNew} size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Note
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StickyNote({
  resource,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  index,
}: {
  resource: Resource;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (data: { title: string; url: string; description?: string; category: string }) => void;
  onCancel: () => void;
  onDelete: () => void;
  index: number;
}) {
  const [title, setTitle] = useState(resource.title);
  const [url, setUrl] = useState(resource.url);
  const [description, setDescription] = useState(resource.description || '');
  const [category, setCategory] = useState<'applied' | 'considering' | 'networking'>(resource.category as any);
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const colors = categoryColors[category];

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setTitle(resource.title);
    setUrl(resource.url);
    setDescription(resource.description || '');
    setCategory(resource.category as any);
  }, [resource]);

  const handleSave = () => {
    onSave({ title, url, description, category });
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: 'title' | 'url') => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (field === 'title' && urlRef.current) {
        urlRef.current.focus();
      } else {
        handleSave();
      }
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, rotate: -5 + Math.random() * 10 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        rotate: isEditing ? 0 : -2 + Math.random() * 4,
      }}
      exit={{ opacity: 0, scale: 0.8, rotate: -10 }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay: index * 0.03,
      }}
      whileHover={!isEditing ? { 
        scale: 1.05, 
        rotate: 0,
        zIndex: 10,
      } : {}}
      className="relative"
    >
      <div
        className="relative p-5 min-h-[200px] cursor-pointer transition-transform duration-200"
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: isEditing 
            ? `0 8px 24px ${colors.shadow}, 0 4px 8px rgba(0,0,0,0.15)`
            : `0 4px 12px ${colors.shadow}, 0 2px 4px rgba(0,0,0,0.1)`,
          transform: `rotate(${isEditing ? 0 : -2 + (index % 3) * 2}deg)`,
        }}
        onClick={!isEditing ? onStartEdit : undefined}
      >
        {/* Sticky note fold effect */}
        <div 
          className="absolute top-0 right-0 w-0 h-0"
          style={{
            borderTop: `24px solid ${colors.border}`,
            borderLeft: '24px solid transparent',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
          }}
        />

        {isEditing ? (
          <div className="space-y-3">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'title')}
              placeholder="Title..."
              className="w-full font-semibold text-lg bg-transparent border-none outline-none placeholder:text-black/30"
            />
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'url')}
              placeholder="https://..."
              className="w-full text-sm bg-transparent border-none outline-none placeholder:text-black/30 underline"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes..."
              className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-black/30 min-h-[80px]"
              rows={4}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full text-xs bg-transparent border border-black/20 rounded px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="applied">Applied</option>
              <option value="considering">Considering</option>
              <option value="networking">Networking</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-black/10 hover:bg-black/20 rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="px-3 py-1.5 text-xs font-medium bg-black/10 hover:bg-black/20 rounded transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this note?')) {
                    onDelete();
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-red-200 hover:bg-red-300 rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {resource.title ? (
              <h3 className="font-semibold text-lg leading-tight">{resource.title}</h3>
            ) : (
              <h3 className="font-semibold text-lg leading-tight text-black/30 italic">Untitled</h3>
            )}
            {resource.url && (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm underline text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {resource.description && (
              <p className="text-sm text-black/70 leading-relaxed whitespace-pre-wrap">{resource.description}</p>
            )}
            {!resource.title && !resource.url && !resource.description && (
              <p className="text-sm text-black/30 italic">Click to edit...</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
