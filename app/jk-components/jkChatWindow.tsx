'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import JkConsoleHeader from "./jkConsoleHeader";
import JkCW_IntroScreen from "./jk.ChatWIndow-IntroScreen";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkCW_ChatMode from "./jkChatWindow-ChatMode";
import JkCW_ResumeMode from "./jkChatWindow-ResumeMode";
import JkCW_JobsMode from "./jkChatWindow-JobsMode";
import JkSelectDropdown from "./jkSelectDropdown";

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

  return (
    <>
      <JkConsoleHeader />
      <div style={chatWindowStyles.container}>

        {currentMode.id === '/home' && (
          <JkCW_IntroScreen />
        )}

        {currentMode.id === '/chat' && (
          <JkCW_ChatMode />
        )}

        {currentMode.id === '/jobs' && (
          <JkCW_JobsMode/>
        )}
        
        {currentMode.id === '/resume' && (
          <JkCW_ResumeMode />
        )}


      </div>
    </>
  )
}