'use client';

import React from 'react';
import { HeroSection } from '../../components/marketing/HeroSection';
import { Services } from '../../components/marketing/Services';

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-24 pt-12 md:pt-20 relative">
      <HeroSection />
      <Services />
    </div>
  );
}
