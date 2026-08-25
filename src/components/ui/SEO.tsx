import React, { useEffect } from 'react';
import { useMetaTags } from '../../contexts/MetaTagsContext';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
  image?: string;
  canonical?: string;
  type?: 'website' | 'article' | 'profile';
  structuredData?: object;
  noindex?: boolean;
}

const SEO: React.FC<SEOProps> = ({ 
  title, 
  description, 
  keywords,
  image,
  canonical,
  type = 'website',
  structuredData,
  noindex = false
}) => {
  const { setMeta } = useMetaTags();

  const structuredDataString = structuredData ? JSON.stringify(structuredData) : '';

  useEffect(() => {
    setMeta({
      title,
      description,
      keywords,
      image,
      canonical,
      type,
      structuredData: structuredDataString ? JSON.parse(structuredDataString) : undefined,
      noindex
    });
  }, [title, description, keywords, image, canonical, type, structuredDataString, noindex, setMeta]);

  return null;
};

export default SEO;

