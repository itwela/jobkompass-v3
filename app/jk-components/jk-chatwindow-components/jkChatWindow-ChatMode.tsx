'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";

export default function JkCW_ChatMode() {

    const {theme, styles, utilStyles} = useJobKompassTheme()

    const gettingStartedStyles = {
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
        <div style={gettingStartedStyles.container}>
               <JkConsoleContentHeader
               bigText="Chat Mode"
               smallText="What do you want to do?"
               />  
            </div>
        </>
    )
}