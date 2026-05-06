import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DrVanceAvatar.css';

export type AvatarState = 'idle' | 'explain' | 'point_left' | 'point_right';

interface DrVanceAvatarProps {
  state: AvatarState;
  position: { x: number; y: number }; // Percentage 0-100 of the viewport
  visible: boolean;
}

const AVATAR_IMAGES = {
  idle: '/assets/avatar/vance_idle.png',
  explain: '/assets/avatar/vance_explain.png',
  point_left: '/assets/avatar/vance_point_left.png',
  point_right: '/assets/avatar/vance_point_right.png',
};

export const DrVanceAvatar: React.FC<DrVanceAvatarProps> = ({ state, position, visible }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="wb-mobile-avatar"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{
            opacity: 1,
            x: `calc(${position.x}vw - 50%)`, // Center the avatar on the X coordinate
            y: `calc(${position.y}vh - 100%)`, // Bottom-align the avatar to the Y coordinate
            scale: 1,
          }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 15,
            mass: 1.2,
          }}
        >
          {/* We use an inner div to handle the subtle breathing animation independently from movement */}
          <div className="wb-mobile-avatar-inner">
            <img 
              src={AVATAR_IMAGES[state]} 
              alt={`Dr. Vance ${state}`} 
              className="wb-mobile-avatar-img"
              draggable={false}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
