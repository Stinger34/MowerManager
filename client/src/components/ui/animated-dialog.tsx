"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const AnimatedDialog = DialogPrimitive.Root

const AnimatedDialogTrigger = DialogPrimitive.Trigger

const AnimatedDialogPortal = DialogPrimitive.Portal

const AnimatedDialogClose = DialogPrimitive.Close

const AnimatedDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    asChild
    {...props}
  >
    <motion.div
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    />
  </DialogPrimitive.Overlay>
))
AnimatedDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const AnimatedDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AnimatedDialogPortal>
    <AnimatedDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      asChild
      {...props}
    >
      <motion.div
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
          className
        )}
        initial={{ 
          opacity: 0, 
          scale: 0.9,
          x: "-50%",
          y: "-50%"
        }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          x: "-50%",
          y: "-50%"
        }}
        exit={{ 
          opacity: 0, 
          scale: 0.9,
          x: "-50%",
          y: "-50%"
        }}
        transition={{ 
          duration: 0.2,
          ease: "easeOut"
        }}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </motion.div>
    </DialogPrimitive.Content>
  </AnimatedDialogPortal>
))
AnimatedDialogContent.displayName = DialogPrimitive.Content.displayName

const AnimatedDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <motion.div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1, duration: 0.2 }}
    {...props}
  />
)
AnimatedDialogHeader.displayName = "AnimatedDialogHeader"

const AnimatedDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <motion.div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1, duration: 0.2 }}
    {...props}
  />
)
AnimatedDialogFooter.displayName = "AnimatedDialogFooter"

const AnimatedDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
AnimatedDialogTitle.displayName = DialogPrimitive.Title.displayName

const AnimatedDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AnimatedDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  AnimatedDialog,
  AnimatedDialogPortal,
  AnimatedDialogOverlay,
  AnimatedDialogClose,
  AnimatedDialogTrigger,
  AnimatedDialogContent,
  AnimatedDialogHeader,
  AnimatedDialogFooter,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
}