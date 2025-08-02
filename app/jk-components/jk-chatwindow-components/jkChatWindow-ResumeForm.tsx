'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import React from "react";
import { jkColors } from "@/app/colors";
import { useJobKompassResume } from "@/providers/jkResumeProvider";

export default function JkCW_ResumeForm() {

    const {theme, styles, utilStyles} = useJobKompassTheme()
    const {currentResumeId, setCurrentResumeId, resumes} = useJobKompassResume()
    const createTestResumes = useMutation(api.documents.createTestResumes)

    const [hoveredResumeId, setHoveredResumeId] = React.useState<string | null>(null)
    const [isCreating, setIsCreating] = React.useState(false)

    const handleResumeMouseEnter = (id: string) => {
        setHoveredResumeId(id)
    }

    const handleResumeMouseLeave = () => {
        setHoveredResumeId(null)
    }

    const handleResumeClick = (id: string) => {
        setCurrentResumeId(id)
    }

    const handleCreateTestResumes = async (count: number) => {
        setIsCreating(true)
        try {
            await createTestResumes({ count })
        } catch (error) {
            console.error('Error creating test resumes:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const resumeFormStyles = {
        container: {
            width: '100%',height: '100%',
            display: 'flex',flexDirection: 'column' as const,
            gap: '1.618em',
            // alignItems: 'center', 
            // justifyContent: 'center',
        },
        content: {

        },
        heading: {
            fontSize: utilStyles.typography.fontSize["4xl"],
            fontWeight: utilStyles.typography.fontWeight.bold,
        },
        resumeBox: (id: string) => ({
            width: '10em',height: '15em',
            display: 'flex',flexDirection: 'column' as const,
            backgroundColor: hoveredResumeId === id ? jkColors.primary : jkColors.kindOfLight,
            borderRadius: '0.618em',
            padding: '0.618em',
            cursor: 'pointer',
            alignItems: 'center', 
            justifyContent: 'center',
        }),
        emptyState: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '1.618em',
            textAlign: 'center' as const,
        },
        buttonContainer: {
            display: 'flex',
            gap: '1em',
            flexWrap: 'wrap' as const,
            justifyContent: 'center',
        },
        button: {
            padding: '0.618em 1.236em',
            backgroundColor: jkColors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '0.618em',
            cursor: 'pointer',
            fontSize: utilStyles.typography.fontSize.base,
            fontWeight: utilStyles.typography.fontWeight.medium,
            transition: 'all 0.2s ease',
        },
        buttonHover: {
            backgroundColor: jkColors.dark,
            transform: 'translateY(-2px)',
        },
        buttonDisabled: {
            opacity: 0.6,
            cursor: 'not-allowed',
        }
    }

    // Show empty state when no resumes
    if (!resumes || resumes.length === 0) {
        return (
            <div style={resumeFormStyles.container}>
                <h1 style={resumeFormStyles.heading}>My Resumes</h1>
                <div style={resumeFormStyles.emptyState}>
                    <h2 style={{ fontSize: utilStyles.typography.fontSize["2xl"], marginBottom: '0.5em' }}>
                        No resumes found
                    </h2>
                    <p style={{ fontSize: utilStyles.typography.fontSize.lg, color: jkColors.kindOfDark }}>
                        Create some test resumes to get started
                    </p>
                    <div style={resumeFormStyles.buttonContainer}>
                        <button
                            onClick={() => handleCreateTestResumes(3)}
                            disabled={isCreating}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreating ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreating) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreating) {
                                    e.currentTarget.style.backgroundColor = jkColors.primary
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }
                            }}
                        >
                            {isCreating ? 'Creating...' : 'Add 3 Test Resumes'}
                        </button>
                        <button
                            onClick={() => handleCreateTestResumes(5)}
                            disabled={isCreating}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreating ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreating) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreating) {
                                    e.currentTarget.style.backgroundColor = jkColors.primary
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }
                            }}
                        >
                            {isCreating ? 'Creating...' : 'Add 5 Test Resumes'}
                        </button>
                        <button
                            onClick={() => handleCreateTestResumes(10)}
                            disabled={isCreating}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreating ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreating) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreating) {
                                    e.currentTarget.style.backgroundColor = jkColors.primary
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }
                            }}
                        >
                            {isCreating ? 'Creating...' : 'Add 10 Test Resumes'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
        <div style={resumeFormStyles.container}>
            <h1>My Resumes</h1>
            {resumes?.map((resume) => (
                <div 
                    onMouseEnter={() => handleResumeMouseEnter(resume._id)} 
                    onMouseLeave={handleResumeMouseLeave} 
                    onClick={() => handleResumeClick(resume._id)}
                    style={resumeFormStyles.resumeBox(resume._id)} 
                    key={resume._id || 'test-resume'}
                >
                    <h2>{resume.name}</h2>
                </div>
            ))}
        </div>
        </>
    )
}