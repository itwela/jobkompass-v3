'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkInputSection from "./jkInputSection";
import JkChatWindow from "./jkChatWindow";

export default function JkConsole() {
// export default function JkConsole({children}: {children: React.ReactNode}) {

    const {theme, styles, utilStyles} = useJobKompassTheme()

    const consoleStyles = {
        container: {
            width: '100%',height: '100%',
            display: 'flex',flexDirection: 'column' as const,
            background: styles.background,
            borderRadius: 10,
            overflow: 'hidden', padding: utilStyles.spacing.padding.sm,
            justifyContent: 'space-between',
        },
        content: {
            flex: 1,
            padding: '1rem',
            overflowY: 'auto' as const,
        },
    }

    return (
        <>
        <div style={consoleStyles.container}>
            {/* {children} */}
            <JkChatWindow/>
            <JkInputSection/>
        </div>
        </>
    );
}