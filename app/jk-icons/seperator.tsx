'use client'

export default function Seperator({color, filled, size,}: {color: string, filled: boolean, size?: number,}) {
  return (
  
  <>
  {filled && (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" id="Line-End-Diamond-Fill--Streamline-Sharp-Fill-Material" height={size} width={size} ><desc>{"Line End Diamond Fill Streamline Icon: https://streamlinehq.com"}</desc><path fill={color} d="M15 19 8.75 12.75H2v-1.5h6.75L15 5l7 7 -7 7Z" strokeWidth={0.5} /></svg>
  )}  
  {!filled && (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" id="Line-End-Diamond--Streamline-Rounded-Material" height={size} width={size} ><desc>{"Line End Diamond Streamline Icon: https://streamlinehq.com"}</desc><path fill={color} d="m15 16.8748 4.875 -4.875 -4.875 -4.875 -4.875 4.875 4.875 4.875Zm-0.525 1.6 -5.725 -5.725h-6c-0.216665 0 -0.395835 -0.07085 -0.5375 -0.2125 -0.141665 -0.14165 -0.2125 -0.32085 -0.2125 -0.5375 0 -0.21665 0.070835 -0.39585 0.2125 -0.5375 0.141665 -0.14165 0.320835 -0.2125 0.5375 -0.2125h6l5.725 -5.725c0.15 -0.15 0.325 -0.225 0.525 -0.225s0.375 0.075 0.525 0.225l5.95 5.95c0.15 0.15 0.225 0.325 0.225 0.525s-0.075 0.375 -0.225 0.525l-5.95 5.95c-0.15 0.15 -0.325 0.225 -0.525 0.225s-0.375 -0.075 -0.525 -0.225Z" strokeWidth={0.5} /></svg>
  )}
  </>

  )
}