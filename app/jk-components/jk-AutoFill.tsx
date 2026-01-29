'use client'

import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { motion } from "framer-motion";

type AutoFillProps = {
    onSelect?: () => void;
};

export default function Jk_AutoFill({ onSelect }: AutoFillProps = {}) {
    const { allCommandsAndActions, onClickAutoFill, allModes } = useJobKompassChatWindow();

    return (
        <div className="transition-all duration-200 ease-out w-full max-w-md bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
            {allModes.map((mode, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => {
                        onClickAutoFill(mode.id);
                        onSelect?.();
                    }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border last:border-b-0"
                >
                    <span className="text-sm font-medium text-foreground">{mode.name}</span>
                    {mode.id === '/performance' && (
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Coming soon
                      </span>
                    )}
                </motion.div>
            ))}
        </div>
    );
}
