'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "./jkConsole-Content-Header";

export default function JkCW_ResumeForm() {

    const {theme, styles, utilStyles} = useJobKompassTheme()

    const resumeFOrmStyles = {
        container: {
            width: '100%',height: '100%',
            display: 'flex',flexDirection: 'column' as const,
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

    return (
        <>
        <div style={resumeFOrmStyles.container}>
            <h1>Resume Form</h1>
            </div>
        </>
    )
}