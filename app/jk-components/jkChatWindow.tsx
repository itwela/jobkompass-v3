'use client'

import JkCW_IntroScreen from "./jk-chatwindow-components/jk.ChatWIndow-IntroScreen";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_ChatMode from "./jk-chatwindow-components/jkChatWindow-ChatMode";
import JkCW_ResumeMode from "./jk-chatwindow-components/jkChatWindow-ResumeMode";
import JkCW_JobsMode from "./jk-chatwindow-components/jkChatWindow-JobsMode";
import JkCW_Tutorial from "./jk-chatwindow-components/jk-ChatWindow-Tutorial";
import JkCW_ResourcesMode from "./jk-chatwindow-components/jkChatWindow-ResourcesMode";

export default function JkChatWindow() {
  const { currentMode } = useJobKompassChatWindow()

  const conditionalStyles = {
    showIntroScreen: currentMode.id === '/home',
    showChatMode: currentMode.id === '/chat',
    showResumeMode: currentMode.id === '/resume',
    showJobsMode: currentMode.id === '/jobs',
    showTutorialMode: currentMode.id === '/tutorial',
    showResourcesMode: currentMode.id === '/resources',
  }

  return (
    <div className="flex flex-col h-full">
      {conditionalStyles.showIntroScreen && <JkCW_IntroScreen />}
      {conditionalStyles.showTutorialMode && <JkCW_Tutorial />}
      {conditionalStyles.showChatMode && <JkCW_ChatMode />}
      {conditionalStyles.showJobsMode && <JkCW_JobsMode />}
      {conditionalStyles.showResumeMode && <JkCW_ResumeMode />}
      {conditionalStyles.showResourcesMode && <JkCW_ResourcesMode />}
    </div>
  )
}