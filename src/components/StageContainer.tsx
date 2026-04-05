import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StageContainerProps {
    children: ReactNode;
    stageKey: string;
}

export function StageContainer({ children, stageKey }: StageContainerProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={stageKey}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
