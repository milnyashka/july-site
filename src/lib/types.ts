import type { StaticImageData } from "next/image";

export type Product = {
  id: string;
  name: string;
  description: string;
  priceMin: number;
  priceMax: number;
  image: string;
  rating: number;
  reviewsCount: number;
  tags: ('MOST POPULAR' | 'FEATURED')[];
};

export type Review = {
  id: string;
  source: 'Discord';
  username: string;
  handle: string;
  avatarUrl: string;
  rating: number;
  content: string;
  timestamp: string;
  proofUrl?: string;
};
