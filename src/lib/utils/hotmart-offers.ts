export interface HotmartOffer {
  offer_code: string;
  offer_name: string;
  price: number | null;
  currency: string | null;
  is_main_offer: boolean;
}

/**
 * Sort offers: main offer first, then alphabetical by offer_name (pt-BR locale).
 * Does not mutate the original array.
 */
export function sortOffers(offers: HotmartOffer[]): HotmartOffer[] {
  return [...offers].sort((a, b) => {
    if (a.is_main_offer !== b.is_main_offer) return a.is_main_offer ? -1 : 1;
    return a.offer_name.localeCompare(b.offer_name, "pt-BR");
  });
}
