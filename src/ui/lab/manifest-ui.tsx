import type { ReactNode } from "react";
import { DitherButton } from "@/components/dithercn/dither-button";
import { DitherSlider } from "@/components/dithercn/dither-slider";
import { DitherSwitch } from "@/components/dithercn/dither-switch";
import { DitherTabs, DitherTabsContent, DitherTabsList, DitherTabsTrigger } from "@/components/dithercn/dither-tabs";
import { DitherCard } from "@/components/dithercn/dither-card";
import { Divider } from "@/components/dithercn/divider";
import { Loader } from "@/components/dithercn/loader";
import { Skeleton } from "@/components/dithercn/skeleton";
import { EmptyState } from "@/components/dithercn/empty-state";
import { NotFound } from "@/components/dithercn/not-found";
import { Dropzone } from "@/components/dithercn/dropzone";
import { Avatar } from "@/components/dithercn/avatar";
import { DitherText } from "@/components/dithercn/dither-text";
import { DissolveText } from "@/components/dithercn/dissolve-text";
import { ScrambleText } from "@/components/dithercn/scramble-text";
import { DitheredLogo } from "@/components/dithercn/dithered-logo";
import { LogoMarquee } from "@/components/dithercn/logo-marquee";
import { DitherImage } from "@/components/dithercn/dither-image";
import { ImageCompare } from "@/components/dithercn/image-compare";
import { ScrollRevealImage } from "@/components/dithercn/scroll-reveal-image";
import type { LabEntry } from "./entry";
import { SAMPLE_IMAGE } from "./sample-data";

const LOGOS = [{ src: SAMPLE_IMAGE, alt: "Sample A" }, { src: SAMPLE_IMAGE, alt: "Sample B" }];

const Stack = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-3">{children}</div>;

export const uiEntries: readonly LabEntry[] = [
  { file: "dither-button", title: "Dither button", render: () => <Stack><DitherButton variant="filled">Filled</DitherButton><DitherButton variant="outline">Outline</DitherButton></Stack> },
  { file: "dither-switch", title: "Dither switch", render: () => <Stack><DitherSwitch aria-label="Sample on" defaultChecked cell={2} /><DitherSwitch aria-label="Sample off" cell={2} /></Stack> },
  { file: "dither-slider", title: "Dither slider", render: () => <DitherSlider label="Intensity" defaultValue={[60]} max={100} cell={2} /> },
  {
    file: "dither-tabs",
    title: "Dither tabs",
    render: () => (
      <DitherTabs defaultValue="one" variant="pill" cell={2}>
        <DitherTabsList aria-label="Sample tabs">
          <DitherTabsTrigger value="one">One</DitherTabsTrigger>
          <DitherTabsTrigger value="two">Two</DitherTabsTrigger>
        </DitherTabsList>
        <DitherTabsContent value="one">Tab one</DitherTabsContent>
        <DitherTabsContent value="two">Tab two</DitherTabsContent>
      </DitherTabs>
    ),
  },
  { file: "dither-card", title: "Dither card", render: () => <DitherCard className="p-4 text-sm">Card surface</DitherCard> },
  { file: "divider", title: "Divider", render: () => <Divider label="Section" /> },
  { file: "loader", title: "Loader", render: () => <Loader label="Sample loading" /> },
  { file: "skeleton", title: "Skeleton", render: () => <Skeleton /> },
  { file: "empty-state", title: "Empty state", render: () => <EmptyState title="No data yet" /> },
  { file: "not-found", title: "Not found", render: () => <NotFound code="404" /> },
  { file: "dropzone", title: "Dropzone", render: () => <Dropzone className="p-4" /> },
  { file: "avatar", title: "Avatar", render: () => <Stack><Avatar name="Sample User" /></Stack> },
  { file: "dither-text", title: "Dither text", render: () => <DitherText className="text-3xl font-semibold">Dithered heading</DitherText> },
  { file: "dissolve-text", title: "Dissolve text", render: () => <DissolveText className="text-2xl font-semibold">Dissolving</DissolveText> },
  { file: "scramble-text", title: "Scramble text", render: () => <ScrambleText className="text-xl font-medium">Scrambled</ScrambleText> },
  { file: "dithered-logo", title: "Dithered logo", render: () => <DitheredLogo src={SAMPLE_IMAGE} alt="Sample logo" /> },
  { file: "logo-marquee", title: "Logo marquee", render: () => <LogoMarquee logos={LOGOS} /> },
  { file: "dither-image", title: "Dither image", render: () => <DitherImage src={SAMPLE_IMAGE} alt="Sample image" /> },
  { file: "image-compare", title: "Image compare", render: () => <ImageCompare src={SAMPLE_IMAGE} alt="Sample comparison" /> },
  { file: "scroll-reveal-image", title: "Scroll reveal image", render: () => <ScrollRevealImage src={SAMPLE_IMAGE} alt="Sample reveal" /> },
];
