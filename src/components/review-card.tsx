import Image from "next/image";
import Link from "next/link";
import { Star } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Review } from '@/lib/types';
import { Icon } from './icons';
import { cn } from "@/lib/utils";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar>
          <AvatarImage src={review.avatarUrl} alt={review.username} />
          <AvatarFallback>{review.username.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-base font-semibold">{review.username}</CardTitle>
          <p className="text-sm text-muted-foreground">{review.handle}</p>
        </div>
        <Icon.Discord className="w-6 h-6 text-blue-400" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                key={i}
                className={cn(
                    "h-4 w-4",
                    i < review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"
                )}
                />
            ))}
        </div>
        <p className="text-sm text-foreground/80">{review.content}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground">
        {review.proofUrl && (
          <Link href={review.proofUrl} className="hover:text-primary transition-colors">
            View proof
          </Link>
        )}
        <span className={cn(!review.proofUrl && 'w-full text-right')}>{review.timestamp}</span>
      </CardFooter>
    </Card>
  );
}
