'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_TabBar from "./jkChatWindow-TabBarComponent";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { jkColors } from "@/app/colors";

export default function JkCW_HomeScreen() {

    const { theme, styles, utilStyles } = useJobKompassTheme()
    const { wantsToAddJob, wantsToDownloadResume, wantsTutorial } = useJobKompassChatWindow()
    const { signIn } = useAuthActions();
    const [step, setStep] = useState<"signUp" | "signIn">("signIn");

    const messegeForContentHeader = () => {
        if (wantsToAddJob) {
            return "Keep track and update your jobs"
        } else if (wantsToDownloadResume) {
            return "Download your resume"
        } else {
            return "Hey there!"
        }
    }

    const messegeForContentHeaderSub = () => {
        if (wantsToAddJob) {
            return "Simply type '/add' + space, paste the link, and then press the send button to get started!"
        } else if (wantsToDownloadResume) {
            return "Simply type '/download-resume' +'', and then the link, and press the send button to get started!"
        } else {
            return "New to JobKompass? Type '/start' to get started!"
        }
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void signIn("password", formData);
    };

    const introScreenStyles = {
        container: {
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', justifyContent: 'center',
            gap: '2em',
        },
        content: {

        },
        form: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '1em',
            width: '100%',
            maxWidth: '400px',
            padding: '2em',
            backgroundColor: jkColors.light,
            borderRadius: '1em',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
        input: {
            padding: '0.75em',
            border: `1px solid ${jkColors.kindOfLight}`,
            borderRadius: '0.5em',
            fontSize: utilStyles.typography.fontSize.base,
            backgroundColor: 'white',
        },
        button: {
            padding: '0.75em 1.5em',
            backgroundColor: jkColors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '0.5em',
            fontSize: utilStyles.typography.fontSize.base,
            fontWeight: utilStyles.typography.fontWeight.medium,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
        },
        buttonSecondary: {
            padding: '0.75em 1.5em',
            backgroundColor: 'transparent',
            color: jkColors.primary,
            border: `1px solid ${jkColors.primary}`,
            borderRadius: '0.5em',
            fontSize: utilStyles.typography.fontSize.base,
            fontWeight: utilStyles.typography.fontWeight.medium,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
        }
    }

    return (
        <>
            <div style={introScreenStyles.container}>
                <JkConsoleContentHeader
                    bigText={messegeForContentHeader()}
                    smallText={messegeForContentHeaderSub()}
                />
                
                <form style={introScreenStyles.form} onSubmit={handleSubmit}>
                    <input 
                        name="email" 
                        placeholder="Email" 
                        type="text" 
                        style={introScreenStyles.input}
                        required
                    />
                    <input 
                        name="password" 
                        placeholder="Password" 
                        type="password" 
                        style={introScreenStyles.input}
                        required
                    />
                    <input name="flow" type="hidden" value={step} />
                    <button 
                        type="submit" 
                        style={introScreenStyles.button}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = jkColors.dark;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = jkColors.primary;
                        }}
                    >
                        {step === "signIn" ? "Sign in" : "Sign up"}
                    </button>
                    <button
                        type="button"
                        style={introScreenStyles.buttonSecondary}
                        onClick={() => {
                            setStep(step === "signIn" ? "signUp" : "signIn");
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = jkColors.primary;
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = jkColors.primary;
                        }}
                    >
                        {step === "signIn" ? "Sign up instead" : "Sign in instead"}
                    </button>
                </form>
                
            </div>
        </>
    )
}