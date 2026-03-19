import { Link } from '@/i18n/navigation';
import { NotFoundContent } from '@/components/NotFoundContent';

export default function Localized404Page() {
  return <NotFoundContent linkComponent={Link} homeHref={{ pathname: '/' }} modelsHref={{ pathname: '/models' }} />;
}
