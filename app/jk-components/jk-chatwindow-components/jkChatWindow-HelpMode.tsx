'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, ExternalLink, Lightbulb, BookOpen, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useHelp, HelpGuide } from "@/providers/jkHelpProvider";
import JkGap from "../jkGap";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";

function GuideCard({
  guide,
  isActive,
  onSelect
}: {
  guide: HelpGuide;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${isActive
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border hover:border-primary/50 bg-card hover:shadow-sm'
        }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0">{guide.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-1">{guide.title}</h3>
          {/* <p className="text-sm text-muted-foreground line-clamp-2">{guide.description}</p> */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            <span>{guide.sections.length} sections</span>
          </div>
        </div>
        {isActive && (
          <ChevronLeft className="h-5 w-5 text-primary flex-shrink-0" />
        )}
      </div>
    </motion.div>
  );
}

function GuideContent({ guide }: { guide: HelpGuide }) {
  const { setCurrentMode, allModes } = useJobKompassChatWindow();

  const handleAction = (modeId?: string, command?: string) => {
    if (modeId) {
      // Find the mode from allModes and switch to it
      const targetMode = allModes.find(mode => mode.id === modeId);
      if (targetMode) {
        setCurrentMode(targetMode);
      }
    } else if (command) {
      // Handle command actions - switch to chat mode and send command
      const chatMode = allModes.find(mode => mode.id === '/chat');
      if (chatMode) {
        setCurrentMode(chatMode);
        // The command would need to be handled by the chat component
        // For now, just switch to chat mode
      }
    }
  };

  const renderContent = (section: typeof guide.sections[0], index: number) => {
    switch (section.type) {
      case 'text':
        return (
          <p className="text-muted-foreground leading-relaxed">{section.content as string}</p>
        );

      case 'list':
        return (
          <ul className="space-y-3">
            {(section.content as any[]).map((item, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-start gap-3"
              >
                <ArrowRight className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  {item.title && (
                    <h4 className="font-semibold mb-1">{item.title}</h4>
                  )}
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                  {item.action && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(item.action?.modeId, item.action?.command);
                      }}
                    >
                      {item.action.label}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        );

      case 'steps':
        return (
          <ol className="space-y-3 list-decimal list-inside">
            {(section.content as any[]).map((item, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="text-muted-foreground"
              >
                <span className="font-semibold text-foreground mr-2">{idx + 1}.</span>
                {item.description}
              </motion.li>
            ))}
          </ol>
        );

      case 'tips':
        return (
          <div className="space-y-3">
            {(section.content as any[]).map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border"
              >
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground text-sm flex-1">{item.description}</p>
              </motion.div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {guide.sections.map((section, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="space-y-3"
        >
          <h3 className="text-xl font-semibold flex items-center gap-2">
            {section.title}
          </h3>
          {renderContent(section, index)}
        </motion.div>
      ))}
    </motion.div>
  );
}

export default function JkCW_HelpMode() {
  const {
    guides,
    activeGuide,
    setActiveGuide,
    searchQuery,
    setSearchQuery,
    filteredGuides,
  } = useHelp();

  return (
    <div className="flex flex-col h-max overflow-y-scroll bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto w-full no-scrollbar overflow-y-scroll  px-6 py-8 h-max flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Help & Guides</h1>
          <p className="text-muted-foreground">
            Learn how to get the most out of JobKompass and streamline your job search
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-6 h-max">
          {/* Guide Content */}
          <div className="flex-1 overflow-y-auto chat-scroll">
            {activeGuide ? (
              <motion.div
                key={activeGuide.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card rounded-lg border border-border p-6"
              >
                <div className="mb-6 pb-4 border-b border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl">{activeGuide.icon}</span>
                    <div>
                      <h2 className="text-2xl font-bold">{activeGuide.title}</h2>
                      <p className="text-muted-foreground mt-1">{activeGuide.description}</p>
                    </div>
                  </div>
                </div>
                <GuideContent guide={activeGuide} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">📚</div>
                <h2 className="text-2xl font-semibold mb-2">Select a guide to get started</h2>
                <p className="text-muted-foreground">
                  Choose a guide from the sidebar to learn more about JobKompass
                </p>
              </div>
            )}
          </div>

          {/* Guides Sidebar */}
          <div className="w-80 flex-shrink-0 overflow-y-auto chat-scroll">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Guides
              </h2>
              <AnimatePresence mode="popLayout">
                {filteredGuides.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <p>No guides match your search</p>
                  </motion.div>
                ) : (
                  filteredGuides.map((guide) => (
                    <GuideCard
                      key={guide.id}
                      guide={guide}
                      isActive={activeGuide?.id === guide.id}
                      onSelect={() => setActiveGuide(guide)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>


        </div>

      </div>
    </div>
  );
}
