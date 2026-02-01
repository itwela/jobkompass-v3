'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ExternalLink, Trash2, X, LogIn, Filter, Tag, CheckCircle2, Circle, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { BlurFade } from "@/components/ui/blur-fade";
import { useResources } from "@/providers/jkResourcesProvider";
import JkGap from "../jkGap";
import JkConfirmDelete from "../jkConfirmDelete";

interface Resource {
  _id: Id<"resources">;
  type: string;
  title: string;
  url: string;
  description?: string;
  notes?: string;
  tags?: string[];
  category?: string;
  createdAt: number;
  updatedAt: number;
}

// Classic sticky note color
const stickyNoteColor = {
  bg: '#FFD180', // orange sticky note (light orange)
  border: '#FFA726', // deeper orange for border
  shadow: 'rgba(255, 152, 0, 0.3)', // soft orange shadow
};

// Predefined categories with job status colors
const CATEGORIES = [
  { value: 'job-board', label: 'Job Board', color: '#DBEAFE', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200', emoji: '💼' }, // Interested
  { value: 'job', label: 'Job', color: '#FEF3C7', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200', emoji: '👨‍💻' }, // Applied
  { value: 'company', label: 'Company', color: '#F3E8FF', bgColor: 'bg-purple-100', textColor: 'text-purple-800', borderColor: 'border-purple-200', emoji: '🏢' }, // Interviewing
  { value: 'networking', label: 'Networking', color: '#D1FAE5', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200', emoji: '🤝' }, // Offered
  { value: 'learning', label: 'Learning', color: '#FEE2E2', bgColor: 'bg-red-100', textColor: 'text-red-800', borderColor: 'border-red-200', emoji: '📚' }, // Rejected
  { value: 'tools', label: 'Tools', color: '#DBEAFE', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200', emoji: '🔧' }, // Interested
  { value: 'other', label: 'Other', color: '#FEF3C7', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200', emoji: '📌' }, // Applied
] as const;

// Format date in plain English
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // Less than a minute
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  
  // More than a week - show actual date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  });
};

function StickyNote({
  resource,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  index,
  selectionMode,
  isSelected,
  onToggleSelection,
}: {
  resource: Resource;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (data: { title: string; url: string; description?: string; category?: string }) => void;
  onCancel: () => void;
  onDelete: () => void;
  index: number;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  const [title, setTitle] = useState(resource.title);
  const [url, setUrl] = useState(resource.url);
  const [description, setDescription] = useState(resource.description || '');
  const [category, setCategory] = useState(resource.category || '');
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const colors = stickyNoteColor;

  const handleNoteClick = () => {
    if (selectionMode) {
      onToggleSelection();
    } else if (!isEditing) {
      onStartEdit();
    }
  };

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setTitle(resource.title);
    setUrl(resource.url);
    setDescription(resource.description || '');
    setCategory(resource.category || '');
    setShowDeleteConfirm(false);
  }, [resource]);

  useEffect(() => {
    if (!isEditing) {
      setShowDeleteConfirm(false);
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave({ title, url, description, category: category || undefined });
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
      initial={{ opacity: 1, scale: 1, rotate: -2 + (index % 3) * 2 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        rotate: isEditing ? 0 : -2 + (index % 3) * 2,
      }}
      exit={{ opacity: 0, scale: 0.8, rotate: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      whileHover={!isEditing ? { 
        scale: 1.05, 
        rotate: 0,
        zIndex: 10,
      } : {}}
      className="relative h-full"
    >
      <div
        className={`relative flex h-full min-h-[200px] max-h-[400px] flex-col rounded-tl-xl rounded-br-xl rounded-bl-xl p-5 cursor-pointer transition-transform duration-200 ${
          selectionMode && isSelected ? "outline outline-2 outline-blue-400 shadow-[0_0_0_4px_rgba(37,99,235,0.15)]" : ""
        }`}
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: isEditing 
            ? `0 8px 24px ${colors.shadow}, 0 4px 8px rgba(0,0,0,0.15)`
            : `0 4px 12px ${colors.shadow}, 0 2px 4px rgba(0,0,0,0.1)`,
          transform: `rotate(${isEditing ? 0 : -2 + (index % 3) * 2}deg)`,
        }}
        onClick={handleNoteClick}
      >
        {/* Sticky note fold effect */}
        <div 
          className="absolute top-0 right-0 w-0 h-0s"
          style={{
            borderTop: `24px solid ${colors.border}`,
            borderLeft: '24px solid transparent',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
          }}
        />

        {selectionMode && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelection();
            }}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-black/70 shadow-sm transition-colors hover:text-blue-600"
            aria-pressed={isSelected}
          >
            {isSelected ? (
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
        )}

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
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes..."
              className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-black/30 min-h-[100px] max-h-[180px] overflow-y-auto no-scrollbar break-words"
              rows={4}
            />
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'url')}
              placeholder="https://..."
              className="w-full text-xs bg-transparent border-none outline-none placeholder:text-black/30 underline break-all"
            />
            
            {/* Category Selector */}
            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-black/70 mb-2">
                <Tag className="h-3 w-3" />
                Category (optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategory(category === cat.value ? '' : cat.value);
                    }}
                    className={`text-xs px-2 py-1 rounded transition-all flex items-center justify-center gap-1 ${
                      category === cat.value
                        ? 'bg-black/20 font-semibold shadow-sm'
                        : 'bg-black/5 hover:bg-black/10'
                    }`}
                    style={
                      category === cat.value
                        ? { borderLeft: `3px solid ${cat.color}` }
                        : {}
                    }
                    aria-label={cat.label}
                  >
                    <span>{cat.emoji}</span>
                    {category === cat.value && (
                      <span>{cat.label}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              {showDeleteConfirm ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <JkConfirmDelete
                    onConfirm={() => {
                      if (isDeleting) return;
                      setIsDeleting(true);
                      Promise.resolve(onDelete())
                        .finally(() => {
                          setIsDeleting(false);
                          setShowDeleteConfirm(false);
                        });
                    }}
                    onCancel={() => {
                      setShowDeleteConfirm(false);
                    }}
                    isLoading={isDeleting}
                  />
                </div>
              ) : (
                <div className="flex gap-2">
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
                      setShowDeleteConfirm(true);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-red-200 hover:bg-red-300 rounded transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            <div className="space-y-2 flex-1 min-h-0 overflow-hidden">
              {/* Category Badge */}
              {resource.category && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORIES.find(c => c.value === resource.category)?.bgColor || 'bg-gray-100'} ${CATEGORIES.find(c => c.value === resource.category)?.textColor || 'text-gray-800'}`}
                  >
                    {CATEGORIES.find(c => c.value === resource.category)?.emoji}{' '}
                    {CATEGORIES.find(c => c.value === resource.category)?.label}
                  </span>
                </div>
              )}
              
              {resource.title ? (
                <h3 className="font-semibold text-lg leading-tight line-clamp-2 break-words">{resource.title}</h3>
              ) : (
                <h3 className="font-semibold text-lg leading-tight text-black/30 italic">Untitled</h3>
              )}
              {resource.url && (
                <div className="space-y-1">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm underline text-blue-800 hover:text-blue-900 flex items-center gap-1"
                  >
                    Visit <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                  <p className="text-xs text-black/50 break-all line-clamp-2">{resource.url}</p>
                </div>
              )}
              {resource.description && (
                <div
                  className={`overflow-y-auto no-scrollbar pr-2 ${
                    isEditing ? "max-h-[210px]" : "max-h-[180px]"
                  }`}
                >
                  <p className="text-sm text-black/70 leading-relaxed whitespace-pre-wrap break-words">{resource.description}</p>
                </div>
              )}
              {!resource.title && !resource.url && !resource.description && (
                <p className="text-sm text-black/30 italic">Click to edit...</p>
              )}
            </div>
            <div className="mt-auto pt-3 border-t border-black/10 flex-shrink-0">
              <p className="text-xs text-black/50 truncate">
                Last edited {formatDate(resource.updatedAt)}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function JkCW_ResourcesMode() {
  const { 
    allResources, 
    filteredResources, 
    existingCategories,
    editingId, 
    setEditingId,
    error, 
    setError,
    selectedCategory, 
    setSelectedCategory,
    handleAddNew,
    handleSave,
    handleDelete,
    handleBulkDelete,
    toggleResourceSelection,
    selectAllResources,
    clearResourceSelection,
    selectedResourceIds,
    selectionMode,
    setSelectionMode,
    isAuthenticated,
    authLoading,
    user,
    searchQuery,
    setSearchQuery,
  } = useResources();
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    if (!selectionMode) {
      setShowBulkDeleteConfirm(false);
      setIsBulkDeleting(false);
    }
  }, [selectionMode]);

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setEditingId(null);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    clearResourceSelection();
  };

  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await handleBulkDelete();
      setShowBulkDeleteConfirm(false);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

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
                window.dispatchEvent(new CustomEvent('jk:openSignIn'));
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Links & Resources</h1>
            <p className="text-muted-foreground mt-1">Organize your job boards and resources</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => { void handleAddNew(); }}
              className="gap-2 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"
              disabled={selectionMode}
            >
              <Plus className="h-4 w-4" />
              New Note
            </Button>
            {!selectionMode ? (
              <Button variant="outline" onClick={handleEnterSelectionMode}>
                Multi-select
              </Button>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedResourceIds.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllResources(filteredResources.map((resource) => resource._id))}
                  disabled={filteredResources.length === 0 || selectedResourceIds.length === filteredResources.length}
                >
                  Select All
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (selectedResourceIds.length === 0) return;
                    setShowBulkDeleteConfirm(true);
                  }}
                  disabled={selectedResourceIds.length === 0}
                >
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExitSelectionMode}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search notes by title, URL, description, tags..."
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {selectionMode && showBulkDeleteConfirm && (
          <div className="mb-4 max-w-xl">
            <JkConfirmDelete
              message={`Delete ${selectedResourceIds.length} selected note${selectedResourceIds.length === 1 ? '' : 's'}?`}
              onConfirm={handleConfirmBulkDelete}
              onCancel={() => setShowBulkDeleteConfirm(false)}
              isLoading={isBulkDeleting}
            />
          </div>
        )}

        {/* Category Filter Bar */}
        {existingCategories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-2 flex-wrap"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filter:
            </div>
            <Button
              variant={selectedCategory === null ? "outline" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={`gap-2 ${selectedCategory === null ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100' : ''}`}
            >
              All ({allResources.length})
            </Button>
            {CATEGORIES.filter(cat => existingCategories.includes(cat.value)).map((category) => {
              const count = allResources.filter(r => r.category === category.value).length;
              return (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.value)}
                  className="gap-2"
                  style={
                    selectedCategory === category.value
                      ? {
                          backgroundColor: category.color,
                          borderColor: category.color,
                          color: category.value === 'job-board' || category.value === 'tools' ? '#1E40AF' // blue-800
                            : category.value === 'job' || category.value === 'other' ? '#92400E' // yellow-800
                            : category.value === 'company' ? '#6B21A8' // purple-800
                            : category.value === 'networking' ? '#065F46' // green-800
                            : category.value === 'learning' ? '#991B1B' // red-800
                            : '#1E40AF',
                        }
                      : {}
                  }
                >
                  <span>{category.emoji}</span>
                  {category.label} ({count})
                </Button>
              );
            })}
          </motion.div>
        )}

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
            {filteredResources.map((resource, index) => (
              <BlurFade key={resource._id} delay={0.0618 + index * 0.05} inView>
              <StickyNote
                resource={resource}
                isEditing={editingId === resource._id}
                onStartEdit={() => {
                  if (selectionMode) return;
                  setEditingId(resource._id);
                }}
                onSave={(data) => handleSave(resource._id, data)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(resource._id)}
                index={index}
                selectionMode={selectionMode}
                isSelected={selectedResourceIds.includes(resource._id)}
                onToggleSelection={() => toggleResourceSelection(resource._id)}
              />
              </BlurFade>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredResources.length === 0 && allResources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[40vh] text-center"
          >
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-semibold mb-2">No notes match these filters</h2>
            <p className="text-muted-foreground mb-6">
              Try selecting a different category, clearing search, or create a new note
            </p>
            <Button onClick={() => setSelectedCategory(null)} variant="outline">
              Reset Filters
            </Button>
          </motion.div>
        )}
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
            <Button onClick={handleAddNew} size="lg" className="gap-2 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
              <Plus className="h-4 w-4" />
              Create Your First Note
            </Button>
          </motion.div>
        )}

        <JkGap  />
      </div>
    </div>
  );
}


