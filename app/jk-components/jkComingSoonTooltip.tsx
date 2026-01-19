'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type TooltipSide = "top" | "right" | "bottom" | "left";

interface JkComingSoonTooltipProps {
  children: React.ReactNode;
  side?: TooltipSide;
  message?: string;
}

export default function JkComingSoonTooltip({ 
  children, 
  side = "top",
  message = "Coming soon"
}: JkComingSoonTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block cursor-not-allowed">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side={side}>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

