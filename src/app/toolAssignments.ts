/** Tool IDs name a renderer; keys name individual placements of that renderer. */
export type ToolAssignment<Id extends string> = {
  key: number;
  tool: Id;
  collapsed: boolean;
  expanded: boolean;
};

export type ToolLayout<Id extends string> = {
  featured: ToolAssignment<Id>;
  gallery: ToolAssignment<Id>[];
};

export const MAX_GALLERY_TOOLS = 6;

function assignment<Id extends string>(
  key: number,
  tool: Id,
): ToolAssignment<Id> {
  return { key, tool, collapsed: false, expanded: false };
}

export function initialToolLayout<Id extends string>(
  featured: Id,
  gallery: readonly Id[],
): ToolLayout<Id> {
  if (gallery.length > MAX_GALLERY_TOOLS)
    throw new Error('Too many default gallery tools.');
  return {
    featured: assignment(0, featured),
    gallery: gallery.map((tool, index) => assignment(index + 1, tool)),
  };
}

export function addGalleryTool<Id extends string>(
  layout: ToolLayout<Id>,
  key: number,
  tool: Id,
): ToolLayout<Id> {
  if (layout.gallery.length >= MAX_GALLERY_TOOLS) return layout;
  if (
    layout.featured.key === key ||
    layout.gallery.some((item) => item.key === key)
  )
    throw new Error('Assignment keys must be unique.');
  return { ...layout, gallery: [...layout.gallery, assignment(key, tool)] };
}

export function removeGalleryTool<Id extends string>(
  layout: ToolLayout<Id>,
  key: number,
): ToolLayout<Id> {
  return {
    ...layout,
    gallery: layout.gallery.filter((item) => item.key !== key),
  };
}

export function moveGalleryTool<Id extends string>(
  layout: ToolLayout<Id>,
  key: number,
  direction: -1 | 1,
): ToolLayout<Id> {
  const index = layout.gallery.findIndex((item) => item.key === key);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= layout.gallery.length)
    return layout;
  const gallery = [...layout.gallery];
  [gallery[index], gallery[destination]] = [
    gallery[destination]!,
    gallery[index]!,
  ];
  return { ...layout, gallery };
}

/** An explicit catalog replacement keeps the featured placement and does not evict a card. */
export function replaceFeaturedTool<Id extends string>(
  layout: ToolLayout<Id>,
  tool: Id,
  eligible: readonly Id[],
): ToolLayout<Id> {
  if (!eligible.includes(tool)) return layout;
  return { ...layout, featured: { ...layout.featured, tool } };
}

/** Moving a card to the stage exchanges the two whole assignments, including keys/settings. */
export function featureGalleryTool<Id extends string>(
  layout: ToolLayout<Id>,
  key: number,
  eligible: readonly Id[],
): ToolLayout<Id> {
  const index = layout.gallery.findIndex((item) => item.key === key);
  if (index < 0 || !eligible.includes(layout.gallery[index]!.tool))
    return layout;
  const gallery = [...layout.gallery];
  const featured = gallery[index]!;
  gallery[index] = layout.featured;
  return { featured, gallery };
}

export function editTool<Id extends string>(
  layout: ToolLayout<Id>,
  key: number,
  change: Partial<Pick<ToolAssignment<Id>, 'tool' | 'collapsed' | 'expanded'>>,
): ToolLayout<Id> {
  return {
    featured:
      layout.featured.key === key
        ? { ...layout.featured, ...change }
        : layout.featured,
    gallery: layout.gallery.map((item) =>
      item.key === key ? { ...item, ...change } : item,
    ),
  };
}
