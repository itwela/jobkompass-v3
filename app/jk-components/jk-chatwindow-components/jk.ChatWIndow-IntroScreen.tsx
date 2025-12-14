'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";

export default function JkCW_HomeScreen() {
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

    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight">
                        {messegeForContentHeader()}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        {messegeForContentHeaderSub()}
                    </p>
                </div>
                <div className="text-sm text-muted-foreground">
                    Sign in or create an account using the JobKompass icon in the sidebar to get started.
                </div>
            </div>
        </div>
    )
}
