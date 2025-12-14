'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_TabBar from "./jkChatWindow-TabBarComponent";


export default function JkCW_Tutorial () {

    const { theme, styles, utilStyles } = useJobKompassTheme()
    const { wantsToAddJob, wantsToDownloadResume } = useJobKompassChatWindow()

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


    const gettingStartedStyles = {
        container: {
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column' as const,
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

    const tabs = [
        {
            tabName: "Add a job",
            tabIcon: "",
            tabContent: "Add a job"
        },
        {
            tabName: "Download a resume",
            tabIcon: "",
            tabContent: "Download a resume"
        },
        {
            tabName: "Get a tutorial",
            tabIcon: "",
            tabContent: "Get a tutorial"
        }
    ]


    return (
        <>

              <div style={gettingStartedStyles.container}>
                    <JkConsoleContentHeader
                        bigText="Getting Started"
                        smallText="How to get the most out of JobKompass?"
                    />
                    <JkCW_TabBar 
                    theTabs={tabs as any}
                    />
                </div>

        </>
    )
}