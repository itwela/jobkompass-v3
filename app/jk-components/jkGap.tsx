'use client'

export default function JkGap( { size = 'default' }: { size?: 'small' | 'medium' | 'default' | 'large' } ) {
    
    const gapSizes = {
        small: '50px',
        medium: '100px',
        default: '200px',
        large: '300px',
    }
    
    const gapSize = gapSizes[size as keyof typeof gapSizes] || gapSizes.medium;

    return (
        <div className={`h-[${gapSize}]`} ></div>
    )
}