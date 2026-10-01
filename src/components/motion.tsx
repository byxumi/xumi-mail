"use client";

// framer-motion 动画封装（统一采 Apple 风 spring 曲线）
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ReactNode } from "react";

const spring = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };
const springSoft = { type: "spring" as const, stiffness: 180, damping: 26, mass: 1 };

/** 页面容器：进入渐入 + 轻微上移 */
export function MotionPage({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      {children}
    </motion.div>
  );
}

/** 单元素渐入上移 */
export function FadeUp({
  children,
  delay = 0,
  y = 16,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay }}
    >
      {children}
    </motion.div>
  );
}

/** 交错列表容器：子项依次进入（配合 <MotionItem> 使用） */
export function MotionList({ children, className, gap = 0 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap }}>
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** 列表子项（配合 MotionList 的 stagger 动画） */
export function MotionItem({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div variants={itemVariants} className={className} style={style}>
      {children}
    </motion.div>
  );
}

/** 带过渡的显隐（AnimatePresence 包装） */
export function AnimatedPresence({ children }: { children: ReactNode }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}

/** 悬浮微交互卡（hover 抬升 + 阴影加深，Apple 风） */
export function HoverCard({
  children,
  className,
  style,
  whileHover = { y: -3 },
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  whileHover?: Parameters<typeof motion.div>[0]["whileHover"];
}) {
  return (
    <motion.div className={className} style={style} whileHover={whileHover} transition={spring}>
      {children}
    </motion.div>
  );
}

/** 品牌图标/Logo 弹入 */
export function LogoPop({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={spring}
    >
      {children}
    </motion.div>
  );
}

export { motion, spring, springSoft };