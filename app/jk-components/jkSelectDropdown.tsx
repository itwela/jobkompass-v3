'use client'

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"

import { cn } from "@/lib/utils";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import React from "react";

interface ModeType {
  id: string;
  name: string;
}
interface JkSelectDropdownProps {
    width?: string,
    className?: string,
    fontSize?: number,
    label?: string,
    values?: ModeType[],
    setFunction?: any;
    onChange?: any;
  }

export default function JkSelectDropdown({width, label, className, values, fontSize, setFunction, onChange}: JkSelectDropdownProps) {
  const handleValueChange = (value: string) => {
    const selectedMode = values?.find(mode => mode.id === value);
    if (selectedMode && onChange) {
      onChange(selectedMode);
    }
  };

  const {styles} = useJobKompassTheme()
  const [hoveredItemId, setHoveredItemId] = React.useState<string | null>(null)

  return (
    <>
      <Select onValueChange={handleValueChange}>
        <SelectTrigger style={{color: styles.text.primary, fontSize: fontSize}} className={cn(`${width}`, className)}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent style={{
          backgroundColor: styles.card.background, 
          outlineColor: styles.card.border,
          }}>
          <SelectGroup>
            {values?.map((value) => (
              <SelectItem 
              style={{
                color: styles.text.primary,
                backgroundColor: hoveredItemId === value.id ? styles.card.accent : styles.card.background,
                }} 
                onMouseEnter={() => setHoveredItemId(value.id)} 
                onMouseLeave={() => setHoveredItemId(null)}  
                key={value.id} 
                value={value.id}>
                {value.name.split(' ')[0]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  )
}