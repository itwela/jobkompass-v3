'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";
import JkCW_ResumeForm from "./jkChatWindow-ResumeForm";


export default function JkCW_ResumeMode() {

    const {theme, styles, utilStyles} = useJobKompassTheme()

    const resumePageStyles = {
        container: {
            // TODO This will be flixible the same way my trading software is.
            // there will be a button from aprovider that iwll basically adjust the width of the components in it.
            width: '100%',height: '100%',
            display: 'flex',flexDirection: 'row' as const,
            // alignItems: 'center', 
            // justifyContent: 'center',
        },
        content: {

        },
        heading: {
            fontSize: utilStyles.typography.fontSize["4xl"],
            fontWeight: utilStyles.typography.fontWeight.bold,
        },
    }

    function ResumeChat() {
        return (
            <>
                <div>Chat</div>
            </>
        )
    }

    return (
        <>
        <div style={resumePageStyles.container}>
            <JkCW_ResumeForm/>
            {/* <ResumeChat/> */}
        </div>
        </>
    )
}