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
        name: string;
        email: string;
        phone?: string;
        location?: string;
        linkedin?: string;
        github?: string;
        portfolio?: string;
        citizenship?: string;
    };
    experience: Array<{
        company: string;
        position: string;
        startDate: string;
        endDate?: string;
        achievements?: string[];
        location?: string;
    }>;
    education: Array<{
        school: string;
        degree: string;
        graduationDate: string;
        location?: string;
        relevantCoursework?: string[];
    }>;
    skills: {
        technical: string[];
        additional?: string[];
    };
    projects?: Array<{
        name: string;
        description: string;
        technologies: string[];
        highlights?: string[];
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
        name: "",
        email: "",
        phone: "",
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
    
    // Load initial content only ONCE
    useEffect(() => {
        if (hasLoadedRef.current) return;
        
        if (initialContent) {
            setContent(initialContent as ResumeContent);
            hasLoadedRef.current = true;
        } else if (resume?.content) {
            setContent(resume.content as ResumeContent);
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
                position: "",
                startDate: "",
                endDate: "",
                achievements: [],
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
                school: "",
                degree: "",
                graduationDate: "",
                location: "",
                relevantCoursework: [],
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
                highlights: [],
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
            {/* Search and Save bar */}
            <div className="flex items-center gap-4 p-4 border-b bg-muted/20">
                <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search resume content..."
                        className="pl-9"
                    />
                </div>
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
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium">Full Name</label>
                                    <AiButton />
                                </div>
                                <Input
                                    value={content.personalInfo.name}
                                    onChange={(e) => updatePersonalInfo("name", e.target.value)}
                                    placeholder="John Doe"
                                />
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
                                <label className="text-sm font-medium">Phone</label>
                                <Input
                                    value={content.personalInfo.phone || ""}
                                    onChange={(e) => updatePersonalInfo("phone", e.target.value)}
                                    placeholder="+1 (555) 123-4567"
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
                                        <label className="text-sm font-medium">Position</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={exp.position}
                                            onChange={(e) => updateExperience(index, "position", e.target.value)}
                                            placeholder="Senior Software Engineer"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm font-medium">Start Date</label>
                                            <Input
                                                value={exp.startDate}
                                                onChange={(e) => updateExperience(index, "startDate", e.target.value)}
                                                placeholder="Jan 2020"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">End Date</label>
                                            <Input
                                                value={exp.endDate || ""}
                                                onChange={(e) => updateExperience(index, "endDate", e.target.value)}
                                                placeholder="Present"
                                            />
                                        </div>
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
                                            <label className="text-sm font-medium">Achievements (one per line)</label>
                                            <AiButton />
                                    </div>
                                        <Textarea
                                            value={exp.achievements?.join("\n") || ""}
                                            onChange={(e) => updateExperience(index, "achievements", 
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
                                        <label className="text-sm font-medium">School</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={edu.school}
                                            onChange={(e) => updateEducation(index, "school", e.target.value)}
                                            placeholder="University of California, Berkeley"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Degree</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={edu.degree}
                                            onChange={(e) => updateEducation(index, "degree", e.target.value)}
                                            placeholder="B.S. in Computer Science"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Graduation Date</label>
                                        <Input
                                            value={edu.graduationDate}
                                            onChange={(e) => updateEducation(index, "graduationDate", e.target.value)}
                                            placeholder="May 2020"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Location</label>
                                        <Input
                                            value={edu.location || ""}
                                            onChange={(e) => updateEducation(index, "location", e.target.value)}
                                            placeholder="Berkeley, CA"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Relevant Coursework (comma-separated)</label>
                                        <Input
                                            value={edu.relevantCoursework?.join(", ") || ""}
                                            onChange={(e) => updateEducation(index, "relevantCoursework", 
                                                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                            )}
                                            placeholder="Data Structures, Algorithms, Machine Learning"
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
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Project Name</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={proj.name}
                                            onChange={(e) => updateProject(index, "name", e.target.value)}
                                            placeholder="E-commerce Platform"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Description</label>
                                            <AiButton />
                                        </div>
                                        <Textarea
                                            value={proj.description}
                                            onChange={(e) => updateProject(index, "description", e.target.value)}
                                            placeholder="Built a full-stack e-commerce platform..."
                                            rows={3}
                                            showBorder
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium">Technologies (comma-separated)</label>
                                            <AiButton />
                                        </div>
                                        <Input
                                            value={proj.technologies.join(", ")}
                                            onChange={(e) => updateProject(index, "technologies", 
                                                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                            )}
                                            placeholder="React, Express, MongoDB"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Highlights (one per line)</label>
                                            <AiButton />
                                        </div>
                                        <Textarea
                                            value={proj.highlights?.join("\n") || ""}
                                            onChange={(e) => updateProject(index, "highlights", 
                                                e.target.value.split('\n').filter(Boolean)
                                            )}
                                            placeholder="Built a multi-step AI content pipeline...&#10;Achieved 40+ signups and 2 paying users..."
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

