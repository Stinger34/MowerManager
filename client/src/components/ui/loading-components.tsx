"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
      className={cn("inline-block", className)}
    >
      <Loader2 className={cn(sizeClasses[size])} />
    </motion.div>
  )
}

interface ButtonLoadingProps {
  children: React.ReactNode
  isLoading?: boolean
  loadingText?: string
  className?: string
}

export function ButtonLoading({ 
  children, 
  isLoading = false, 
  loadingText = "Loading...",
  className 
}: ButtonLoadingProps) {
  return (
    <motion.div 
      className={cn("flex items-center gap-2", className)}
      layout
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <motion.span
        key={isLoading ? "loading" : "idle"}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        transition={{ duration: 0.2 }}
      >
        {isLoading ? loadingText : children}
      </motion.span>
    </motion.div>
  )
}

interface FormLoadingSkeletonProps {
  fields?: number
  className?: string
}

export function FormLoadingSkeleton({ fields = 4, className }: FormLoadingSkeletonProps) {
  return (
    <motion.div 
      className={cn("space-y-6", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      {Array.from({ length: fields - 1 }).map((_, i) => (
        <motion.div
          key={i}
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (i + 1) * 0.1, duration: 0.3 }}
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: fields * 0.1, duration: 0.3 }}
      >
        <Skeleton className="h-10 w-24" />
      </motion.div>
    </motion.div>
  )
}

interface CardLoadingSkeletonProps {
  cards?: number
  className?: string
}

export function CardLoadingSkeleton({ cards = 3, className }: CardLoadingSkeletonProps) {
  return (
    <motion.div 
      className={cn("grid gap-4", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <motion.div
          key={i}
          className="p-6 border rounded-lg space-y-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        >
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}

interface TableLoadingSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

export function TableLoadingSkeleton({ 
  rows = 5, 
  columns = 4, 
  className 
}: TableLoadingSkeletonProps) {
  return (
    <motion.div 
      className={cn("space-y-4", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Table header */}
      <motion.div 
        className="flex gap-4 pb-2 border-b"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </motion.div>
      
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <motion.div
          key={rowIndex}
          className="flex gap-4 py-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: rowIndex * 0.05, duration: 0.3 }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className={cn(
                "h-4 flex-1",
                colIndex === 0 && "w-1/4", // First column smaller
                colIndex === columns - 1 && "w-16" // Last column fixed width
              )} 
            />
          ))}
        </motion.div>
      ))}
    </motion.div>
  )
}