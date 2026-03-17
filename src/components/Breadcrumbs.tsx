export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

const Breadcrumbs = ({ items }: Props) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="bg-base-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-2">
        <div className="breadcrumbs text-sm text-base-content/70">
          <ul>
            {items.map((item, index) => (
              <li key={index}>
                {item.href ? (
                  <a className="link link-hover" href={item.href}>{item.label}</a>
                ) : (
                  <span className="text-base-content">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Breadcrumbs;
