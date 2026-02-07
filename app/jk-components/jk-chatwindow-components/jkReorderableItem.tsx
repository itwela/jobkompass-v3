'use client'

import React from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReorderableItemProps<T> {
    value: T;
    children: React.ReactNode;
    className?: string;
}

export default function JkReorderableItem<T>({
    value,
    children,
    className,
}: ReorderableItemProps<T>) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={value}
            dragListener={false}
            dragControls={dragControls}
            as="div"
            className={cn(
                "p-4 border rounded-lg space-y-3 bg-muted/20 relative",
                className
            )}
            whileDrag={{
                scale: 1.02,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                zIndex: 50,
                cursor: "grabbing",
            }}
            dragTransition={{
                bounceStiffness: 300,
                bounceDamping: 30,
            }}
            transition={{
                layout: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
            }}
            layout
        >
            {/* Drag Handle */}
            <div
                onPointerDown={(e) => dragControls.start(e)}
                className={cn(
                    "absolute left-0 top-0 w-8 h-10",
                    "flex items-center justify-center",
                    "cursor-grab active:cursor-grabbing",
                    "text-muted-foreground/40 hover:text-muted-foreground/70",
                    "transition-colors touch-none select-none",
                    "rounded-l-lg hover:bg-muted/40"
                )}
                title="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </div>
            {/* Content shifted right to make room for handle */}
            <div className="ml-6">
                {children}
            </div>
        </Reorder.Item>
    );
}
