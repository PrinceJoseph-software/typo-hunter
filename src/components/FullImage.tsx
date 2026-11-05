import React from 'react';
import { Discovery } from '../db/database';
import { useDiscoveryImage } from '../hooks/useDiscoveryImage';

/** Renders a discovery's full-size photo, showing the thumbnail until it loads. */
export const FullImage: React.FC<{ discovery: Discovery; alt: string; className?: string }> = ({
  discovery,
  alt,
  className,
}) => {
  const src = useDiscoveryImage(discovery.id, discovery.thumbnail);
  return <img src={src} alt={alt} className={className} />;
};
