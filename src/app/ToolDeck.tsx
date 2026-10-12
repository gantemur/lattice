import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addGalleryTool,
  editTool,
  featureGalleryTool,
  initialToolLayout,
  MAX_GALLERY_TOOLS,
  moveGalleryTool,
  nextGalleryTool,
  removeGalleryTool,
  replaceFeaturedTool,
} from './toolAssignments';

export type ToolDefinition<Id extends string> = {
  id: Id;
  title: string;
  kind: 'Visualization' | 'Plot' | 'Analysis';
  description: string;
  /** Omitted means suitable for the full-width stage. */
  featureable?: boolean;
};

/** Assignment operations own presentation only; renderTool reads existing snapshots. */
export function ToolDeck<Id extends string>({
  title,
  tools,
  featuredDefault,
  defaults,
  addPreference,
  renderTool,
  onRemove,
}: {
  title: string;
  tools: readonly ToolDefinition<Id>[];
  featuredDefault: Id;
  defaults: readonly Id[];
  /** Currently useful defaults in model order; every tool remains selectable. */
  addPreference?: readonly Id[];
  renderTool: (id: Id, assignmentKey: number) => ReactNode;
  onRemove?: (assignmentKey: number) => void;
}) {
  const eligible = tools.filter((tool) => tool.featureable !== false);
  const eligibleIds = eligible.map((tool) => tool.id);
  const nextKey = useRef(defaults.length + 1);
  const [layout, setLayout] = useState(() =>
    initialToolLayout(featuredDefault, defaults),
  );
  const [overview, setOverview] = useState(false);
  const [detailKey, setDetailKey] = useState(defaults.length ? 1 : -1);
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 700px)').matches
      : false,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const changed = () => setPhone(query.matches);
    query.addEventListener('change', changed);
    changed();
    return () => query.removeEventListener('change', changed);
  }, []);
  const detail = layout.gallery.some((item) => item.key === detailKey)
    ? detailKey
    : (layout.gallery[0]?.key ?? -1);
  const featuredDefinition = tools.find(
    (tool) => tool.id === layout.featured.tool,
  )!;

  return (
    <section
      className={`tool-deck ${overview ? 'tool-overview' : ''}`}
      aria-label={title}
    >
      <div className="tool-featured" data-testid="featured-tool">
        <div className="tool-featured-heading">
          <div>
            <small>FEATURED DISPLAY · FULL WIDTH</small>
            <h2>{featuredDefinition.title}</h2>
            <p>{featuredDefinition.description}</p>
          </div>
          <label>
            Replace featured tool
            <select
              aria-label={`${title} featured tool`}
              value={layout.featured.tool}
              onChange={(event) =>
                setLayout((current) =>
                  replaceFeaturedTool(
                    current,
                    event.target.value as Id,
                    eligibleIds,
                  ),
                )
              }
            >
              {eligible.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.kind}: {tool.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="plot-note">
          Choosing here replaces this featured assignment. Feature a gallery
          card below to exchange the two placements instead.
        </p>
        {/* Swapping containers can remount a renderer. Persistent local selections
            belong to its keyed assignment in the parent workspace. */}
        <div className="tool-body">
          {renderTool(layout.featured.tool, layout.featured.key)}
        </div>
      </div>

      <div className="tool-deck-controls">
        <h2>Measurements &amp; diagnostics</h2>
        <button
          type="button"
          className="button tool-add"
          disabled={layout.gallery.length >= MAX_GALLERY_TOOLS}
          onClick={() => {
            const key = nextKey.current++;
            setLayout((current) =>
              addGalleryTool(
                current,
                key,
                nextGalleryTool(
                  current,
                  tools.map((tool) => tool.id),
                  addPreference,
                ),
              ),
            );
            setDetailKey(key);
          }}
        >
          Add tool
        </button>
        <span className="plot-note tool-count">
          {layout.gallery.length}/6 tools
        </span>
        <button
          type="button"
          className="button tool-overview-toggle"
          aria-pressed={overview}
          onClick={() => setOverview(!overview)}
        >
          {overview ? 'Single detail' : 'Compact overview'}
        </button>
        <label className="tool-detail-select">
          Detail tool
          <select
            aria-label={`${title} detail tool`}
            value={detail}
            onChange={(event) => setDetailKey(Number(event.target.value))}
          >
            {layout.gallery.map((item, index) => (
              <option key={item.key} value={item.key}>
                {index + 1}.{' '}
                {tools.find((tool) => tool.id === item.tool)?.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {layout.gallery.length === 0 ? (
        <p className="tool-empty">
          No gallery tools are open. Add tool to inspect a measurement or
          analysis.
        </p>
      ) : (
        <div
          className={`tool-grid ${layout.gallery.filter((item) => !item.collapsed).length === 1 ? 'tool-grid-single' : ''}`}
        >
          {layout.gallery.map((item, index) => {
            const definition = tools.find((tool) => tool.id === item.tool)!;
            const canFeature = definition.featureable !== false;
            return (
              <section
                key={item.key}
                className={`tool-card ${item.expanded ? 'tool-expanded' : ''} ${item.collapsed ? 'tool-collapsed' : ''} ${item.key === detail ? 'tool-detail' : ''}`}
                aria-label={`${definition.title} tool`}
                data-testid="teaching-tool"
                data-assignment-key={item.key}
              >
                <div className="tool-card-heading">
                  <div>
                    <small>
                      {definition.kind} · {index + 1}
                    </small>
                    <h3 className="tool-overview-title">{definition.title}</h3>
                  </div>
                  <label className="tool-change">
                    Tool type
                    <select
                      aria-label={`Tool ${index + 1} type`}
                      value={item.tool}
                      onChange={(event) =>
                        setLayout((current) =>
                          editTool(current, item.key, {
                            tool: event.target.value as Id,
                          }),
                        )
                      }
                    >
                      {tools.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.kind}: {tool.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button tool-view-detail"
                    onClick={() => {
                      setDetailKey(item.key);
                      setOverview(false);
                    }}
                  >
                    View detail
                  </button>
                  <div className="tool-card-actions">
                    <button
                      type="button"
                      aria-label={`${definition.title}: Feature`}
                      disabled={!canFeature}
                      title={
                        canFeature
                          ? 'Exchange with featured display'
                          : 'Gallery only'
                      }
                      onClick={() => {
                        const oldFeatureKey = layout.featured.key;
                        setLayout((current) =>
                          featureGalleryTool(current, item.key, eligibleIds),
                        );
                        setDetailKey(oldFeatureKey);
                      }}
                    >
                      Feature
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: ${item.collapsed ? 'Open' : 'Collapse'}`}
                      onClick={() =>
                        setLayout((current) =>
                          editTool(current, item.key, {
                            collapsed: !item.collapsed,
                          }),
                        )
                      }
                    >
                      {item.collapsed ? 'Open' : 'Collapse'}
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: ${item.expanded ? 'Normal width' : 'Expand'}`}
                      onClick={() =>
                        setLayout((current) =>
                          editTool(current, item.key, {
                            expanded: !item.expanded,
                          }),
                        )
                      }
                    >
                      {item.expanded ? 'Normal' : 'Expand'}
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: Move earlier`}
                      disabled={index === 0}
                      onClick={() =>
                        setLayout((current) =>
                          moveGalleryTool(current, item.key, -1),
                        )
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: Move later`}
                      disabled={index === layout.gallery.length - 1}
                      onClick={() =>
                        setLayout((current) =>
                          moveGalleryTool(current, item.key, 1),
                        )
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: Remove`}
                      onClick={() => {
                        setLayout((current) =>
                          removeGalleryTool(current, item.key),
                        );
                        onRemove?.(item.key);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {/* An inactive phone detail is not an activated analysis. */}
                {!item.collapsed &&
                  (!phone || (!overview && item.key === detail)) && (
                    <div className="tool-body">
                      {renderTool(item.tool, item.key)}
                    </div>
                  )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
