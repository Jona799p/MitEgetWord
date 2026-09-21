import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './WordApplication.module.css';

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  minWidth?: string | number;
}

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  minWidth = '200px',
}) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const calcPos = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const parsedWidth = typeof minWidth === 'number' ? minWidth : (parseInt(String(minWidth), 10) || 220);
      const measuredWidth = menuRef.current?.offsetWidth || parsedWidth;

      let left = rect.left;
      // Adjust if overflowing viewport on the right
      if (left + measuredWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - measuredWidth - 12);
      }

      setCoords({
        top: rect.bottom + 4,
        left: Math.max(12, left),
      });
    };

    calcPos();
    const raf = requestAnimationFrame(calcPos);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, triggerRef, minWidth]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      onClose();
    };

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !coords) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={styles.exportDropdownMenu}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        minWidth,
        zIndex: 999999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};

export default PortalDropdown;
