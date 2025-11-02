'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { motion } from "framer-motion";

export default function Jk_AutoFill() {
    const { allCommandsAndActions, setShowHelperContainer, onClickAutoFill, showHelperContainer } = useJobKompassChatWindow()

    return (
        <div 
            onMouseEnter={() => setShowHelperContainer(true)}
            className="transition-all duration-200 ease-out w-full max-w-md mx-auto bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
        >
            {showHelperContainer && (
                <>
                    {allCommandsAndActions.map((item, index) => (
                        <motion.div 
                            key={index} 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => onClickAutoFill(item)}
                            className="flex items-center justify-between px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border last:border-b-0"
                        >
                            <span className="text-sm font-medium text-foreground">{item}</span>
                        </motion.div>
                    ))}
                </>
            )}
        </div>
    )
}
