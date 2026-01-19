'use client'

import { DollarSign } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JkCompensationBadgeProps {
  compensation: string | undefined | null;
  className?: string;
}

/**
 * Parses a compensation string and extracts the numeric value(s)
 * Handles formats like: "$160k", "$160K", "160k", "$160,000", "160000", "$160k-$180k", etc.
 * Returns the highest value found (for ranges)
 */
function parseCompensation(compensation: string): number | null {
  if (!compensation || typeof compensation !== 'string') return null;
  
  // Clean up the string
  const cleaned = compensation.toLowerCase().trim();
  
  // If it just says "competitive" or similar non-numeric strings
  if (cleaned === 'competitive' || cleaned === 'negotiable' || cleaned === 'tbd') {
    return null;
  }
  
  // Find all numeric patterns (with optional k/K suffix and currency symbols)
  // Matches: 160k, 160K, 160,000, 160000, $160k, €60k, etc.
  const pattern = /[\$€£]?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*([kK])?/g;
  const matches = [...cleaned.matchAll(pattern)];
  
  if (matches.length === 0) return null;
  
  let highestValue = 0;
  
  for (const match of matches) {
    const numericPart = match[1].replace(/,/g, ''); // Remove commas
    const hasK = match[2] !== undefined;
    
    let value = parseFloat(numericPart);
    
    // If it has 'k' suffix, multiply by 1000
    if (hasK) {
      value *= 1000;
    }
    // If it's a small number without 'k' (like 160), it's probably in thousands
    else if (value < 1000 && value > 0) {
      value *= 1000;
    }
    
    if (value > highestValue) {
      highestValue = value;
    }
  }
  
  return highestValue > 0 ? highestValue : null;
}

/**
 * Determines the dollar tier (1-4) based on compensation
 * - Under $100k = 1$
 * - $100k-$199k = 2$
 * - $200k-$299k = 3$
 * - $300k+ = 4$
 */
function getDollarTier(value: number): 1 | 2 | 3 | 4 {
  if (value >= 300000) return 4;
  if (value >= 200000) return 3;
  if (value >= 100000) return 2;
  return 1;
}

/**
 * Returns a color class based on tier
 */
function getTierColor(tier: 1 | 2 | 3 | 4): string {
  switch (tier) {
    case 1: return "4BDE95"; // light green
    case 2: return "33A86D"; // medium-light green
    case 3: return "21744A"; // medium green
    case 4: return "13552C"; // dark green
  }
}


export default function JkCompensationBadge({ compensation, className = "" }: JkCompensationBadgeProps) {
  if (!compensation) return null;
  
  const value = parseCompensation(compensation);
  
  // If we couldn't parse the value, don't show anything
  if (value === null) return null;
  
  const tier = getDollarTier(value);
  const colorClass = getTierColor(tier);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`inline-flex items-center gap-0.5 rounded-md text-xs font-semibold cursor-default ${className}`}
          >
            {Array.from({ length: tier }).map((_, i) => (
              <DollarSign key={i} className="h-3 w-3" style={{ color: `#${colorClass}` }} />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{compensation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Export the parser for testing/reuse
export { parseCompensation, getDollarTier };

