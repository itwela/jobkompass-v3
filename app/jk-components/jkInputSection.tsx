'use client'

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import SendIcon from "../jk-icons/sendIcon";
import React from "react";
import { ModeType, useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import JkSelectDropdown from "./jkSelectDropdown";
import { flushAllTraces } from "next/dist/trace";
import Jk_AutoFill from "./jk-AutoFill";

export default function JkInputSection() {
  const { theme, styles, utilStyles } = useJobKompassTheme()
  const { 
    textareaRef, textValue, setTextValue, commands, commandActions, highlightedText, setHighlightedText,
    allModes, currentMode, showHelperContainer, setShowHelperContainer, setCurrentMode, wantsToAddJob, setWantsToAddJob, setWantsToDownloadResume, setWantsTutorial } = useJobKompassChatWindow()

  const currentModeName = currentMode.name.split(' ')[0]



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

  const conditionalStyles = {
  
    showAutofillContainer: {
      display: textValue.includes('/') ? 'flex' : 'none',
    }
  
  }

  return (
    <>

      <div className="relative h-max">

          {/* NOTE - AUTOFILL CONTAINER HELPER */}
          <div style={conditionalStyles.showAutofillContainer} className="absolute bottom-full w-full flex place-content-center">
            <Jk_AutoFill />
          </div>


        <div className="outline ouutline-[0.618px]" style={inputSectionStyles.container}>
          <div style={{ position: 'relative' }}>

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
      </div>

    </>
  )

}
