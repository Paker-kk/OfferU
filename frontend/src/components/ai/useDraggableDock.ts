"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

type DockPosition = {
  x: number;
  y: number;
};

type DragState = {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type UseDraggableDockOptions = {
  margin?: number;
  width?: number;
  height?: number;
};

type DragHandleOptions = {
  allowInteractiveTarget?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function useDraggableDock<TElement extends HTMLElement = HTMLElement>(options: UseDraggableDockOptions = {}) {
  const { margin = 12, width = 440, height = 560 } = options;
  const dockRef = useRef<TElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState<DockPosition | null>(null);

  const clampPosition = useCallback(
    (next: DockPosition, dragWidth = width, dragHeight = height): DockPosition => {
      if (typeof window === "undefined") return next;
      const maxX = window.innerWidth - Math.min(dragWidth, window.innerWidth - margin * 2) - margin;
      const maxY = window.innerHeight - Math.min(dragHeight, window.innerHeight - margin * 2) - margin;
      return {
        x: clamp(next.x, margin, maxX),
        y: clamp(next.y, margin, maxY),
      };
    },
    [height, margin, width]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
        drag.moved = true;
        suppressClickRef.current = true;
      }
      setPosition(
        clampPosition(
          {
            x: event.clientX - drag.offsetX,
            y: event.clientY - drag.offsetY,
          },
          drag.width,
          drag.height
        )
      );
    },
    [clampPosition]
  );

  const handlePointerUp = useCallback(() => {
    const moved = dragRef.current?.moved;
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    if (moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, [handlePointerMove]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, handleOptions: DragHandleOptions = {}) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (!handleOptions.allowInteractiveTarget && target.closest("button,a,input,textarea,select,[role='button']")) {
        return;
      }

      const handleBounds = event.currentTarget.getBoundingClientRect();
      const bounds = dockRef.current?.getBoundingClientRect() ?? handleBounds;
      const current = position ?? {
        x: bounds.left,
        y: bounds.top,
      };
      const dragWidth = bounds.width || width;
      const dragHeight = bounds.height || height;
      const clamped = clampPosition(current, dragWidth, dragHeight);

      dragRef.current = {
        offsetX: event.clientX - clamped.x,
        offsetY: event.clientY - clamped.y,
        width: dragWidth,
        height: dragHeight,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [clampPosition, handlePointerMove, handlePointerUp, height, position, width]
  );

  const getDragHandleProps = useCallback(
    (handleOptions: DragHandleOptions = {}) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => startDrag(event, handleOptions),
    }),
    [startDrag]
  );

  const consumeDragClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const bounds = dockRef.current?.getBoundingClientRect();
      setPosition((prev) => (prev ? clampPosition(prev, bounds?.width ?? width, bounds?.height ?? height) : prev));
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [clampPosition, handlePointerMove, handlePointerUp, height, width]);

  const dockStyle: CSSProperties | undefined = position
    ? {
        left: position.x,
        top: position.y,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  return {
    dockRef,
    dockStyle,
    dragHandleProps: getDragHandleProps(),
    launcherDragHandleProps: getDragHandleProps({ allowInteractiveTarget: true }),
    consumeDragClick,
  };
}
