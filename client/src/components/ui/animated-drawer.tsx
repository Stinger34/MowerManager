"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"

const AnimatedDrawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
)
AnimatedDrawer.displayName = "AnimatedDrawer"

const AnimatedDrawerTrigger = DrawerPrimitive.Trigger

const AnimatedDrawerPortal = DrawerPrimitive.Portal

const AnimatedDrawerClose = DrawerPrimitive.Close

const AnimatedDrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    asChild
    {...props}
  >
    <motion.div
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    />
  </DrawerPrimitive.Overlay>
))
AnimatedDrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const AnimatedDrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AnimatedDrawerPortal>
    <AnimatedDrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      asChild
      {...props}
    >
      <motion.div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
          className
        )}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ 
          duration: 0.3,
          ease: [0.32, 0.72, 0, 1]
        }}
      >
        <motion.div 
          className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </DrawerPrimitive.Content>
  </AnimatedDrawerPortal>
))
AnimatedDrawerContent.displayName = "AnimatedDrawerContent"

const AnimatedDrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <motion.div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2, duration: 0.2 }}
    {...props}
  />
)
AnimatedDrawerHeader.displayName = "AnimatedDrawerHeader"

const AnimatedDrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <motion.div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2, duration: 0.2 }}
    {...props}
  />
)
AnimatedDrawerFooter.displayName = "AnimatedDrawerFooter"

const AnimatedDrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
AnimatedDrawerTitle.displayName = DrawerPrimitive.Title.displayName

const AnimatedDrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AnimatedDrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  AnimatedDrawer,
  AnimatedDrawerPortal,
  AnimatedDrawerOverlay,
  AnimatedDrawerTrigger,
  AnimatedDrawerClose,
  AnimatedDrawerContent,
  AnimatedDrawerHeader,
  AnimatedDrawerFooter,
  AnimatedDrawerTitle,
  AnimatedDrawerDescription,
}