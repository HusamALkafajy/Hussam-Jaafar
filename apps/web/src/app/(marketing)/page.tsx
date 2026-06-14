'use client';

import React from 'react';
import { HeroSection } from '../../components/marketing/HeroSection';
import { Services } from '../../components/marketing/Services';
import { Pricing } from '../../components/marketing/Pricing';

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-24 py-12 md:py-20 relative">
      <HeroSection />
      <Services />
      <Pricing />
    </div>
  );
}
