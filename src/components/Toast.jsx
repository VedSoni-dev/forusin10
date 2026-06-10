import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";

export default function Toast({ toast }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex items-center gap-2.5 bg-slate-900 text-white rounded-full pl-3 pr-4 py-2.5 shadow-xl max-w-[340px]"
          >
            <span
              className={
                "inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 " +
                (toast.kind === "error" ? "bg-red-500/20" : "bg-emerald-500/20")
              }
            >
              {toast.kind === "error" ? (
                <AlertCircle size={13} className="text-red-400" />
              ) : (
                <Check size={13} className="text-emerald-400" />
              )}
            </span>
            <span className="text-[0.8rem] font-light leading-snug truncate">
              {toast.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
