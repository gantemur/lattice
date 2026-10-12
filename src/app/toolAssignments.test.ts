import { describe, expect, it } from 'vitest';
import {
  addGalleryTool,
  editTool,
  featureGalleryTool,
  initialToolLayout,
  moveGalleryTool,
  nextGalleryTool,
  removeGalleryTool,
  replaceFeaturedTool,
} from './toolAssignments';

type Tool = 'profile' | 'spectrum' | 'inspection' | 'update';
const eligible: Tool[] = ['profile', 'spectrum', 'inspection'];

describe('featured and gallery assignments', () => {
  it('starts with a distinct featured assignment and one optional card', () => {
    const layout = initialToolLayout<Tool>('profile', ['inspection']);
    expect(layout.featured).toMatchObject({ key: 0, tool: 'profile' });
    expect(layout.gallery).toMatchObject([{ key: 1, tool: 'inspection' }]);
  });

  it('allows six gallery cards independently of the feature, but no seventh', () => {
    let layout = initialToolLayout<Tool>('profile', []);
    for (let key = 1; key <= 6; key++)
      layout = addGalleryTool(layout, key, 'spectrum');
    expect(layout.gallery).toHaveLength(6);
    expect(addGalleryTool(layout, 7, 'update')).toBe(layout);
    expect(layout.featured.key).toBe(0);
  });

  it('adds, moves and removes cards without changing the feature', () => {
    const start = initialToolLayout<Tool>('profile', ['inspection']);
    const added = addGalleryTool(start, 2, 'spectrum');
    expect(moveGalleryTool(added, 2, -1).gallery.map((x) => x.key)).toEqual([
      2, 1,
    ]);
    expect(removeGalleryTool(added, 1).gallery.map((x) => x.key)).toEqual([2]);
    expect(added.featured).toEqual(start.featured);
  });

  it('keeps unique assignment keys even when tool IDs repeat', () => {
    const start = initialToolLayout<Tool>('profile', ['profile']);
    expect(start.featured.tool).toBe(start.gallery[0]!.tool);
    expect(start.featured.key).not.toBe(start.gallery[0]!.key);
    expect(() => addGalleryTool(start, 1, 'profile')).toThrow(/unique/);
  });

  it('replaces the featured tool explicitly without evicting a full gallery', () => {
    let layout = initialToolLayout<Tool>('profile', []);
    for (let key = 1; key <= 6; key++)
      layout = addGalleryTool(layout, key, 'inspection');
    const replaced = replaceFeaturedTool(layout, 'spectrum', eligible);
    expect(replaced.featured).toMatchObject({ key: 0, tool: 'spectrum' });
    expect(replaced.gallery).toEqual(layout.gallery);
  });

  it('swaps whole assignments, including their presentation flags', () => {
    let layout = initialToolLayout<Tool>('profile', ['spectrum']);
    layout = editTool(layout, 1, { collapsed: true, expanded: true });
    const swapped = featureGalleryTool(layout, 1, eligible);
    expect(swapped.featured).toMatchObject({
      key: 1,
      tool: 'spectrum',
      collapsed: true,
      expanded: true,
    });
    expect(swapped.gallery[0]).toEqual(layout.featured);
    expect(
      new Set([swapped.featured.key, ...swapped.gallery.map((x) => x.key)])
        .size,
    ).toBe(2);
  });

  it('rejects ineligible and stale feature commands without a state change', () => {
    const layout = initialToolLayout<Tool>('profile', ['update']);
    expect(featureGalleryTool(layout, 1, eligible)).toBe(layout);
    expect(featureGalleryTool(layout, 999, eligible)).toBe(layout);
    expect(replaceFeaturedTool(layout, 'update', eligible)).toBe(layout);
  });
});

describe('Add tool defaults', () => {
  const order: Tool[] = ['profile', 'inspection', 'spectrum', 'update'];

  it('skips featured and gallery types until each suitable type is represented', () => {
    let layout = initialToolLayout<Tool>('profile', ['inspection']);
    expect(nextGalleryTool(layout, order)).toBe('spectrum');
    layout = addGalleryTool(layout, 2, nextGalleryTool(layout, order));
    expect(nextGalleryTool(layout, order)).toBe('update');
  });

  it('uses a useful duplicate once every suitable type is represented', () => {
    const layout = initialToolLayout<Tool>('profile', [
      'inspection',
      'spectrum',
    ]);
    expect(nextGalleryTool(layout, order, ['profile', 'inspection'])).toBe(
      'inspection',
    );
  });

  it('defers an inapplicable Fourier view without hiding its explicit choice', () => {
    const layout = initialToolLayout<Tool>('profile', ['inspection']);
    expect(
      nextGalleryTool(layout, order, ['profile', 'inspection', 'update']),
    ).toBe('update');
    expect(order).toContain('spectrum');
  });

  it('keeps the six-card limit even when the default is a duplicate', () => {
    let layout = initialToolLayout<Tool>('profile', []);
    for (let key = 1; key <= 6; key++)
      layout = addGalleryTool(layout, key, nextGalleryTool(layout, order));
    expect(layout.gallery).toHaveLength(6);
    expect(addGalleryTool(layout, 7, nextGalleryTool(layout, order))).toBe(
      layout,
    );
  });
});
