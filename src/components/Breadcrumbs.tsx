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
    <div className="breadcrumbs text-sm px-4 py-1 border-b border-base-200">
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Breadcrumbs;
