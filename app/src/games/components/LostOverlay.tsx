import { motion, AnimatePresence } from 'framer-motion';

interface LostOverlayProps {
  onRestart: () => void;
}

export default function LostOverlay({ onRestart }: LostOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4"
        >
          <div className="text-4xl">🔥</div>
          <h2 className="text-2xl font-bold text-red-600">Game Over!</h2>
          <p className="text-slate-500 text-sm">You stepped into the lava</p>
          <button
            onClick={onRestart}
            className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-2 rounded-lg transition-colors text-sm mt-2"
          >
            Try Again
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
