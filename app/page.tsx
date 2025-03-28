'use client'

import Image from "next/image";
import JkConsole from "./jk-components/jkConsole";
import { useJobKompassTheme } from "@/providers/jkThemeProvider";

export default function Home() {
  const {theme, styles} = useJobKompassTheme()
  return (


        <>
        <div className={`transition-colors duration-300 w-screen h-screen ${theme === 'dark' ? 'dark' : ''}`}>
          <JkConsole/>
        </div> 
          
        </>
  );
}
