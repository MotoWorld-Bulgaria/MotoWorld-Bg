import Navbar from "@/components/navbar"
import HeroSection from "@/components/hero-section"
import MotorcycleSection from "@/components/motorcycle-section"
import AboutSection from "@/components/about-section"
import ContactSection from "@/components/contact-section"

export default function Home() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <MotorcycleSection />
      <AboutSection />
      <ContactSection />
    </main>
  )
}
