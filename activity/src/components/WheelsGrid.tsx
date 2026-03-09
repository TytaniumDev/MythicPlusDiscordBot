import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { WheelsGrid as WheelsGridClass } from '../lib/wheelsGrid';
import { WheelEntry } from '../types';

// Re-export the lib/ WheelsGrid type so consumers can access it
export type { WheelsGridClass };

export interface WheelsGridRef {
  grid: WheelsGridClass | null;
}

interface WheelsGridProps {
  pools?: { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] } | null;
}

export const WheelsGridComponent = forwardRef<WheelsGridRef, WheelsGridProps>(
  function WheelsGridComponent({ pools }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<WheelsGridClass | null>(null);

    useEffect(() => {
      if (!containerRef.current || gridRef.current) return;
      gridRef.current = new WheelsGridClass(containerRef.current);
    }, []);

    useImperativeHandle(ref, () => ({
      get grid() { return gridRef.current; },
    }), []);

    // Initialize wheels when pools change
    useEffect(() => {
      if (pools && gridRef.current) {
        gridRef.current.initWheels(pools);
      }
    }, [pools]);

    return <div id="wheels-area" className="wheels-content-area" ref={containerRef} />;
  }
);
