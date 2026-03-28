import { motion, AnimatePresence } from 'framer-motion';

interface WinOverlayProps {
  moveCount: number;
  onRestart: () => void;
  onNextLevel?: () => void;
}

export default function WinOverlay({ moveCount, onRestart, onNextLevel }: WinOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 rounded"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4"
        >
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800">Level Complete!</h2>
          <p className="text-slate-500 text-sm">Solved in {moveCount} moves</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={onRestart}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Restart
            </button>
            {onNextLevel && (
              <button
                onClick={onNextLevel}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Next Level →
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
