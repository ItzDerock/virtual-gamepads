import type React from "react";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "../utils";

interface JoystickValue {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

interface JoystickProps {
  size?: number;
  knobSize?: number;
  onChange?: (value: JoystickValue) => void;
  className?: string;
}

export function Joystick({
  size = 150,
  knobSize = 50,
  onChange,
  className,
}: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const [dynamicCenter, setDynamicCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const activeTouchIdRef = useRef<number | null>(null);

  const joystickRadius = size / 2;
  const maxOffset = joystickRadius - knobSize / 2;

  const getRelativePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };

      const rect = containerRef.current.getBoundingClientRect();
      const containerCenterX = rect.left + rect.width / 2;
      const containerCenterY = rect.top + rect.height / 2;

      const centerX = dynamicCenter
        ? rect.left + dynamicCenter.x
        : containerCenterX;
      const centerY = dynamicCenter
        ? rect.top + dynamicCenter.y
        : containerCenterY;

      let offsetX = clientX - centerX;
      let offsetY = clientY - centerY;

      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      if (distance > maxOffset) {
        const scale = maxOffset / distance;
        offsetX *= scale;
        offsetY *= scale;
      }

      return { x: offsetX, y: offsetY };
    },
    [dynamicCenter, maxOffset],
  );

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerCenterX = rect.width / 2;
      const containerCenterY = rect.height / 2;

      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;

      const distFromCenter = Math.sqrt(
        Math.pow(relativeX - containerCenterX, 2) +
          Math.pow(relativeY - containerCenterY, 2),
      );

      if (distFromCenter <= joystickRadius) {
        setDynamicCenter(null);
        const position = getRelativePosition(clientX, clientY);
        setKnobPosition(position);
        onChange?.({
          x: position.x / maxOffset,
          y: -position.y / maxOffset,
        });
      } else {
        setDynamicCenter({ x: relativeX, y: relativeY });
        setKnobPosition({ x: 0, y: 0 });
        onChange?.({ x: 0, y: 0 });
      }

      setIsDragging(true);
    },
    [joystickRadius, maxOffset, getRelativePosition, onChange],
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;

      const position = getRelativePosition(clientX, clientY);
      setKnobPosition(position);
      onChange?.({
        x: position.x / maxOffset,
        y: -position.y / maxOffset,
      });
    },
    [isDragging, getRelativePosition, maxOffset, onChange],
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
    setKnobPosition({ x: 0, y: 0 });
    setDynamicCenter(null);
    activeTouchIdRef.current = null;
    onChange?.({ x: 0, y: 0 });
  }, [onChange]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    activeTouchIdRef.current = touch.identifier;
    handleStart(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);

    const onTouchMove = (e: TouchEvent) => {
      if (activeTouchIdRef.current === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === activeTouchIdRef.current) {
          handleMove(touch.clientX, touch.clientY);
          return;
        }
      }
    };

    const onMouseUp = () => handleEnd();

    const onTouchEnd = (e: TouchEvent) => {
      if (activeTouchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeTouchIdRef.current) {
          handleEnd();
          return;
        }
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const joystickStyle = dynamicCenter
    ? {
        left: dynamicCenter.x - joystickRadius,
        top: dynamicCenter.y - joystickRadius,
      }
    : {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <div
      ref={containerRef}
      className={cn("relative touch-none select-none", className)}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div
        className="absolute rounded-full bg-button-bg border-4 border-button-border"
        style={{
          width: size,
          height: size,
          ...joystickStyle,
        }}
      >
        <div
          className={cn(
            "absolute rounded-full bg-joystick-nipple shadow-lg transition-shadow",
            isDragging && "shadow-xs",
          )}
          style={{
            width: knobSize,
            height: knobSize,
            left: `calc(50% + ${knobPosition.x}px - ${knobSize / 2}px)`,
            top: `calc(50% + ${knobPosition.y}px - ${knobSize / 2}px)`,
          }}
        />
      </div>
    </div>
  );
}
