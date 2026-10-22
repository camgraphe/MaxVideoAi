import {quoteStudioAssistance} from '../../../server/pricing/quote-studio-assistance';
import {studioProviderReservation} from './assistance-provider-facts';

/** Fit a new Max response to spendable credits using the same cumulative tariff as settlement.
 * Input is already counted; only the output cap changes, never the counted payload or price.
 * Call under the account lock and persist the selected cap before provider dispatch.
 */
export function fitStudioCreditOutput(input:{inputTokens:number;outputTokens:number;approvedOutputBound:number;basis:number;chargedCents:number;availableCredits:number;tariffVersion:string}):number|null {
  if(input.availableCredits<=0)return null;
  const fits=(outputTokens:number)=>{
    const reserved=studioProviderReservation('gpt-6.1-sol',input.inputTokens,outputTokens,input.approvedOutputBound);
    return (quoteStudioAssistance(input.basis+reserved,input.tariffVersion).customerTotalCents-input.chargedCents)*10<=input.availableCredits;
  };
  // Keep a small positive output floor; otherwise let Standard continue.
  let low=16,high=input.outputTokens;
  if(high<low||!fits(low))return null;
  while(low<high){const mid=Math.ceil((low+high)/2);if(fits(mid))low=mid;else high=mid-1;}
  return low;
}
