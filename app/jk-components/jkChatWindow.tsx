'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleHeader from "./jkConsoleHeader";
import JkCW_IntroScreen from "./jk-chatwindow-components/jk.ChatWIndow-IntroScreen";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_ChatMode from "./jk-chatwindow-components/jkChatWindow-ChatMode";
import JkCW_ResumeMode from "./jk-chatwindow-components/jkChatWindow-ResumeMode";
import JkCW_JobsMode from "./jk-chatwindow-components/jkChatWindow-JobsMode";
import JkSelectDropdown from "./jkSelectDropdown";
import JkCW_Tutorial from "./jk-chatwindow-components/jk-ChatWindow-Tutorial";

export default function JkChatWindow() {

  const { theme, styles, utilStyles } = useJobKompassTheme()
  const { currentMode } = useJobKompassChatWindow()

  const chatWindowStyles = {
    container: {
      width: '100%', height: '70%',
      display: 'flex', flexDirection: 'column' as const,
      paddingTop: utilStyles.spacing.padding.sm,
      paddingBottom: utilStyles.spacing.padding.sm,
      backgroundColor: 'transparent',
    },
    content: {

    }
  }

  const conditionalStyles = {
  
    showIntroScreen: {
      display: currentMode.id === '/home' ? 'block' : 'none',
    },
    showChatMode: {
      display: currentMode.id === '/chat' ? 'block' : 'none',
    },
    showResumeMode: {
      display: currentMode.id === '/resume' ? 'block' : 'none',
    },
    showJobsMode: {
      display: currentMode.id === '/jobs' ? 'block' : 'none',
    },
    showTutorialMode: {
      display: currentMode.id === '/tutorial' ? 'block' : 'none',
    }

  }

  return (
    <>
      <JkConsoleHeader />
      <div style={chatWindowStyles.container}>

        {/* NOTE - THE HOME SCREEN */}

        <div style={conditionalStyles.showIntroScreen}>
          <JkCW_IntroScreen />
        </div>
 
        <div style={conditionalStyles.showTutorialMode}>
          <JkCW_Tutorial />
        </div>

        <div style={conditionalStyles.showChatMode}>
          <JkCW_ChatMode />
        </div>

        <div style={conditionalStyles.showJobsMode}>
          <JkCW_JobsMode/>
        </div>

        <div style={conditionalStyles.showResumeMode}>
        <JkCW_ResumeMode />
        </div>

      </div>
    </>
  )
}