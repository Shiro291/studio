import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 50"
      width="120"
      height="30"
      aria-label="BoardWise Logo"
      {...props}
    >
      <rect width="200" height="50" rx="5" fill="hsl(var(--primary))" />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="Poppins, sans-serif"
        fontSize="24"
        fontWeight="bold"
        fill="hsl(var(--primary-foreground))"
      >
        BoardWise
      </text>
    </svg>
  );
}
