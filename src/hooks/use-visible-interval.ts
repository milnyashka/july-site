'use client';

import { useEffect, useRef } from 'react';
import { usePageVisible } from './use-page-visible';

export function useVisibleInterval(callback: () => void, delayMs: number | null) {
  const savedCallback = useRef(callback);
  const visible = usePageVisible();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!visible || delayMs === null) return;

    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), delayMs);
    return () => clearInterval(id);
  }, [visible, delayMs]);
}