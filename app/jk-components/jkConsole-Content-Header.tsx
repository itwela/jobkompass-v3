'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";

export default function JkConsoleContentHeader({bigText, smallText}: {bigText: string, smallText: string}) {
    const { theme, styles, utilStyles } = useJobKompassTheme()
    const consoleContentHeaderStyles = {
        heading: {
            fontSize: utilStyles.typography.fontSize["4xl"],
            fontWeight: utilStyles.typography.fontWeight.bold,
            color: styles.text.primary,
        },
        subheading: {
            fontSize: utilStyles.typography.fontSize.sm,
            fontWeight: utilStyles.typography.fontWeight.bold,
            color: `${styles.text.secondary}71`,
        }
    }

    return (
        <>
            <h1 className="select-none cursor-default" style={consoleContentHeaderStyles.heading}>
                {bigText}
            </h1>
            <h2 className="select-none cursor-default" style={consoleContentHeaderStyles.subheading}>
                {smallText}
            </h2>
        </>
    )
}