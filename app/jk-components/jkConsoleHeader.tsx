'use client'

import { useJobKompassTheme } from "@/providers/jkThemeProvider";
import Link from "next/link"
 
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import Seperator from "../jk-icons/seperator";

export default function JkConsoleHeader() {

  const {theme, styles, utilStyles} = useJobKompassTheme()
  const {currentMode} = useJobKompassChatWindow()

  const currentModeName = currentMode.name.split(' ')[0]

  return (
  <>
    <div className="w-full h-full max-h-[5dvh] flex items-center">
    <Breadcrumb>
      <BreadcrumbList>

        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <h2 className="cursor-pointer select-none text-base sm:text-lg">{currentModeName}</h2>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* <BreadcrumbSeparator /> */}

        {/* <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem> */}

        {/* <BreadcrumbSeparator /> */}

        {/* <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/docs/components">Components</Link>
          </BreadcrumbLink>
        </BreadcrumbItem> */}

          <Seperator color={`${styles.text.secondary}71`} filled size={16}/>

        {/* <BreadcrumbSeparator /> */}

        {/* <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem> */}
        
      </BreadcrumbList>
    </Breadcrumb>
    </div>
  </>
  )
}