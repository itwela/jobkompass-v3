'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleContentHeader from "../jkConsole-Content-Header";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_TabBar from "./jkChatWindow-TabBarComponent";


export default function JkCW_HomeScreen() {

    const { theme, styles, utilStyles } = useJobKompassTheme()
    const { wantsToAddJob, wantsToDownloadResume, wantsTutorial } = useJobKompassChatWindow()

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


    const introScreenStyles = {
        container: {
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column' as const,
            alignItems: 'center', justifyContent: 'center',
        },
        content: {

        }
    }

    return (
        <>

                <div style={introScreenStyles.container}>
                    <JkConsoleContentHeader
                        // bigText={`Hey there!`}
                        // smallText={`New to JobKompass? Type '/start' to get started!`}
                        bigText={messegeForContentHeader()}
                        smallText={messegeForContentHeaderSub()}
                    />
                </div>
            
        </>
    )
}