'use client';

import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface GoogleAdUnitProps {
  client?: string;
  slot?: string;
  format?: string;
  responsive?: string;
  className?: string;
}

export function GoogleAdUnit({
  client = 'ca-pub-6910725183348370',
  slot = '7828550365',
  format = 'auto',
  responsive = 'true',
  className = '',
}: GoogleAdUnitProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && adRef.current) {
        if (!adRef.current.getAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      }
    } catch (err) {
      console.error('AdSense push error:', err);
    }
  }, []);

  return (
    <div className={`w-full text-center overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}
