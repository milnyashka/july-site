'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  MARKETPLACE_CATEGORIES,
  calcSellerPayout,
  type MarketplaceCategory,
  type MarketplaceListing,
  type MarketplacePurchase,
} from '@/lib/marketplace';
import { formatMoney } from '@/lib/currency';
import { useAuth } from '@/components/auth-provider';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { useToast } from '@/hooks/use-toast';

export default function MarketplaceSellPage() {
  const { locale, dict } = useI18n();
  const m = dict.marketplace;
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [titleRu, setTitleRu] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descriptionRu, setDescriptionRu] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [deliveryContent, setDeliveryContent] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('other');
  const [submitting, setSubmitting] = useState(false);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [sales, setSales] = useState<MarketplacePurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = profile?.currency === 'rub' ? 'rub' : 'usd';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(localizedPath(locale, '/login'));
    }
  }, [authLoading, user, router, locale]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetch('/api/marketplace/my')
      .then((r) => r.json())
      .then((data) => {
        setListings(data.listings ?? []);
        setSales(data.sales ?? []);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const reload = async () => {
    const data = await fetch('/api/marketplace/my').then((r) => r.json());
    setListings(data.listings ?? []);
    setSales(data.sales ?? []);
  };

  const handleCreate = async (publish: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleRu,
          titleEn,
          descriptionRu,
          descriptionEn,
          deliveryContent,
          price: Number(price),
          category,
          publish,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errKey = data.error as keyof typeof m.errors;
        toast({ title: m.errors[errKey] ?? m.createFailed, variant: 'destructive' });
        return;
      }

      toast({ title: publish ? m.published : m.savedDraft });
      setTitleRu('');
      setTitleEn('');
      setDescriptionRu('');
      setDescriptionEn('');
      setDeliveryContent('');
      setPrice('');
      await reload();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (id: string, status: 'active' | 'cancelled') => {
    const res = await fetch(`/api/marketplace/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      toast({ title: status === 'active' ? m.published : m.cancelled });
      await reload();
    }
  };

  if (authLoading || !user) {
    return <p className="container py-20 text-center text-muted-foreground">{m.loading}</p>;
  }

  const priceNum = Number(price);
  const payoutPreview = Number.isFinite(priceNum) && priceNum > 0
    ? calcSellerPayout(priceNum)
    : null;

  const statusLabel = (status: string) =>
    (m.statuses as Record<string, string>)[status] ?? status;

  return (
    <div className="container py-12 md:py-20 max-w-3xl">
      <Link
        href={localizedPath(locale, '/marketplace')}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {m.backToMarket}
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold font-headline mb-2">{m.sellTitle}</h1>
        <p className="text-muted-foreground">{m.sellDescription}</p>
      </div>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>{m.newListing}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="titleRu">{m.fieldTitleRu}</Label>
              <Input
                id="titleRu"
                value={titleRu}
                onChange={(e) => setTitleRu(e.target.value)}
                maxLength={120}
                placeholder={m.fieldTitlePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleEn">{m.fieldTitleEn}</Label>
              <Input
                id="titleEn"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                maxLength={120}
                placeholder={m.fieldTitlePlaceholderEn}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{m.fieldCategory}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as MarketplaceCategory)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {(m.categories as Record<string, string>)[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descriptionRu">{m.fieldDescriptionRu}</Label>
            <Textarea
              id="descriptionRu"
              value={descriptionRu}
              onChange={(e) => setDescriptionRu(e.target.value)}
              rows={3}
              placeholder={m.fieldDescriptionPlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descriptionEn">{m.fieldDescriptionEn}</Label>
            <Textarea
              id="descriptionEn"
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              rows={3}
              placeholder={m.fieldDescriptionPlaceholderEn}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery">{m.fieldDelivery}</Label>
            <Textarea
              id="delivery"
              value={deliveryContent}
              onChange={(e) => setDeliveryContent(e.target.value)}
              rows={4}
              placeholder={m.fieldDeliveryPlaceholder}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{m.fieldDeliveryHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">{m.fieldPrice} ({currency.toUpperCase()})</Label>
            <Input
              id="price"
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {payoutPreview !== null && (
              <p className="text-xs text-muted-foreground">
                {m.payoutPreview}: {formatMoney(payoutPreview, currency)}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={() => handleCreate(false)}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {m.saveDraft}
            </Button>
            <Button className="flex-1" disabled={submitting} onClick={() => handleCreate(true)}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {m.publish}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">{m.myListings}</h2>
        {loading ? (
          <p className="text-muted-foreground">{m.loading}</p>
        ) : listings.length === 0 ? (
          <p className="text-muted-foreground">{m.noListings}</p>
        ) : (
          <div className="space-y-3">
            {listings.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{locale === 'ru' ? item.titleRu : item.titleEn}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(item.price, item.currency)} · {statusLabel(item.status)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                    {statusLabel(item.status)}
                  </Badge>
                  {item.status === 'draft' && (
                    <Button size="sm" onClick={() => handleStatus(item.id, 'active')}>
                      {m.publish}
                    </Button>
                  )}
                  {item.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => handleStatus(item.id, 'cancelled')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">{m.mySales}</h2>
        {sales.length === 0 ? (
          <p className="text-muted-foreground">{m.noSales}</p>
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
              <div key={sale.id} className="flex justify-between py-2 border-b border-border/50 text-sm">
                <span>{sale.title}</span>
                <span className="text-green-400">+{formatMoney(sale.sellerPayout, sale.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}