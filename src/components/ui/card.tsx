"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

function CardBase({ className, ...props }: CardProps) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow", className)} {...props} />;
}

function CardHeaderBase({ className, ...props }: CardProps) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

function CardTitleBase({ className, ...props }: CardProps) {
  return <div className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

function CardDescriptionBase({ className, ...props }: CardProps) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContentBase({ className, ...props }: CardProps) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooterBase({ className, ...props }: CardProps) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export const Card = CardBase;
export const CardHeader = CardHeaderBase;
export const CardTitle = CardTitleBase;
export const CardDescription = CardDescriptionBase;
export const CardContent = CardContentBase;
export const CardFooter = CardFooterBase;
