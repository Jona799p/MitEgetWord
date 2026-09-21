import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { AlignLeft, AlignCenter, AlignRight, Trash2, Move } from 'lucide-react';
import styles from './ResizableImage.module.css';

interface ImageAttrs {
  src: string;
  alt?: string;
  title?: string;
  width?: number | string | null;
  alignment?: 'left' | 'center' | 'right';
}

const ResizableImageComponent: React.FC<any> = ({
  node,
  updateAttributes,
  selected,
  deleteNode,
  editor,
  getPos,
}) => {
  const { src, alt, title, width, alignment = 'center' } = node.attrs as ImageAttrs;
  const [isFocused, setIsFocused] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | string | null>(width || null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentWidth(width || null);
  }, [width]);

  const isSelected = selected || isFocused;

  const handleSelectNode = () => {
    setIsFocused(true);
    if (typeof getPos === 'function' && editor) {
      try {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos);
        }
      } catch (err) {
        console.warn('Fejl ved valg af billednode:', err);
      }
    }
  };

  // Handle clicking outside to defocus image
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResizeStart = (e: React.MouseEvent, corner: 'BR' | 'BL' | 'TR' | 'TL') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const initialWidth = imgRef.current?.offsetWidth || 300;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let deltaX = moveEvent.clientX - startX;
      if (corner === 'BL' || corner === 'TL') {
        deltaX = -deltaX;
      }
      const newWidth = Math.max(80, Math.min(initialWidth + deltaX, 850));
      setCurrentWidth(newWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      let deltaX = upEvent.clientX - startX;
      if (corner === 'BL' || corner === 'TL') {
        deltaX = -deltaX;
      }
      const finalWidth = Math.max(80, Math.min(initialWidth + deltaX, 850));
      updateAttributes({ width: Math.round(finalWidth) });
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSetAlignment = (align: 'left' | 'center' | 'right') => {
    updateAttributes({ alignment: align });
  };

  const handleSetWidthPercent = (percent: number) => {
    if (percent === 100) {
      updateAttributes({ width: '100%' });
      setCurrentWidth('100%');
    } else {
      const containerWidth = 800;
      const targetPx = Math.round((containerWidth * percent) / 100);
      updateAttributes({ width: targetPx });
      setCurrentWidth(targetPx);
    }
  };

  const imgStyle: React.CSSProperties = {
    width: (typeof currentWidth === 'number' || (typeof currentWidth === 'string' && /^\d+$/.test(currentWidth)))
      ? `${currentWidth}px` 
      : (currentWidth || 'auto'),
    maxWidth: '100%',
    minWidth: '80px',
    minHeight: '40px',
  };

  return (
    <NodeViewWrapper 
      className={`${styles.nodeWrapper} ${styles[`align-${alignment}`] || styles['align-center']}`}
    >
      <div 
        ref={containerRef}
        className={`${styles.imageContainer} ${isSelected ? styles.isSelected : ''}`}
        onClick={handleSelectNode}
        onMouseDown={handleSelectNode}
      >
        {/* Floating Quick Action Toolbar */}
        {(isSelected || isResizing) && (
          <div className={styles.floatingToolbar} onClick={(e) => e.stopPropagation()}>
            {/* Dedicated Drag / Move Handle */}
            <button
              type="button"
              className={styles.toolbarBtn}
              data-drag-handle
              onMouseDown={handleSelectNode}
              title="Hold nede og træk for at flytte billedet"
              style={{ cursor: 'grab' }}
            >
              <Move size={13} />
              <span>Flyt</span>
            </button>

            <div className={styles.toolbarDivider} />

            {/* Alignment Options */}
            <button
              type="button"
              className={`${styles.toolbarBtn} ${alignment === 'left' ? styles.activeBtn : ''}`}
              onClick={() => handleSetAlignment('left')}
              title="Venstrejusteret (Tekst flyder omkring)"
            >
              <AlignLeft size={13} />
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${alignment === 'center' ? styles.activeBtn : ''}`}
              onClick={() => handleSetAlignment('center')}
              title="Centreret"
            >
              <AlignCenter size={13} />
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${alignment === 'right' ? styles.activeBtn : ''}`}
              onClick={() => handleSetAlignment('right')}
              title="Højrejusteret (Tekst flyder omkring)"
            >
              <AlignRight size={13} />
            </button>

            <div className={styles.toolbarDivider} />

            {/* Quick Size Presets */}
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => handleSetWidthPercent(25)}
              title="Lille (25%)"
            >
              25%
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => handleSetWidthPercent(50)}
              title="Mellem (50%)"
            >
              50%
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => handleSetWidthPercent(75)}
              title="Stor (75%)"
            >
              75%
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => handleSetWidthPercent(100)}
              title="Fuld bredde (100%)"
            >
              100%
            </button>

            <div className={styles.toolbarDivider} />

            {/* Delete Image */}
            <button
              type="button"
              className={`${styles.toolbarBtn} ${styles.deleteBtn}`}
              onClick={deleteNode}
              title="Slet billede"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* Image Element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          title={title || ''}
          style={imgStyle}
          className={styles.imageEl}
          draggable
          data-drag-handle
          onMouseDown={handleSelectNode}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.border = '2px dashed rgba(255,255,255,0.2)';
            target.style.minWidth = '120px';
            target.style.minHeight = '60px';
          }}
        />

        {/* Interactive Resize Handles */}
        {isSelected && (
          <>
            <div 
              className={`${styles.resizeHandle} ${styles.handleTL}`} 
              onMouseDown={(e) => handleResizeStart(e, 'TL')} 
              title="Træk for at ændre størrelse"
            />
            <div 
              className={`${styles.resizeHandle} ${styles.handleTR}`} 
              onMouseDown={(e) => handleResizeStart(e, 'TR')} 
              title="Træk for at ændre størrelse"
            />
            <div 
              className={`${styles.resizeHandle} ${styles.handleBL}`} 
              onMouseDown={(e) => handleResizeStart(e, 'BL')} 
              title="Træk for at ændre størrelse"
            />
            <div 
              className={`${styles.resizeHandle} ${styles.handleBR}`} 
              onMouseDown={(e) => handleResizeStart(e, 'BR')} 
              title="Træk for at ændre størrelse"
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  name: 'image',
  inline: false,
  group: 'block',

  addOptions() {
    return {
      ...(this.parent?.() as any),
      allowBase64: true,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const widthAttr = element.getAttribute('width');
          if (widthAttr) {
            return /^\d+$/.test(widthAttr) ? parseInt(widthAttr, 10) : widthAttr;
          }
          const styleWidth = element.style.width;
          if (styleWidth) return styleWidth.endsWith('px') ? parseInt(styleWidth, 10) : styleWidth;
          return null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          const widthVal = typeof attributes.width === 'number' ? `${attributes.width}px` : attributes.width;
          return {
            width: attributes.width,
            style: `width: ${widthVal}; max-width: 100%;`,
          };
        },
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => {
          return element.getAttribute('data-align') || 'center';
        },
        renderHTML: (attributes) => {
          const align = attributes.alignment || 'center';
          let alignStyle = 'display: block; margin: 16px auto;';
          if (align === 'left') {
            alignStyle = 'display: block; margin: 16px auto 16px 0;';
          } else if (align === 'right') {
            alignStyle = 'display: block; margin: 16px 0 16px auto;';
          }
          return {
            'data-align': align,
            style: alignStyle,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

export default ResizableImage;
