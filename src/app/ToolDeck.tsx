import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToolDefinition<Id extends string> = {
  id: Id;
  title: string;
  kind: 'Visualization' | 'Plot' | 'Analysis';
  description: string;
};
type Assignment<Id extends string> = {
  key: number;
  tool: Id;
  collapsed: boolean;
  expanded: boolean;
};

/** A bounded presentation deck. It owns assignments only: renderTool reads
 * existing snapshots, and no deck action can call a simulation client. */
export function ToolDeck<Id extends string>({
  title,
  tools,
  defaults,
  renderTool,
}: {
  title: string;
  tools: readonly ToolDefinition<Id>[];
  defaults: readonly Id[];
  renderTool: (id: Id) => ReactNode;
}) {
  const nextKey = useRef(defaults.length);
  const [assignments, setAssignments] = useState<Assignment<Id>[]>(() =>
    defaults.map((tool, key) => ({
      key,
      tool,
      collapsed: false,
      expanded: false,
    })),
  );
  const [choice, setChoice] = useState<Id>(tools[0]!.id);
  const [overview, setOverview] = useState(false);
  const [detailKey, setDetailKey] = useState(defaults.length ? 0 : -1);
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
  const detail = assignments.some((item) => item.key === detailKey)
    ? detailKey
    : (assignments[0]?.key ?? -1);

  function edit(key: number, change: Partial<Assignment<Id>>) {
    setAssignments((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }
  function move(key: number, direction: -1 | 1) {
    setAssignments((current) => {
      const index = current.findIndex((item) => item.key === key);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length)
        return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }
  return (
    <section
      className={`tool-deck ${overview ? 'tool-overview' : ''}`}
      aria-label={title}
    >
      <div className="tool-deck-controls">
        <h2>{title}</h2>
        <label>
          Add tool
          <select
            aria-label={`${title} add tool type`}
            value={choice}
            onChange={(event) => setChoice(event.target.value as Id)}
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
          className="button"
          disabled={assignments.length >= 6}
          onClick={() => {
            const key = nextKey.current++;
            setAssignments((current) => [
              ...current,
              { key, tool: choice, collapsed: false, expanded: false },
            ]);
            setDetailKey(key);
          }}
        >
          Add tool
        </button>
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
            {assignments.map((item, index) => (
              <option key={item.key} value={item.key}>
                {index + 1}.{' '}
                {tools.find((tool) => tool.id === item.tool)?.title}
              </option>
            ))}
          </select>
        </label>
        <span className="plot-note">{assignments.length}/6 tools</span>
      </div>
      {assignments.length === 0 ? (
        <p className="tool-empty">
          No tools are open. Choose a tool and Add tool.
        </p>
      ) : (
        <div className="tool-grid">
          {assignments.map((item, index) => {
            const definition = tools.find((tool) => tool.id === item.tool)!;
            return (
              <section
                key={item.key}
                className={`tool-card ${item.expanded ? 'tool-expanded' : ''} ${item.key === detail ? 'tool-detail' : ''}`}
                aria-label={`${definition.title} tool`}
                data-testid="teaching-tool"
              >
                <div className="tool-card-heading">
                  <div>
                    <small>
                      {definition.kind} · {index + 1}
                    </small>
                    <h3>{definition.title}</h3>
                    <p>{definition.description}</p>
                  </div>
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
                      aria-label={`${definition.title}: ${item.collapsed ? 'Open' : 'Collapse'}`}
                      onClick={() =>
                        edit(item.key, { collapsed: !item.collapsed })
                      }
                    >
                      {item.collapsed ? 'Open' : 'Collapse'}
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: ${item.expanded ? 'Normal width' : 'Expand'}`}
                      onClick={() =>
                        edit(item.key, { expanded: !item.expanded })
                      }
                    >
                      {item.expanded ? 'Normal' : 'Expand'}
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: Move earlier`}
                      disabled={index === 0}
                      onClick={() => move(item.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: Move later`}
                      disabled={index === assignments.length - 1}
                      onClick={() => move(item.key, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`${definition.title}: Remove`}
                      onClick={() =>
                        setAssignments((current) =>
                          current.filter((other) => other.key !== item.key),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <label className="tool-change">
                  Tool type
                  <select
                    aria-label={`Tool ${index + 1} type`}
                    value={item.tool}
                    onChange={(event) =>
                      edit(item.key, { tool: event.target.value as Id })
                    }
                  >
                    {tools.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.kind}: {tool.title}
                      </option>
                    ))}
                  </select>
                </label>
                {/* A hidden phone detail is not an activated analysis tool. */}
                {!item.collapsed &&
                  (!phone || (!overview && item.key === detail)) && (
                    <div className="tool-body">{renderTool(item.tool)}</div>
                  )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
