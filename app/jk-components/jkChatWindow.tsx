'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_PerformanceMode from "./jk-chatwindow-components/jkChatWindow-PerformanceMode";
import JkCW_ChatMode from "./jk-chatwindow-components/jkChatWindow-ChatMode";
import JkCW_DocumentsMode from "./jk-chatwindow-components/jkChatWindow-DocumentsMode";
import JkCW_MyJobsMode from "./jk-chatwindow-components/jkChatWindow-MyJobsMode";
import JkCW_Tutorial from "./jk-chatwindow-components/jk-ChatWindow-Tutorial";
import JkCW_ResourcesMode from "./jk-chatwindow-components/jkChatWindow-ResourcesMode";
import JkCW_HelpMode from "./jk-chatwindow-components/jkChatWindow-HelpMode";
import JkCW_SettingsMode from "./jk-chatwindow-components/jkChatWindow-SettingsMode";
import JkCW_LeadsMode from "./jk-chatwindow-components/jkChatWindow-LeadsMode";
import JkCW_InterviewPrepMode from "./jk-chatwindow-components/jkChatWindow-InterviewPrepMode";

export default function JkChatWindow() {
  const { currentMode } = useJobKompassChatWindow()

  const conditionalStyles = {
    showPerformanceMode: currentMode.id === '/performance',
    showChatMode: currentMode.id === '/chat',
    showDocumentsMode: currentMode.id === '/documents',
    showMyJobsMode: currentMode.id === '/my-jobs',
    showResourcesMode: currentMode.id === '/resources',
    showHelpMode: currentMode.id === '/help',
    showTutorialMode: currentMode.id === '/tutorial',
    showSettingsMode: currentMode.id === '/settings',
    showLeadsMode: currentMode.id === '/leads',
    showInterviewPrepMode: currentMode.id === '/interview-prep',
  }

  return (
    <div className="flex flex-col h-full !no-scrollbar">
      {conditionalStyles.showPerformanceMode && <JkCW_PerformanceMode />}
      {conditionalStyles.showHelpMode && <JkCW_HelpMode />}
      {/* NOTE */}
      {conditionalStyles.showTutorialMode && <JkCW_Tutorial />}
      {conditionalStyles.showChatMode && <JkCW_ChatMode />}
      {conditionalStyles.showMyJobsMode && <JkCW_MyJobsMode />}
      {conditionalStyles.showDocumentsMode && <JkCW_DocumentsMode />}
      {conditionalStyles.showResourcesMode && <JkCW_ResourcesMode />}
      {conditionalStyles.showSettingsMode && <JkCW_SettingsMode />}
      {conditionalStyles.showLeadsMode && <JkCW_LeadsMode />}
      {conditionalStyles.showInterviewPrepMode && <JkCW_InterviewPrepMode />}
    </div>
  )
}