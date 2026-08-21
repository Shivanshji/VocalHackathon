export interface NavLink {
  id: string;
  label: string;
  href: string;
}

export interface FeatureCard {
  id: string;
  number: string;
  title: string;
  description: string;
  tag: string;
  iconName: string;
  codeSnippet?: string;
  metricHighlight?: string;
}

export interface MetricItem {
  id: string;
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  description: string;
  trend: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  content: string;
  platform: 'x' | 'linkedin' | 'verified';
  handle: string;
}

export interface PressLogo {
  id: string;
  name: string;
  fontStyle?: string;
}

export interface LandingContent {
  brandName: string;
  brandTagline: string;
  navLinks: NavLink[];
  hero: {
    badgePillText: string;
    badgePillLinkText: string;
    headline: string;
    headlineHighlight: string;
    description: string;
    primaryCtaText: string;
    secondaryCtaText: string;
  };
  featuresHeading: {
    sectionTag: string;
    title: string;
    description: string;
  };
  features: FeatureCard[];
  metricsHeading: {
    sectionTag: string;
    title: string;
    description: string;
  };
  metrics: MetricItem[];
  testimonialsHeading: {
    sectionTag: string;
    title: string;
    description: string;
  };
  pressLogos: PressLogo[];
  testimonialsLane1: TestimonialItem[];
  testimonialsLane2: TestimonialItem[];
  finalCta: {
    badgeText: string;
    headline: string;
    description: string;
    primaryCtaText: string;
    secondaryCtaText: string;
    footnote: string;
  };
  footer: {
    copyright: string;
    links: { label: string; href: string }[];
  };
}
