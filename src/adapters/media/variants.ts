/**
 * Read-only view of which adapters are switched on, via the core's debug handle.
 * Used so that competing treatments of the same element (image vs. its variants)
 * do not both mount. Any failure reads as "off".
 */
const CORE_HANDLE_KEY = "cloudflare-dither.core";

interface RegistryView {
  list(): readonly { readonly id: string; readonly enabled: boolean }[];
}

export const isAdapterOn = (adapterId: string): boolean => {
  try {
    const handle = (document as unknown as Record<symbol, { registry?: RegistryView } | undefined>)[
      Symbol.for(CORE_HANDLE_KEY)
    ];
    return handle?.registry?.list().some((info) => info.id === adapterId && info.enabled) ?? false;
  } catch {
    return false;
  }
};
