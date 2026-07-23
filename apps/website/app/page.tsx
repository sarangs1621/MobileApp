import {
  About,
  Academics,
  Facilities,
  Glance,
  Hero,
  TrustBar,
} from "@/src/components/home/sections-a";
import {
  AdmissionsCTA,
  News,
  Principal,
  Testimonials,
  Timeline,
} from "@/src/components/home/sections-b";

export default function HomePage() {
  return (
    <div>
      <Hero />
      <TrustBar />
      <About />
      <Glance />
      <Academics />
      <Facilities />
      <Timeline />
      <Principal />
      <Testimonials />
      <News />
      <AdmissionsCTA />
    </div>
  );
}
