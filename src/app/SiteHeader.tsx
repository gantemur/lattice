type Workspace = 'small' | 'lattice' | 'qm' | 'fields' | 'experiments';

const destinations: { id: Workspace; href: string; label: string }[] = [
  { id: 'small', href: '#small-systems', label: 'Small Systems' },
  { id: 'lattice', href: '#lattice-systems', label: 'Lattice Systems' },
  { id: 'qm', href: '#lattice-qm', label: 'Lattice QM' },
  { id: 'fields', href: '#fields-paths', label: 'Lattice Fields' },
  { id: 'experiments', href: '#experiments', label: 'Experiments' },
];

/** One navigation contract for all five mounted, independent workspaces. */
export function SiteHeader({
  active,
  archiveCount = 0,
}: {
  active: Workspace;
  archiveCount?: number;
}) {
  return (
    <header className="site-header">
      <a className="brand" href="#small-systems" aria-label="Lattice Lab home">
        <span className="brand-mark" aria-hidden="true">
          ▦
        </span>
        <span>
          Lattice <strong>Lab</strong>
        </span>
      </a>
      <nav aria-label="Workspaces">
        {destinations.map(({ id, href, label }) => (
          <a
            key={id}
            href={href}
            className={id === active ? 'nav-active' : undefined}
            aria-current={id === active ? 'page' : undefined}
          >
            {label}
            {id === 'experiments' && archiveCount > 0
              ? ` (${archiveCount})`
              : ''}
          </a>
        ))}
      </nav>
      <a className="source-link" href="https://github.com/gantemur/lattice">
        Source ↗
      </a>
    </header>
  );
}
