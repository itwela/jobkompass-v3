'use client'

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import SendIcon from "../jk-icons/sendIcon";
import React from "react";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkSelectDropdown from "./jkSelectDropdown";
import { flushAllTraces } from "next/dist/trace";

export default function JkInputSection() {
  const { theme, styles, utilStyles } = useJobKompassTheme()
  const {allModes, currentMode, setCurrentMode, wantsToAddJob, setWantsToAddJob, setWantsToDownloadResume, setWantsTutorial} = useJobKompassChatWindow()
  const [textValue, setTextValue] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [dynamicTextAreaHeight, setDynamicTextAreaHeight] = React.useState(0)

  const commands = ['/home', '/chat', '/resume', '/jobs',]
  const commandActions = ['/add', '/download-resume', '/start']
  const [highlightedText, setHighlightedText] = React.useState<string | null>(null)

  const currentModeName = currentMode.name.split(' ')[0]

  React.useEffect(() => {

    const textarea = textareaRef.current
    
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 5 * 24)
      textarea.style.height = `${newHeight}px`
      setDynamicTextAreaHeight(newHeight)
    }

    // Check for commands in text and switch modes
    if (!textValue) {
      // const homeMode = allModes.find(mode => mode.id === '/home')
      // if (homeMode) {
      //   setCurrentMode(homeMode)
      //   setWantsTutorial(false)
      // }
      // setHighlightedText(null)
    } else {
      const command = commands.find(cmd => textValue.startsWith(cmd))
      setHighlightedText(command || null)

      const actions = commandActions.find(cmd => textValue.startsWith(cmd))
      setHighlightedText(actions || null)
      
      if (command) {
        const modeId = command
        const targetMode = allModes.find(mode => mode.id === modeId)
        if (targetMode) {
          setCurrentMode(targetMode)
          setWantsTutorial(false)
          setWantsToAddJob(false)
          setWantsToDownloadResume(false)
        }
      } 

      if (actions) {
        if (actions === '/add') {
          setWantsToAddJob(true)

          setWantsTutorial(false)
          setWantsToDownloadResume(false)
        }

        if (actions === '/download-resume') {
          setWantsToDownloadResume(true)

          setWantsTutorial(false)
          setWantsToAddJob(false)
        }

        if (actions === '/start') {
          setWantsTutorial(true)

          setWantsToAddJob(false)
          setWantsToDownloadResume(false)
        }
      }
    }

  }, [textValue, allModes, setCurrentMode])

  const inputSectionStyles = {
    container: {
      width: '100%',
      minHeight: 150,
      display: 'flex', flexDirection: 'column' as const, gap: 5,
      background: 'transparent',
      outlineColor: `${styles.card.border}`,
      borderRadius: 16.18,
      justifyContent: 'space-between',
      overflow: 'hidden', padding: utilStyles.spacing.padding.sm
    },
    content: {
      width: '100%',
      display: 'flex', flexDirection: 'row' as const,
      background: 'transparent',
      justifyContent: 'space-between',
      alignItems: 'center', alignContent: 'center',
      overflow: 'hidden', padding: utilStyles.spacing.padding.sm
    },
    button: {
      width: 36.18, height: 36.18,
      display: 'flex', flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 60.18,
      background: `${styles.text.primary}10`,
    },
    commandBadge: {
      display: 'inline-block',
      background: `${styles.text.primary}20`,
      padding: '2px 6px',
      borderRadius: 4,
      color: styles.text.primary,
    }
  }

  const renderTextWithHighlight = () => {
    if (!highlightedText) return textValue;
    
    return (
      <>
        <span style={inputSectionStyles.commandBadge}>{highlightedText}</span>
        {textValue.slice(highlightedText.length)}
      </>
    )
  }

  return (
    <>
      <div className="outline ouutline-[0.618px]" style={inputSectionStyles.container}>
        <div style={{position: 'relative'}}>
          
          <Textarea
            ref={textareaRef}
            placeholder="What's the latest? Try things like '/chat' or '/resume' to get started."
            className="no-scrollbar absolute z-5 top-0"
            value={textValue}
            style={{
              color: styles.text.primary,
              width: '100%',
              height: '100%'
            }}
            onChange={(e) => setTextValue(e.target.value)}
          />

        </div>

        <div className="" style={inputSectionStyles.content}>
          
          {/* <JkSelectDropdown fontSize={12} className="rounded-full border border-[5px]" label={currentModeName} values={allModes} onChange={setCurrentMode}/> */}
          <span></span>
          <button style={inputSectionStyles.button}>
            <SendIcon color={`${styles.text.primary}`} />
          </button>

        </div>

      </div>
    </>
  )
}