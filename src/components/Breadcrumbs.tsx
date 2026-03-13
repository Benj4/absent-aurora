import { Breadcrumb } from 'antd';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

const Breadcrumbs = ({ items }: Props) => {
  return (
    <Breadcrumb 
      style={{ maxHeight: '22px', overflowY: 'hidden' }}
      items={items.map(item => ({
        title: item.href ? <a href={item.href}>{item.label}</a> : item.label,
      }))}
    />
  );
};

export default Breadcrumbs;
