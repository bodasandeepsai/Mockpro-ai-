"use client"

import React from 'react';
import { Loader2, LoaderCircle as LucideLoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LoaderCircle component for displaying a circular loading animation
 */
export function LoaderCircle({ className, ...props }) {
  return <LucideLoaderCircle className={cn("animate-spin", className)} {...props} />;
}

/**
 * Loader component for displaying a loading animation
 */
export function Loader({ className, ...props }) {
  return <Loader2 className={cn("animate-spin", className)} {...props} />;
}

/**
 * LoaderButton component for displaying a loader within a button
 */
export function LoaderButton({ className, size = "default", ...props }) {
  const sizeClasses = {
    default: "h-4 w-4",
    sm: "h-3 w-3",
    lg: "h-5 w-5",
  };
  
  return (
    <Loader2 
      className={cn("animate-spin mr-2", sizeClasses[size], className)} 
      {...props} 
    />
  );
}
