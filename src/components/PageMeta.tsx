import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  title: string;
  description?: string;
}

const PageMeta = ({ title, description }: PageMetaProps) => (
  <Helmet>
    <title>{title} | BlueRiver Services</title>
    {description && <meta name="description" content={description} />}
  </Helmet>
);

export default PageMeta;
