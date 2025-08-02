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

    
    const users = useQuery(api.documents.listUsers)
    const {currentResumeId, setCurrentResumeId, resumes} = useJobKompassResume()
    const createTestResumes = useMutation(api.documents.createTestResumes)
    const createTestUser = useMutation(api.documents.createTestUser)

    const [hoveredResumeId, setHoveredResumeId] = React.useState<string | null>(null)
    const [isCreating, setIsCreating] = React.useState(false)
    const [isCreatingUser, setIsCreatingUser] = React.useState(false)

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

    const handleCreateTestUser = async () => {
        setIsCreatingUser(true)
        try {
            await createTestUser()
        } catch (error) {
            console.error('Error creating test user:', error)
        } finally {
            setIsCreatingUser(false)
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
                        Create a test user first, then add some test resumes to get started
                    </p>
                    {users && users.length > 0 && (
                        <div style={{ marginTop: '1em', textAlign: 'left' as const }}>
                            <h3 style={{ fontSize: utilStyles.typography.fontSize.lg, marginBottom: '0.5em', color: jkColors.dark }}>
                                Current Users ({users.length}):
                            </h3>
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column' as const, 
                                gap: '0.5em',
                                maxHeight: '200px',
                                overflowY: 'auto' as const,
                                padding: '0.5em',
                                backgroundColor: jkColors.light,
                                borderRadius: '0.5em',
                                border: `1px solid ${jkColors.kindOfLight}`
                            }}>
                                {users.map((user) => (
                                    <div key={user._id} style={{
                                        padding: '0.5em',
                                        backgroundColor: 'white',
                                        borderRadius: '0.25em',
                                        border: `1px solid ${jkColors.kindOfLight}`,
                                        fontSize: utilStyles.typography.fontSize.sm
                                    }}>
                                        <strong>ID:</strong> {user._id}<br/>
                                        <strong>Name:</strong> {user.name || 'N/A'}<br/>
                                        <strong>Email:</strong> {user.email || 'N/A'}<br/>
                                        <strong>Token:</strong> {user.tokenIdentifier ? `${user.tokenIdentifier.substring(0, 10)}...` : 'Empty'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(!users || users.length === 0) && (
                        <p style={{ fontSize: utilStyles.typography.fontSize.base, color: jkColors.kindOfDark, fontStyle: 'italic' }}>
                            No users found in database
                        </p>
                    )}
                    <div style={resumeFormStyles.buttonContainer}>
                        <button
                            onClick={handleCreateTestUser}
                            disabled={isCreatingUser}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreatingUser ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.primary
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }
                            }}
                        >
                            {isCreatingUser ? 'Creating...' : 'Create Test User'}
                        </button>
                        <button
                            onClick={() => handleCreateTestResumes(3)}
                            disabled={isCreating || isCreatingUser}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreating || isCreatingUser ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreating && !isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreating && !isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.primary
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }
                            }}
                        >
                            {isCreating ? 'Creating...' : 'Add 3 Test Resumes'}
                        </button>
                        <button
                            onClick={() => handleCreateTestResumes(5)}
                            disabled={isCreating || isCreatingUser}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreating || isCreatingUser ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreating && !isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreating && !isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.primary
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }
                            }}
                        >
                            {isCreating ? 'Creating...' : 'Add 5 Test Resumes'}
                        </button>
                        <button
                            onClick={() => handleCreateTestResumes(10)}
                            disabled={isCreating || isCreatingUser}
                            style={{
                                ...resumeFormStyles.button,
                                ...(isCreating || isCreatingUser ? resumeFormStyles.buttonDisabled : {}),
                            }}
                            onMouseEnter={(e) => {
                                if (!isCreating && !isCreatingUser) {
                                    e.currentTarget.style.backgroundColor = jkColors.dark
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCreating && !isCreatingUser) {
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
                    key={resume._id}
                >
                    <h2>{resume.name}</h2>
                </div>
            ))}
        </div>
        </>
    )
}