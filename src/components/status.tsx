"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CircleDashed, AlertTriangle, ShieldCheck, ChevronsUp, Star } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export type StatusInfo = {
  status: string;
  detectionInfo: string;
  lastUpdated: string;
};

export function Status() {
  const { dict } = useI18n();
  const t = dict.statusWidget;
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        setLoading(true);
        const result: StatusInfo = {
            status: t.operational,
            detectionInfo: t.detectionInfo,
            lastUpdated: t.lastUpdated
        };
        setStatus(result);
      } catch (e) {
        setStatus({
            status: t.operational,
            detectionInfo: t.detectionInfo,
            lastUpdated: t.lastUpdated
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [t.detectionInfo, t.lastUpdated, t.operational]);

  if (loading) {
    return (
        <Card className="w-full max-w-md mx-auto bg-card/70 backdrop-blur-sm border-primary/20">
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-5/6" />
                <Skeleton className="h-6 w-full" />
            </CardContent>
             <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    );
  }

  if (error) {
    return (
        <Card className="w-full max-w-md mx-auto border-destructive">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle />
                    {t.error}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>{error}</p>
            </CardContent>
        </Card>
    );
  }

  const isOperational = status?.status.includes("Operational") || status?.status.includes("работают");

  return (
    <Card className="w-full max-w-sm mx-auto bg-card/70 backdrop-blur-sm border-primary/20 shadow-xl shadow-primary/10">
        <CardHeader className="text-center">
            {isOperational ? (
                <div className="flex justify-center items-center gap-2 text-green-400">
                    <CheckCircle2 size={20} />
                    <CardTitle className="text-lg font-semibold">{status?.status}</CardTitle>
                </div>
            ) : (
                <div className="flex justify-center items-center gap-2 text-yellow-400">
                    <CircleDashed size={20} />
                    <CardTitle className="text-lg font-semibold">{status?.status}</CardTitle>
                </div>
            )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
                <p>
                    <span className="font-semibold text-foreground">{t.undetectedBold}</span>
                    <span className="text-muted-foreground"> {t.undetectedRest}</span>
                </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <ChevronsUp className="h-5 w-5 text-primary flex-shrink-0" />
                <p>
                    <span className="font-semibold text-foreground">{t.updatesBold}</span>
                    <span className="text-muted-foreground"> {t.updatesRest}</span>
                </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <Star className="h-5 w-5 text-primary flex-shrink-0" />
                <p>
                    <span className="font-semibold text-foreground">{t.accessBold}</span>
                    <span className="text-muted-foreground"> {t.accessRest}</span>
                </p>
            </div>
        </CardContent>
    </Card>
  );
}