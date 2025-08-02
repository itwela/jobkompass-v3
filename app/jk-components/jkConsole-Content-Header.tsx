'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import { motion } from "framer-motion";


export default function JkConsoleContentHeader({bigText, smallText}: {bigText: string, smallText: string}) {
    const { theme, styles, utilStyles } = useJobKompassTheme()
    const {homeHeaderText} = useJobKompassChatWindow();
    const consoleContentHeaderStyles = {
        heading: {
            fontSize: utilStyles.typography.fontSize["4xl"],
            fontWeight: utilStyles.typography.fontWeight.bold,
            color: styles.text.primary,
        },
        subheading: {
            fontSize: utilStyles.typography.fontSize.sm,
            fontWeight: utilStyles.typography.fontWeight.bold,
            color: `${styles.text.secondary}`,
        }
    }

    return (
        <>
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                delay: 0.1
                }}
            className="select-none cursor-default" style={consoleContentHeaderStyles.heading}>
                {bigText}
            </motion.h1>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                delay: 0.2
                }}
            className="select-none cursor-default" style={consoleContentHeaderStyles.subheading}>
                {smallText}
            </motion.h2>
        </>
    )
}