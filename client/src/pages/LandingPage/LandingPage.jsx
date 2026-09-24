import HeroSection from './HeroSection';
import AboutSection from './AboutSection';
import FeaturesSection from './FeaturesSection';
import BlogSection from './BlogSection';
import ContactSection from './ContactSection';
import PricingSection from './PricingSection';

import Background from '../../components/Background';

const LandingPage = () => {
    return (
        <main className="relative">
            <Background />
            <HeroSection />
            <AboutSection />
            <FeaturesSection />
            <PricingSection />
            <BlogSection />
            <ContactSection />
        </main>
    );
};

export default LandingPage;
