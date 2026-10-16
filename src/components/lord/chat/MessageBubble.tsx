import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant";
  children: React.ReactNode;
  animate?: boolean;
}

export function MessageBubble({ role, children, animate = true }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <motion.div
        initial={animate ? { opacity: 0, y: 10, scale: 0.98 } : false}
        animate={animate ? { opacity: 1, y: 0, scale: 1 } : false}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="flex w-full justify-end"
      >
        <div
          className={cn(
            "user-message-bubble max-w-[85%] rounded-[24px] px-5 py-3.5 text-foreground backdrop-blur-xl",
          )}
        >
          <div className="whitespace-pre-wrap text-base leading-relaxed">{children}</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={animate ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="assistant-message flex w-full justify-start"
    >
      <div className="w-full max-w-[85%] text-base leading-relaxed text-foreground">{children}</div>
    </motion.div>
  );
}
