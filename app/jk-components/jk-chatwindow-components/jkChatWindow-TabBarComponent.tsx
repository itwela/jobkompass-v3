'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";

interface Indi_TabType {
    tabName: string;
    tabIcon: any;
    tabContent: any;
}

interface TabMainType {
    theTabs: Indi_TabType;
}

export default function JkCW_TabBar({theTabs}: TabMainType) {

    const {theme, styles, utilStyles} = useJobKompassTheme()

    const resumePageStyles = {
        container: {
            // TODO This will be flixible the same way my trading software is.
            // there will be a button from aprovider that iwll basically adjust the width of the components in it.
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
        <div style={resumePageStyles.container}>
            {Array.isArray(theTabs) ? theTabs.map((tab: Indi_TabType, index: number) => (
                <div key={`${tab.tabName}-${index}`}>
                    <JkConsoleContentHeader
                        bigText={tab.tabName}
                        smallText={tab.tabName}
                    />
                    <div style={resumePageStyles.content}>
                        {tab.tabContent}
                    </div>
                </div>
            )) : (
                <div>
                    <JkConsoleContentHeader
                        bigText={theTabs.tabName}
                        smallText={theTabs.tabName}
                    />
                    <div style={resumePageStyles.content}>
                        {theTabs.tabContent}
                    </div>
                </div>
            )}
        </div>
        </>
    )
}