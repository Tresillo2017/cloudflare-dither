import { LayerCard, Link, Text } from "@cloudflare/kumo";

interface ImageCard {
  readonly src: string;
  readonly alt: string;
  readonly title: string;
}

const IMAGE_CARDS: readonly ImageCard[] = [
  { src: "/assets/screenshot.svg", alt: "Analytics screenshot", title: "Analytics preview" },
  { src: "/assets/hero.svg", alt: "Hero illustration", title: "Getting started" },
  { src: "/assets/avatar.svg", alt: "Team avatar", title: "Team" },
];

export function ImagesSection(): JSX.Element {
  return (
    <section aria-label="Cards and images" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {IMAGE_CARDS.map((card) => (
        <LayerCard key={card.title}>
          <LayerCard.Primary className="flex flex-col gap-2">
            <img src={card.src} alt={card.alt} className="h-32 w-full rounded-md object-cover" />
            <h2 className="text-base font-semibold text-kumo-default">{card.title}</h2>
            <Text variant="secondary">Sample card content used for adapter tests.</Text>
            <Link href="/legacy">Open legacy view</Link>
          </LayerCard.Primary>
        </LayerCard>
      ))}
    </section>
  );
}
