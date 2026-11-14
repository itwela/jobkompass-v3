'use client'

/**
 * The app shell. Desktop (lg+): fixed 264px rail (jkSIdebar.tsx) + a content surface that
 * scrolls on its own. Below lg: sticky phone header, full-screen menu and bottom tab bar
 * (jk-app/jkAppMobile.tsx).
 *
 * Every mode renders inside <JkChatWindow/>, wrapped in a [data-enter] surface keyed by mode,
 * so the shared entrance (JkEnter + .jk-enter / .jk-stagger) replays on every switch.
 *
 * CSS var for screens: --jk-tabbar-h on the shell root = height of the phone tab bar (0 on
 * desktop). Fixed bottom UI uses `bottom: calc(var(--jk-tabbar-h) + …)`.
 */
import JkChatWindow from "./jkChatWindow";
import JkSidebar, { useJkOpenSearch } from "./jkSIdebar";
import JkFileUploadModal from "./jkFileUploadModal";
import JkEnter from "./jkEnter";
import JkSearchModal from "./jkSearchModal";
import JkUpgradeModal from "./jkUpgradeModal";
import JkChatThreadMenu from "./jk-app/jkChatThreadMenu";
import { JkAppMobileHeader, JkAppMobileMenu, JkAppTabBar } from "./jk-app/jkAppMobile";
import { JK_TOP_LEVEL } from "./jk-app/jkAppNav";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

export default function JkConsole() {
    const [menuOpen, setMenuOpen] = useState(false)
    const searchParams = useSearchParams()
    const {
        currentMode,
        isFileModalOpen,
        setIsFileModalOpen,
        setDroppedFile,
        setFileName,
        setIsFileMode,
        setCurrentMode,
        allModes
    } = useJobKompassChatWindow()
    const { upgradeModal, setUpgradeModal } = useFeatureAccess()
    const { searchOpen, setSearchOpen, openSearch } = useJkOpenSearch(setUpgradeModal)

    // Phone back arrow returns to the last of Jobs / Docs / Chat the person was on.
    const lastTop = useRef<string>('/chat')
    useEffect(() => {
        if (JK_TOP_LEVEL.includes(currentMode.id)) lastTop.current = currentMode.id
    }, [currentMode.id])
    const goBack = useCallback(() => {
        const target = allModes.find(m => m.id === lastTop.current)
        if (target) setCurrentMode(target)
    }, [allModes, setCurrentMode])
    const closeMenu = useCallback(() => setMenuOpen(false), [])

    // Land in a specific mode on load, e.g. after a redirect like the Gmail
    // OAuth callback (/app?mode=settings&gmail_connected=1)
    useEffect(() => {
        const modeParam = searchParams.get('mode')
        if (!modeParam) return
        const targetMode = allModes.find(mode => mode.id === `/${modeParam}`)
        if (targetMode) {
            setCurrentMode(targetMode)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    const handleFileSelect = useCallback((file: File) => {
        setDroppedFile(file);
        setFileName(file.name);
        setIsFileMode(true);
        const fileMode = allModes.find(mode => mode.id === '/file');
        if (fileMode) {
            setCurrentMode(fileMode);
        }
    }, [setDroppedFile, setFileName, setIsFileMode, setCurrentMode, allModes]);

    return (
        <div className="jk-app-shell flex h-dvh w-full overflow-hidden bg-background">
            <JkEnter />

            {/* Desktop rail: fixed, never scrolls with the content */}
            <aside className="hidden h-full shrink-0 lg:flex">
                <JkSidebar />
            </aside>

            {/* Content surface */}
            <main className="relative flex min-w-0 flex-1 flex-col bg-background">
                <JkAppMobileHeader
                    onBack={goBack}
                    onMenu={() => setMenuOpen(true)}
                    onSearch={openSearch}
                    menuOpen={menuOpen}
                    extra={<JkChatThreadMenu />}
                />

                {/* Desktop: Chat renders its own composer and thread header (with the thread menu). */}
                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[var(--jk-tabbar-h)]">
                    <JkFileUploadModal
                        isOpen={isFileModalOpen}
                        onClose={() => setIsFileModalOpen(false)}
                        onFileSelect={handleFileSelect}
                    />
                    {/* Keyed by mode: the surface remounts and its entrance replays on every switch. */}
                    <div key={currentMode.id} data-enter className="jk-stagger flex min-h-0 flex-1 flex-col">
                        <div className="flex min-h-0 flex-1 flex-col">
                            <JkChatWindow />
                        </div>
                    </div>

                </div>
            </main>

            <JkAppTabBar onMore={() => setMenuOpen(true)} moreOpen={menuOpen} />
            <JkAppMobileMenu open={menuOpen} onClose={closeMenu} />

            <JkSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            <JkUpgradeModal
                isOpen={upgradeModal.isOpen}
                onClose={() => setUpgradeModal((prev) => ({ ...prev, isOpen: false }))}
                feature={upgradeModal.feature}
                currentLimit={upgradeModal.currentLimit}
                currentPlan={upgradeModal.currentPlan}
            />
        </div>
    )
}
