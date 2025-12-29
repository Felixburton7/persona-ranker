import React from "react";

export const GeminiIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        className={className}
        {...props}
    >
        <title>Google Gemini</title>
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
);

export const GroqIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <title>Groq</title>
        <path fill="currentColor" d="M3 6C3 4.34315 4.34315 3 6 3H18C19.6569 3 21 4.34315 21 6V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V6Z" fillOpacity="0.1" />
        <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize="8">groq</text>
    </svg>
);
