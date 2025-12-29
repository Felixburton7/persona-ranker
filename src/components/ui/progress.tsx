"use client";

import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const Progress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number | null }
>(({ className, value, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative h-2 w-full overflow-hidden rounded-full bg-stone-200",
            className
        )}
        {...props}
    >
        <div
            className="h-full w-full flex-1 bg-purple-600 transition-all"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </div>
))
Progress.displayName = "Progress"

export { Progress }
