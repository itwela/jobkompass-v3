'use client'

import { useJobKompassResume } from "@/providers/jkResumeProvider";
import { useState } from "react";

export default function JkDocumentModal({isOpen, setIsOpen}: {isOpen: boolean, setIsOpen: (isOpen: boolean) => void}) {

    const modalStyles = {
        container: {
            position: 'fixed' as const,
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
        content: {
            width: '50%',
            height: '50%',
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '20px',
        },
        closeButton: {
            position: 'absolute' as const,
            top: 10,
            right: 10,
            cursor: 'pointer',
        },
    }

    const {currentResumeId} = useJobKompassResume()

    return (
        <div>
            <button onClick={() => setIsOpen(!isOpen)}>Toggle Modal</button>
            {isOpen && (
                <div style={modalStyles.container}>
                    <div style={modalStyles.content}>
                        <h1>Modal</h1>
                        <p>Current Resume ID: {currentResumeId}</p>
                    </div>
                </div>
            )}  
        </div>
    )
}