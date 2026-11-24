export type CustomerDisplayPrice = {amountCents:number;currency:string;formattedAmount?:string};

/** Presentation of customer cents only; never an estimator, conversion or pricing rule. */
export function formatCustomerAmount(amountCents:number,currency:string,locale:'en'|'fr'|'es'='en'):string|null {
  if(!Number.isSafeInteger(amountCents)||amountCents<0||!/^[A-Z]{3}$/.test(currency))return null;
  try{return new Intl.NumberFormat({en:'en-US',fr:'fr-FR',es:'es-ES'}[locale],{style:'currency',currency}).format(amountCents/100);}
  catch{return null;}
}

export function customerDisplayPrice(amountCents:number,currency:string):CustomerDisplayPrice {
  const formattedAmount=formatCustomerAmount(amountCents,currency);
  return {amountCents,currency,...(formattedAmount===null?{}:{formattedAmount})};
}
