'use client'

import JkCW_IntroScreen from "./jk-chatwindow-components/jk.ChatWIndow-IntroScreen";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_ChatMode from "./jk-chatwindow-components/jkChatWindow-ChatMode";
import JkCW_DocumentsMode from "./jk-chatwindow-components/jkChatWindow-DocumentsMode";
import JkCW_MyJobsMode from "./jk-chatwindow-components/jkChatWindow-MyJobsMode";
import JkCW_Tutorial from "./jk-chatwindow-components/jk-ChatWindow-Tutorial";
import JkCW_ResourcesMode from "./jk-chatwindow-components/jkChatWindow-ResourcesMode";
import JkCW_SettingsMode from "./jk-chatwindow-components/jkChatWindow-SettingsMode";

export default function JkChatWindow() {
  const { currentMode } = useJobKompassChatWindow()

  // Update: Remove references to "/jobs" and "/resume-editor"
  // Only use the modes defined in file_context_0 (providers/jkChatWindowProvider.tsx:64)

  const conditionalStyles = {
    showIntroScreen: currentMode.id === '/home',
    showChatMode: currentMode.id === '/chat',
    showDocumentsMode: currentMode.id === '/documents',
    showMyJobsMode: currentMode.id === '/my-jobs',
    showResourcesMode: currentMode.id === '/resources',
    showHelpMode: currentMode.id === '/help',
    showTutorialMode: currentMode.id === '/tutorial', // Not in allModes, but may be handled separately
    showSettingsMode: currentMode.id === '/settings',
  }

  return (
    <div className="flex flex-col h-full">
      {conditionalStyles.showIntroScreen && <JkCW_IntroScreen />}
      {conditionalStyles.showHelpMode && <JkCW_Tutorial />}
      {/* NOTE */}
      {conditionalStyles.showTutorialMode && <JkCW_Tutorial />}
      {conditionalStyles.showChatMode && <JkCW_ChatMode />}
      {conditionalStyles.showMyJobsMode && <JkCW_MyJobsMode />}
      {conditionalStyles.showDocumentsMode && <JkCW_DocumentsMode />}
      {conditionalStyles.showResourcesMode && <JkCW_ResourcesMode />}
      {conditionalStyles.showSettingsMode && <JkCW_SettingsMode />}
    </div>
  )
}