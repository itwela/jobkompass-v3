'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "./jkConsole-Content-Header";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_TabBar from "./jk-chatwindow-components/jkChatWindow-TabBarComponent";
import { motion } from "framer-motion";
import React, { CSSProperties } from "react";

export default function Jk_AutoFill() {

    const { theme, styles, utilStyles } = useJobKompassTheme()
    const { textValue, allCommandsAndActions, setShowHelperContainer, onClickAutoFill, wantsToAddJob, wantsToDownloadResume, wantsTutorial, showHelperContainer } = useJobKompassChatWindow()
    const [hoveredItemId, setHoveredItemId] = React.useState<number | null>(null)

    const hoveredColor = '#00000006'

    const getContentStyle = (jobId: number) => ({
        width: '100%',
        display: 'flex',
        flexDirection: 'row' as const,
        justifyContent: 'space-between',
        alignItems: 'center',
        alignContent: 'center',
        overflow: 'hidden',
        padding: utilStyles.spacing.padding.sm,
        // backgroundColor: hoveredItemId === jobId ? hoveredColor : 'transparent',
        borderRadius: 6.18,
    })

    const autoFillStyles = {
        container: {
            width: '40%',
            alignSelf: 'center',
            boxShadow: '-0.318px -0.318px 0.318px 0px grey, -0.318px -0.318px 0.318px 0px grey, 0px -0.318px 0.318px 0px grey',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 5,
            borderTopLeftRadius: 16.18,
            borderTopRightRadius: 16.18,
            justifyContent: 'space-between',
            overflow: 'hidden',
            padding: utilStyles.spacing.padding.sm,
            color: styles.text.primary,
            backgroundColor: styles.background
        },
        text: {
            fontSize: 12,
            fontWeight: 500,
            color: styles.text.primary,
            textAlign: 'center',    
        }
        
    } as React.CSSProperties | any


    // I need to map the jobs in here  so i can select them
    const demoJobs = [
        {
            id: 1,
            title: 'Software Engineer',
            company: 'Google',
            location: 'Mountain View, CA',
            salary: '$100,000',
        },
        {
            id: 2,
            title: 'Manager',
            company: 'Meta',
            location: 'Mountain View, CA',
            salary: '$100,000',
        },
        {
            id: 3,
            title: 'Bus Boy',
            company: 'Activision',
            location: 'Mountain View, CA',
            salary: '$100,000',
        }
    ]

    const initialize = showHelperContainer


    return (
        <>
            <div  onMouseEnter={() => {setShowHelperContainer(true)}} style={autoFillStyles.container} className="transition-all duration-300 ease-in-out">
                
                {initialize && (
                    <>
                    {allCommandsAndActions.map((item, index) => {
                        return (
                            <motion.div 
                                key={index} 
                                style={getContentStyle(index)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ 
                                    delay: index * 0.1,
                                }}
                                onClick={() => onClickAutoFill(item)}
                                className="hover:bg-black/5 hover:cursor-pointer"
                                // onMouseEnter={() => setHoveredItemId(job.id)}
                                // onMouseLeave={() => setHoveredItemId(null)}
                            >
                                <p style={autoFillStyles.text} className="cursor-pointer">
                                    {item}
                                </p>
                            </motion.div>
                        )
                    })}
                    </>
                )}

            </div>
        </>
    )
}