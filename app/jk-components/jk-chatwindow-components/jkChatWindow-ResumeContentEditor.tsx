'use client'

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Plus, Trash2, Save, ChevronDown, ChevronUp, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type ResumeContent = {
    personalInfo: {
        firstName: string;
        lastName: string;
        email: string;
        location?: string;
        linkedin?: string;
        github?: string;
        portfolio?: string;
        citizenship?: string;
    };
    experience: Array<{
        company: string;
        title: string;
        date: string;
        details?: string[];
        location?: string;
    }>;
    education: Array<{
        name: string;
        degree: string;
        field?: string;
        startDate?: string;
        endDate: string;
        location?: string;
        details?: string[];
    }>;
    skills: {
        technical: string[];
        additional?: string[];
    };
    projects?: Array<{
        name: string;
        description: string;
        technologies: string[];
        details?: string[];
        date?: string;
    }>;
    additionalInfo?: {
    languages?: Array<{
        language: string;
        proficiency: string;
    }>;
        references?: string;
    };
};

const emptyContent: ResumeContent = {
    personalInfo: {
        firstName: "",
        lastName: "",
        email: "",
        location: "",
        linkedin: "",
        github: "",
        portfolio: "",
        citizenship: "",
    },
    experience: [],
    education: [],
    skills: {
        technical: [],
        additional: [],
    },
    projects: [],
    additionalInfo: {
    languages: [],
        references: "",
    },
};

interface ResumeContentEditorProps {
    resumeId: Id<"resumes">;
    onClose: () => void;
    initialContent?: any;
    contentRef?: React.MutableRefObject<any>;
}

export default function JkCW_ResumeContentEditor({ 
    resumeId, 
    onClose, 
    initialContent,
    contentRef
}: ResumeContentEditorProps) {
    const resume = useQuery(api.documents.getResume, { resumeId });
    const updateResume = useMutation(api.documents.updateResume);
    
    const [content, setContent] = useState<ResumeContent>(emptyContent);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["personalInfo"]));
    const [hasChanges, setHasChanges] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // AI Button Component - Shows "coming soon" toast
    const AiButton = ({ position = "top-right" }: { position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right" }) => {
        const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            toast.info("AI Enhancement", {
                description: "This feature is coming soon! Stay tuned for AI-powered content enhancement.",
                duration: 3000,
                position: position,
            });
        };

        return (
            <button
                type="button"
                onClick={handleClick}
                className={cn(
                    "p-1.5 rounded-md transition-all",
                    "text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10",
                    "focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                )}
                title="Enhance with AI (Coming Soon)"
            >
                <Sparkles className="h-4 w-4" />
            </button>
        );
    };

    // Track if we've loaded initial content
    const hasLoadedRef = React.useRef(false);
    
    // Helper to decode escaped/encoded strings
    const decodeString = (str: string | undefined | null): string => {
        if (!str) return "";
        
        try {
            // First try to decode URI components (e.g., %2F -> /)
            let decoded = decodeURIComponent(str);
            
            // Then decode HTML entities and Unicode escapes
            const textarea = document.createElement('textarea');
            textarea.innerHTML = decoded;
            decoded = textarea.value;
            
            // Handle Unicode escape sequences like \u002F
            decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });
            
            return decoded;
        } catch (e) {
            // If decoding fails, return original string
            return str;
        }
    };
    
    // Helper to decode arrays of strings
    const decodeStringArray = (arr: string[] | undefined | null): string[] => {
        if (!arr || !Array.isArray(arr)) return [];
        return arr.map(s => decodeString(s));
    };
    
    // Helper to ensure all fields have default values (prevents controlled/uncontrolled input errors)
    const normalizeContent = (loadedContent: any): ResumeContent => {
        // If content is a JSON string, parse it first
        let parsedContent = loadedContent;
        if (typeof loadedContent === 'string') {
            try {
                parsedContent = JSON.parse(loadedContent);
            } catch (e) {
                console.error('Failed to parse content:', e);
                parsedContent = {};
            }
        }
        
        // Normalize and decode experience entries
        const normalizedExperience = (parsedContent?.experience || []).map((exp: any) => ({
            company: decodeString(exp?.company),
            title: decodeString(exp?.title),
            date: decodeString(exp?.date),
            details: decodeStringArray(exp?.details),
            location: decodeString(exp?.location),
        }));
        
        // Normalize and decode education entries
        const normalizedEducation = (parsedContent?.education || []).map((edu: any) => ({
            name: decodeString(edu?.name),
            degree: decodeString(edu?.degree),
            field: decodeString(edu?.field),
            startDate: decodeString(edu?.startDate),
            endDate: decodeString(edu?.endDate),
            location: decodeString(edu?.location),
            details: decodeStringArray(edu?.details),
        }));
        
        // Normalize and decode projects
        const normalizedProjects = (parsedContent?.projects || []).map((proj: any) => ({
            name: decodeString(proj?.name),
            description: decodeString(proj?.description),
            date: decodeString(proj?.date),
            technologies: decodeStringArray(proj?.technologies),
            details: decodeStringArray(proj?.details),
        }));
        
        return {
            personalInfo: {
                firstName: decodeString(parsedContent?.personalInfo?.firstName),
                lastName: decodeString(parsedContent?.personalInfo?.lastName),
                email: decodeString(parsedContent?.personalInfo?.email),
                location: decodeString(parsedContent?.personalInfo?.location),
                linkedin: decodeString(parsedContent?.personalInfo?.linkedin),
                github: decodeString(parsedContent?.personalInfo?.github),
                portfolio: decodeString(parsedContent?.personalInfo?.portfolio),
                citizenship: decodeString(parsedContent?.personalInfo?.citizenship),
            },
            experience: normalizedExperience,
            education: normalizedEducation,
            skills: {
                technical: decodeStringArray(parsedContent?.skills?.technical),
                additional: decodeStringArray(parsedContent?.skills?.additional),
            },
            projects: normalizedProjects,
            additionalInfo: {
                languages: (parsedContent?.additionalInfo?.languages || []).map((lang: any) => ({
                    language: decodeString(lang?.language),
                    proficiency: decodeString(lang?.proficiency),
                })),
                references: decodeString(parsedContent?.additionalInfo?.references),
            },
        };
    };
    
    // Reset hasLoadedRef when resumeId changes
    useEffect(() => {
        hasLoadedRef.current = false;
    }, [resumeId]);
    
    // Load initial content only ONCE per resume
    useEffect(() => {
        if (hasLoadedRef.current) return;
        
        if (initialContent) {
            setContent(normalizeContent(initialContent));
            hasLoadedRef.current = true;
        } else if (resume?.content) {
            setContent(normalizeContent(resume.content));
            hasLoadedRef.current = true;
        }
    }, [resume, initialContent]);

    // Keep the ref updated with current content (no state changes, just ref)
    useEffect(() => {
        if (contentRef) {
            contentRef.current = content;
        }
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    // Search functionality - expand sections that contain matching content
    // Using a ref to access content without adding it as a dependency
    const contentForSearch = React.useRef(content);
    contentForSearch.current = content;
    
    const handleSearch = React.useCallback((query: string) => {
        if (!query.trim()) return;
        
        const q = query.toLowerCase();
        const sectionsToExpand = new Set<string>();
        const c = contentForSearch.current;
        
        // Check each section
        if (JSON.stringify(c.personalInfo).toLowerCase().includes(q)) sectionsToExpand.add("personalInfo");
        if (JSON.stringify(c.experience).toLowerCase().includes(q)) sectionsToExpand.add("experience");
        if (JSON.stringify(c.education).toLowerCase().includes(q)) sectionsToExpand.add("education");
        if (JSON.stringify(c.skills).toLowerCase().includes(q)) sectionsToExpand.add("skills");
        if (JSON.stringify(c.projects).toLowerCase().includes(q)) sectionsToExpand.add("projects");
        if (JSON.stringify(c.additionalInfo).toLowerCase().includes(q)) sectionsToExpand.add("additionalInfo");
        
        setExpandedSections(sectionsToExpand);
    }, []);

    // Only run search when searchQuery changes (not on content changes)
    useEffect(() => {
        if (searchQuery.trim()) {
            handleSearch(searchQuery);
        }
    }, [searchQuery, handleSearch]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateResume({
                resumeId,
                content,
            });
            setHasChanges(false);
        } catch (error) {
            console.error("Failed to save resume:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const updatePersonalInfo = (field: keyof ResumeContent['personalInfo'], value: string) => {
        setContent(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, [field]: value }
        }));
        setHasChanges(true);
    };

    const updateAdditionalInfo = (field: keyof NonNullable<ResumeContent['additionalInfo']>, value: any) => {
        setContent(prev => ({
            ...prev,
            additionalInfo: { ...prev.additionalInfo, [field]: value }
        }));
        setHasChanges(true);
    };

    const addExperience = () => {
        setContent(prev => ({
            ...prev,
            experience: [...prev.experience, {
                company: "",
                title: "",
                date: "",
                details: [],
                location: "",
            }]
        }));
        setHasChanges(true);
    };

    const updateExperience = (index: number, field: string, value: any) => {
        setContent(prev => ({
            ...prev,
            experience: prev.experience.map((exp, i) => 
                i === index ? { ...exp, [field]: value } : exp
            )
        }));
        setHasChanges(true);
    };

    const removeExperience = (index: number) => {
        setContent(prev => ({
            ...prev,
            experience: prev.experience.filter((_, i) => i !== index)
        }));
        setHasChanges(true);
    };

    const addEducation = () => {
        setContent(prev => ({
            ...prev,
            education: [...prev.education, {
                name: "",
                degree: "",
                field: "",
                startDate: "",
                endDate: "",
                location: "",
                details: [],
            }]
        }));
        setHasChanges(true);
    };

    const updateEducation = (index: number, field: string, value: any) => {
        setContent(prev => ({
            ...prev,
            education: prev.education.map((edu, i) => 
                i === index ? { ...edu, [field]: value } : edu
            )
        }));
        setHasChanges(true);
    };

    const removeEducation = (index: number) => {
        setContent(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== index)
        }));
        setHasChanges(true);
    };

    const updateTechnicalSkills = (value: string) => {
        setContent(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                technical: value.split(',').map(s => s.trim()).filter(Boolean)
            }
        }));
        setHasChanges(true);
    };

    const updateAdditionalSkills = (value: string) => {
        setContent(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                additional: value.split(',').map(s => s.trim()).filter(Boolean)
            }
        }));
        setHasChanges(true);
    };

    const addProject = () => {
        setContent(prev => ({
            ...prev,
            projects: [...(prev.projects || []), {
                name: "",
                description: "",
                technologies: [],
                details: [],
                date: "",
            }]
        }));
        setHasChanges(true);
    };

    const addLanguage = () => {
        setContent(prev => ({
            ...prev,
            additionalInfo: {
                ...(prev.additionalInfo || {}),
                languages: [...(prev.additionalInfo?.languages || []), {
                    language: "",
                    proficiency: "",
                }]
            }
        }));
        setHasChanges(true);
    };

    const updateLanguage = (index: number, field: string, value: any) => {
        setContent(prev => ({
            ...prev,
            additionalInfo: {
                ...(prev.additionalInfo || {}),
                languages: (prev.additionalInfo?.languages || []).map((lang, i) => 
                    i === index ? { ...lang, [field]: value } : lang
                )
            }
        }));
        setHasChanges(true);
    };

    const removeLanguage = (index: number) => {
        setContent(prev => ({
            ...prev,
            additionalInfo: {
                ...(prev.additionalInfo || {}),
                languages: (prev.additionalInfo?.languages || []).filter((_, i) => i !== index)
            }
        }));
        setHasChanges(true);
    };

    const updateProject = (index: number, field: string, value: any) => {
        setContent(prev => ({
            ...prev,
            projects: (prev.projects || []).map((proj, i) => 
                i === index ? { ...proj, [field]: value } : proj
            )
        }));
        setHasChanges(true);
    };

    const removeProject = (index: number) => {
        setContent(prev => ({
            ...prev,
            projects: (prev.projects || []).filter((_, i) => i !== index)
        }));
        setHasChanges(true);
    };

    return (
        <div className="flex flex-col bg-background max-h-[85vh]">
            {/* Search and Template bar */}
            <div className="flex items-center gap-4 p-4 border-b bg-muted/20 justify-between">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search resume content..."
                        className="pl-9"
                    />
                </div>
                {resume?.template && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Template:</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
                            {resume.template}
                        </span>
                    </div>
                )}
            </div>

            {/* Content - Centered and Contained */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Personal Info Section */}
                <div className="border rounded-lg">
                    <button
                        onClick={() => toggleSection("personalInfo")}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                        <h3 className="text-lg font-semibold">Personal Information</h3>
                        {expandedSections.has("personalInfo") ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                    {expandedSections.has("personalInfo") && (
                        <div className="p-4 space-y-3 border-t">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">First Name</label>
                                    </div>
                                    <Input
                                        value={content.personalInfo.firstName}
                                        onChange={(e) => updatePersonalInfo("firstName", e.target.value)}
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Last Name</label>
                                    </div>
                                    <Input
                                        value={content.personalInfo.lastName}
                                        onChange={(e) => updatePersonalInfo("lastName", e.target.value)}
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Email</label>
                                <Input
                                    type="email"
                                    value={content.personalInfo.email}
                                    onChange={(e) => updatePersonalInfo("email", e.target.value)}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Location</label>
                                <Input
                                    value={content.personalInfo.location || ""}
                                    onChange={(e) => updatePersonalInfo("location", e.target.value)}
                                    placeholder="San Francisco, CA"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">LinkedIn</label>
                                <Input
                                    value={content.personalInfo.linkedin || ""}
                                    onChange={(e) => updatePersonalInfo("linkedin", e.target.value)}
                                    placeholder="linkedin.com/in/johndoe"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">GitHub</label>
                                <Input
                                    value={content.personalInfo.github || ""}
                                    onChange={(e) => updatePersonalInfo("github", e.target.value)}
                                    placeholder="github.com/johndoe"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Portfolio</label>
                                <Input
                                    value={content.personalInfo.portfolio || ""}
                                    onChange={(e) => updatePersonalInfo("portfolio", e.target.value)}
                                    placeholder="johndoe.com"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Citizenship</label>
                                <Input
                                    value={content.personalInfo.citizenship || ""}
                                    onChange={(e) => updatePersonalInfo("citizenship", e.target.value)}
                                    placeholder="US Citizen"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Experience Section */}
                <div className="border rounded-lg">
                    <button
                        onClick={() => toggleSection("experience")}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                        <h3 className="text-lg font-semibold">Work Experience</h3>
                        {expandedSections.has("experience") ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                    {expandedSections.has("experience") && (
                        <div className="p-4 space-y-4 border-t">
                            {content.experience.map((exp, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Experience #{index + 1}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeExperience(index)}
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Company</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={exp.company}
                                            onChange={(e) => updateExperience(index, "company", e.target.value)}
                                            placeholder="Acme Corp"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Title</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={exp.title}
                                            onChange={(e) => updateExperience(index, "title", e.target.value)}
                                            placeholder="Senior Software Engineer"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Date</label>
                                        <Input
                                            value={exp.date}
                                            onChange={(e) => updateExperience(index, "date", e.target.value)}
                                            placeholder="Jan 2020 - Present"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Location</label>
                                        <Input
                                            value={exp.location || ""}
                                            onChange={(e) => updateExperience(index, "location", e.target.value)}
                                            placeholder="San Francisco, CA"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Details (one per line)</label>
                                            <AiButton />
                                    </div>
                                        <Textarea
                                            value={exp.details?.join("\n") || ""}
                                            onChange={(e) => updateExperience(index, "details", 
                                                e.target.value.split('\n').filter(Boolean)
                                            )}
                                            placeholder="Built internal AI platform used by 3 managers...&#10;Created APIs granting agents instant access..."
                                            rows={5}
                                            showBorder
                                        />
                                    </div>
                                </div>
                            ))}
                            <Button
                                onClick={addExperience}
                                variant="outline"
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Experience
                            </Button>
                        </div>
                    )}
                </div>

                {/* Education Section */}
                <div className="border rounded-lg">
                    <button
                        onClick={() => toggleSection("education")}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                        <h3 className="text-lg font-semibold">Education</h3>
                        {expandedSections.has("education") ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                    {expandedSections.has("education") && (
                        <div className="p-4 space-y-4 border-t">
                            {content.education.map((edu, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Education #{index + 1}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeEducation(index)}
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">School Name</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={edu.name}
                                            onChange={(e) => updateEducation(index, "name", e.target.value)}
                                            placeholder="Western Governors University (WGU)"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-medium">Degree</label>
                                                <AiButton />
                                            </div>
                                            <Input
                                                value={edu.degree}
                                                onChange={(e) => updateEducation(index, "degree", e.target.value)}
                                                placeholder="B.S. in Software Engineering"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Field (optional)</label>
                                            <Input
                                                value={edu.field || ""}
                                                onChange={(e) => updateEducation(index, "field", e.target.value)}
                                                placeholder="Computer Science"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm font-medium">Start Date (optional)</label>
                                            <Input
                                                value={edu.startDate || ""}
                                                onChange={(e) => updateEducation(index, "startDate", e.target.value)}
                                                placeholder="August 2022"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">End Date</label>
                                            <Input
                                                value={edu.endDate}
                                                onChange={(e) => updateEducation(index, "endDate", e.target.value)}
                                                placeholder="December 2026 (Estimated)"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Location</label>
                                        <Input
                                            value={edu.location || ""}
                                            onChange={(e) => updateEducation(index, "location", e.target.value)}
                                            placeholder="Salt Lake City, UT"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Details (one per line)</label>
                                        <Textarea
                                            value={edu.details?.join("\n") || ""}
                                            onChange={(e) => updateEducation(index, "details", 
                                                e.target.value.split('\n').filter(Boolean)
                                            )}
                                            placeholder="Relevant coursework: Data Structures & Algorithms; Python...&#10;Dean's List, GPA: 3.8"
                                            rows={3}
                                            showBorder
                                        />
                                    </div>
                                </div>
                            ))}
                            <Button
                                onClick={addEducation}
                                variant="outline"
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Education
                            </Button>
                        </div>
                    )}
                </div>

                {/* Skills Section */}
                <div className="border rounded-lg">
                    <button
                        onClick={() => toggleSection("skills")}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                        <h3 className="text-lg font-semibold">Skills</h3>
                        {expandedSections.has("skills") ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                    {expandedSections.has("skills") && (
                        <div className="p-4 border-t space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium">Technical Skills (comma-separated)</label>
                                    <AiButton />
                                </div>
                            <Textarea
                                    value={content.skills.technical.join(", ")}
                                    onChange={(e) => updateTechnicalSkills(e.target.value)}
                                    placeholder="Python, JavaScript, TypeScript, React, Next.js, Node.js"
                                rows={3}
                                    showBorder
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-medium">Additional Skills (comma-separated)</label>
                                    <AiButton />
                                </div>
                                <Textarea
                                    value={content.skills.additional?.join(", ") || ""}
                                    onChange={(e) => updateAdditionalSkills(e.target.value)}
                                    placeholder="UI/UX Design, Product Development, Agile, Leadership"
                                    rows={2}
                                    showBorder
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Projects Section */}
                <div className="border rounded-lg">
                    <button
                        onClick={() => toggleSection("projects")}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                        <h3 className="text-lg font-semibold">Projects</h3>
                        {expandedSections.has("projects") ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                    {expandedSections.has("projects") && (
                        <div className="p-4 space-y-4 border-t">
                            {(content.projects || []).map((proj, index) => (
                                <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Project #{index + 1}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeProject(index)}
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-medium">Project Name</label>
                                                <AiButton />
                                            </div>
                                            <Input
                                                value={proj.name}
                                                onChange={(e) => updateProject(index, "name", e.target.value)}
                                                placeholder="Lotus — AI Wellness App"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Date (optional)</label>
                                            <Input
                                                value={proj.date || ""}
                                                onChange={(e) => updateProject(index, "date", e.target.value)}
                                                placeholder="2024"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Description</label>
                                            <AiButton />
                                        </div>
                                        <Textarea
                                            value={proj.description}
                                            onChange={(e) => updateProject(index, "description", e.target.value)}
                                            placeholder="Built an iOS wellness app currently available on the App Store..."
                                            rows={2}
                                            showBorder
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Technologies (comma-separated)</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={proj.technologies?.join(", ") || ""}
                                            onChange={(e) => updateProject(index, "technologies", 
                                                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                            )}
                                            placeholder="React Native, Replicate, OpenAI, Convex"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Details (one per line)</label>
                                            <AiButton />
                                        </div>
                                        <Textarea
                                            value={proj.details?.join("\n") || ""}
                                            onChange={(e) => updateProject(index, "details", 
                                                e.target.value.split('\n').filter(Boolean)
                                            )}
                                            placeholder="Built an API-driven agent pipeline to orchestrate LLMs...&#10;Developed a monetization and pricing strategy..."
                                            rows={4}
                                            showBorder
                                        />
                                    </div>
                                </div>
                            ))}
                            <Button
                                onClick={addProject}
                                variant="outline"
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Project
                            </Button>
                        </div>
                    )}
                </div>

                {/* Additional Info Section */}
                <div className="border rounded-lg">
                    <button
                        onClick={() => toggleSection("additionalInfo")}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                        <h3 className="text-lg font-semibold">Additional Information</h3>
                        {expandedSections.has("additionalInfo") ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </button>
                    {expandedSections.has("additionalInfo") && (
                        <div className="p-4 space-y-4 border-t">
                            {/* Languages */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold">Languages</h4>
                                {(content.additionalInfo?.languages || []).map((lang, index) => (
                                    <div key={index} className="p-3 border rounded-lg space-y-3 bg-muted/20">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Language #{index + 1}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeLanguage(index)}
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-sm font-medium">Language</label>
                                        <Input
                                                    value={lang.language}
                                                    onChange={(e) => updateLanguage(index, "language", e.target.value)}
                                                    placeholder="English"
                                        />
                                    </div>
                                    <div>
                                                <label className="text-sm font-medium">Proficiency</label>
                                        <Input
                                                    value={lang.proficiency}
                                                    onChange={(e) => updateLanguage(index, "proficiency", e.target.value)}
                                                    placeholder="Native"
                                                />
                                            </div>
                                    </div>
                                </div>
                            ))}
                            <Button
                                    onClick={addLanguage}
                                variant="outline"
                                className="w-full"
                                    size="sm"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                    Add Language
                            </Button>
                            </div>

                            {/* References */}
                            <div>
                                <label className="text-sm font-medium">References</label>
                                <Input
                                    value={content.additionalInfo?.references || ""}
                                    onChange={(e) => updateAdditionalInfo("references", e.target.value)}
                                    placeholder="Available upon request"
                                />
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
}

