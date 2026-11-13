/** Something that can undo exactly what it changed. */
export interface Restorable {
  restore(): void;
}

interface AttributeOwner {
  readonly token: object;
  readonly value: string;
}

interface AttributeClaim {
  readonly original: string | null;
  owners: AttributeOwner[];
}

const claims = new WeakMap<Element, Map<string, AttributeClaim>>();

const claimsFor = (el: Element): Map<string, AttributeClaim> => {
  const existing = claims.get(el);
  if (existing) return existing;
  const created = new Map<string, AttributeClaim>();
  claims.set(el, created);
  return created;
};

/**
 * Sets an attribute and remembers the exact prior state. Several owners may claim the same
 * attribute (two adapters on one target): the newest claim wins the value, and the original
 * string comes back only when the last owner releases. A release is ignored if React changed
 * the attribute since the last write.
 */
export const ownAttribute = (el: Element, name: string, value: string): Restorable => {
  const byName = claimsFor(el);
  const claim: AttributeClaim = byName.get(name) ?? { original: el.getAttribute(name), owners: [] };
  byName.set(name, claim);
  const owner: AttributeOwner = { token: {}, value };
  claim.owners = [...claim.owners, owner];
  el.setAttribute(name, value);
  let released = false;
  return {
    restore: () => {
      if (released) return;
      released = true;
      const remaining = claim.owners.filter((item) => item.token !== owner.token);
      claim.owners = remaining;
      const lastWritten = el.getAttribute(name);
      const newest = remaining[remaining.length - 1];
      if (newest) {
        if (lastWritten === owner.value) el.setAttribute(name, newest.value);
        return;
      }
      byName.delete(name);
      if (lastWritten !== owner.value) return;
      if (claim.original === null) el.removeAttribute(name);
      else el.setAttribute(name, claim.original);
    },
  };
};

/** Runs every restorer, newest first, ignoring individual failures. */
export const restoreAll = (restorers: readonly Restorable[]): void => {
  for (const item of [...restorers].reverse()) {
    try {
      item.restore();
    } catch {
      // A detached or exotic node must not block restoring the rest.
    }
  }
};

/**
 * Sets one inline custom property (or style longhand) and restores the exact
 * original `style` attribute afterwards. Used for the theme nudge on <html>.
 */
export const ownStyleProperty = (el: HTMLElement, property: string, value: string): Restorable => {
  const original = el.getAttribute("style");
  el.style.setProperty(property, value);
  const applied = el.getAttribute("style");
  return {
    restore: () => {
      if (el.getAttribute("style") !== applied) return;
      if (original === null) el.removeAttribute("style");
      else el.setAttribute("style", original);
    },
  };
};
