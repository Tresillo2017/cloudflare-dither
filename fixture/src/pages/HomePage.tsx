import { AppShell } from "../app/AppShell";
import { HomeHeader } from "./home/HomeHeader";
import { KpiSection } from "./home/KpiSection";
import { ChartsSection } from "./home/ChartsSection";
import { UsageSection } from "./home/UsageSection";
import { ZonesSection } from "./home/ZonesSection";
import { ControlsSection } from "./home/ControlsSection";
import { LoadingSection } from "./home/LoadingSection";
import { EmptySection } from "./home/EmptySection";
import { UploadSection } from "./home/UploadSection";
import { OverlaysSection } from "./home/OverlaysSection";
import { ImagesSection } from "./home/ImagesSection";
import { HomeFooter } from "./home/HomeFooter";

export function HomePage(): JSX.Element {
  return (
    <AppShell>
      <HomeHeader />
      <KpiSection />
      <hr className="border-kumo-line" />
      <ChartsSection />
      <hr className="border-kumo-line" />
      <UsageSection />
      <hr className="border-kumo-line" />
      <ZonesSection />
      <hr className="border-kumo-line" />
      <ControlsSection />
      <hr className="border-kumo-line" />
      <LoadingSection />
      <hr className="border-kumo-line" />
      <EmptySection />
      <hr className="border-kumo-line" />
      <UploadSection />
      <hr className="border-kumo-line" />
      <OverlaysSection />
      <hr className="border-kumo-line" />
      <ImagesSection />
      <hr className="border-kumo-line" />
      <HomeFooter />
    </AppShell>
  );
}
