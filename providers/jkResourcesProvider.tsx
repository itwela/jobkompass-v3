'use client'

import { createContext, useContext, ReactNode, useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/providers/jkAuthProvider";
import { Id } from "@/convex/_generated/dataModel";

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

interface ResourcesContextType {
  // Data
  resources: Resource[] | null | undefined;
  allResources: Resource[];
  filteredResources: Resource[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  existingCategories: string[];
  
  // State
  editingId: Id<"resources"> | null;
  setEditingId: (id: Id<"resources"> | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  
  // Actions
  handleAddNew: () => Promise<Id<"resources"> | null>;
  handleSave: (id: Id<"resources">, data: { 
    title: string; 
    url: string; 
    description?: string; 
    category?: string 
  }) => Promise<void>;
  handleDelete: (id: Id<"resources">) => Promise<void>;
  handleBulkDelete: (ids?: Id<"resources">[]) => Promise<void>;
  toggleResourceSelection: (id: Id<"resources">) => void;
  selectAllResources: (ids?: Id<"resources">[]) => void;
  clearResourceSelection: () => void;
  selectedResourceIds: Id<"resources">[];
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  
  // Auth
  isAuthenticated: boolean;
  authLoading: boolean;
  user: any;
}

const ResourcesContext = createContext<ResourcesContextType | undefined>(undefined);

export function JkResourcesProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const resources = useQuery(api.resources.list, isAuthenticated ? {} : "skip");
  const addResource = useMutation(api.resources.add);
  const updateResource = useMutation(api.resources.update);
  const deleteResource = useMutation(api.resources.remove);

  const [editingId, setEditingId] = useState<Id<"resources"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectionMode, setSelectionModeState] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Id<"resources">[]>([]);
  const [searchQuery, setSearchQuery] = useState("");


  // Handle the resources safely - it will be undefined when loading or an array when loaded
  // Sort by updatedAt in descending order (most recently updated first)
  const allResources = useMemo(() => {
    return (resources && Array.isArray(resources)) 
      ? [...resources].sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  }, [resources]);
  
  // Filter resources by selected category + search
  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allResources.filter((resource) => {
      const matchesCategory = selectedCategory ? resource.category === selectedCategory : true;
      if (!matchesCategory) return false;

      if (!query) return true;

      const haystacks = [
        resource.title,
        resource.url,
        resource.description,
        resource.notes,
        resource.category,
        ...(resource.tags ?? []),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return haystacks.some((value) => value.includes(query));
    });
  }, [allResources, selectedCategory, searchQuery]);

  // Get unique categories from existing resources
  const existingCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    allResources.forEach(resource => {
      if (resource.category) categoriesSet.add(resource.category);
    });
    return Array.from(categoriesSet);
  }, [allResources]);
  
  const toggleResourceSelection = useCallback((id: Id<"resources">) => {
    setSelectedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((resourceId) => resourceId !== id) : [...prev, id]
    );
  }, []);

  const selectAllResources = useCallback((ids?: Id<"resources">[]) => {
    if (ids && ids.length > 0) {
      setSelectedResourceIds(ids);
      return;
    }
    setSelectedResourceIds(allResources.map((resource) => resource._id));
  }, [allResources]);

  const clearResourceSelection = useCallback(() => {
    setSelectedResourceIds([]);
  }, []);

  const setSelectionMode = useCallback((enabled: boolean) => {
    setSelectionModeState(enabled);
    if (!enabled) {
      setSelectedResourceIds([]);
    }
  }, []);
  
  const handleAddNew = async () => {
    if (!isAuthenticated) {
      setError('Please sign in to add notes');
      return null;
    }
    
    try {
      setError(null);
      const newId = await addResource({
        type: 'resource',
        title: '',
        url: '',
        description: '',
      });
      setEditingId(newId);
      return newId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note. Please sign in.');
      return null;
    }
  };

  const handleSave = async (id: Id<"resources">, data: { 
    title: string; 
    url: string; 
    description?: string; 
    category?: string 
  }) => {
    try {
      setError(null);
      if (!data.title.trim() && !data.url.trim()) {
        // If empty, delete it
        await deleteResource({ id });
        setEditingId(null);
        return;
      }
      await updateResource({ id, ...data, type: 'resource' });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note. Please try again.');
    }
  };

  const handleDelete = async (id: Id<"resources">) => {
    try {
      setError(null);
      await deleteResource({ id });
      setSelectedResourceIds((prev) => prev.filter((resourceId) => resourceId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note. Please try again.');
    }
  };

  const handleBulkDelete = async (ids?: Id<"resources">[]) => {
    const targetIds = (ids ?? selectedResourceIds).filter(
      (resourceId): resourceId is Id<"resources"> => Boolean(resourceId)
    );
    if (targetIds.length === 0) {
      return;
    }
    try {
      setError(null);
      await Promise.all(targetIds.map((resourceId) => deleteResource({ id: resourceId })));
      setSelectedResourceIds([]);
      setSelectionModeState(false);
      if (editingId && targetIds.includes(editingId)) {
        setEditingId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete selected notes. Please try again.');
    }
  };

  const value: ResourcesContextType = {
    // Data
    resources,
    allResources,
    filteredResources,
    searchQuery,
    setSearchQuery,
    existingCategories,
    
    // State
    editingId,
    setEditingId,
    error,
    setError,
    selectedCategory,
    setSelectedCategory,
    
    // Actions
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
    
    // Auth
    isAuthenticated,
    authLoading,
    user,
  };

  return (
    <ResourcesContext.Provider value={value}>
      {children}
    </ResourcesContext.Provider>
  );
}

export function useResources() {
  const context = useContext(ResourcesContext);
  if (!context) {
    throw new Error('useResources must be used within JkResourcesProvider');
  }
  return context;
}

