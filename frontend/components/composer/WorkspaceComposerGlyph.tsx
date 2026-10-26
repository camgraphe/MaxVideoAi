/** @license
 * MIT License
 *
 * Copyright (c) 2025 Hugeicons
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';

// Exact Stroke Rounded paths from @hugeicons/core-free-icons 4.3.5.
// Only the approved composer subset is shipped; no runtime icon dependency.
const glyphs = {
  // VideoAiIcon
  create: <>
    <path d="M18.9737 15.0215C18.9795 14.9928 19.0205 14.9928 19.0263 15.0215C19.3302 16.5081 20.4919 17.6698 21.9785 17.9737C22.0072 17.9795 22.0072 18.0205 21.9785 18.0263C20.4919 18.3302 19.3302 19.4919 19.0263 20.9785C19.0205 21.0072 18.9795 21.0072 18.9737 20.9785C18.6698 19.4919 17.5081 18.3302 16.0215 18.0263C15.9928 18.0205 15.9928 17.9795 16.0215 17.9737C17.5081 17.6698 18.6698 16.5081 18.9737 15.0215Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M14.6469 12.6727C15.3884 12.1531 15.7591 11.8934 15.9075 11.5158C16.0308 11.2021 16.0308 10.7979 15.9075 10.4842C15.7591 10.1066 15.3884 9.84685 14.6469 9.3273C14.1274 8.9633 13.5894 8.60214 13.1167 8.3165C12.7229 8.07852 12.2589 7.82314 11.7929 7.57784C11.005 7.16312 10.6111 6.95576 10.2297 7.00792C9.91348 7.05115 9.58281 7.25237 9.38829 7.5199C9.1536 7.84266 9.12432 8.30677 9.06577 9.23497C9.02725 9.84551 9 10.4661 9 11C9 11.5339 9.02725 12.1545 9.06577 12.765C9.12432 13.6932 9.1536 14.1573 9.38829 14.4801C9.58281 14.7476 9.91348 14.9489 10.2297 14.9921C10.6111 15.0442 11.005 14.8369 11.7929 14.4221C12.2589 14.1768 12.7229 13.9215 13.1167 13.6835C13.5894 13.3978 14.1274 13.0367 14.6469 12.6727Z" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/>
    <path d="M21.872 14.8357C22 13.9227 22 12.7279 22 11C22 8.19974 22 6.79961 21.455 5.73005C20.9757 4.78924 20.2108 4.02433 19.27 3.54497C18.2004 3 16.8003 3 14 3H10C7.19974 3 5.79961 3 4.73005 3.54497C3.78924 4.02433 3.02433 4.78924 2.54497 5.73005C2 6.79961 2 8.19974 2 11C2 13.8003 2 15.2004 2.54497 16.27C3.02433 17.2108 3.78924 17.9757 4.73005 18.455C5.79961 19 7.19974 19 10 19H13.4257" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </>,
  // AiReplaceIcon
  modify: <>
    <path d="M8 20C6.13623 20 5.20435 20 4.46927 19.6955C3.48915 19.2895 2.71046 18.5108 2.30448 17.5307C2 16.7956 2 15.8638 2 14V10C2 8.13623 2 7.20435 2.30448 6.46927C2.71046 5.48915 3.48915 4.71046 4.46927 4.30448C5.20435 4 6.13623 4 8 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M22 10V14C22 15.8638 22 16.7956 21.6955 17.5307C21.2895 18.5108 20.5108 19.2895 19.5307 19.6955C18.7956 20 17.8638 20 16 20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M12 2V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M19.5 2.9375V4.5M19.5 4.5V6.0625M19.5 4.5H18.25M19.5 4.5H20.75M22 4.5L20.9156 4.13852C20.4179 3.97263 20.0274 3.58211 19.8615 3.08443L19.5 2L19.1385 3.08443C18.9726 3.58211 18.5821 3.97263 18.0844 4.13852L17 4.5L18.0844 4.86148C18.5821 5.02737 18.9726 5.41789 19.1385 5.91557L19.5 7L19.8615 5.91557C20.0274 5.41789 20.4179 5.02737 20.9156 4.86148L22 4.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </>,
  // KeyframesMultipleAddIcon
  extend: <>
    <path d="M6.5 6.15642C7.16531 5.38547 7.58503 5 8.10017 5C8.73332 5 9.22232 5.58231 10.2003 6.74694L12.4677 9.44699C13.4892 10.6634 14 11.2716 14 12C14 12.7284 13.4892 13.3366 12.4677 14.553L10.2003 17.2531C9.22232 18.4177 8.73332 19 8.10017 19C7.58503 19 7.16531 18.6145 6.5 17.8436" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M5 15L5 9M2 12H8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/>
    <path d="M13 19L16.5118 14.6032C17.5039 13.361 18 12.7398 18 12C18 11.2602 17.5039 10.639 16.5118 9.39683L13 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M17 19L20.5118 14.6032C21.5039 13.361 22 12.7398 22 12C22 11.2602 21.5039 10.639 20.5118 9.39683L17 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </>,
  // KeyframeLeftIcon
  start: <>
    <path d="M18.9975 10.6909C19.6658 11.2951 20 11.5971 20 12C20 12.4029 19.6658 12.7049 18.9975 13.3091L17.3537 14.7948C16.4649 15.5983 16.0205 16 15.5 16C14.9795 16 14.5351 15.5983 13.6463 14.7948L12.0025 13.3091C11.3342 12.7049 11 12.4029 11 12C11 11.5971 11.3342 11.2951 12.0025 10.6909L13.6463 9.20516C14.5351 8.40172 14.9795 8 15.5 8C16.0205 8 16.4649 8.40172 17.3537 9.20515L18.9975 10.6909Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 12H4M4 3L4 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </>,
  // KeyframeRightIcon
  end: <>
    <path d="M5.00253 13.3091C4.33418 12.7049 4 12.4029 4 12C4 11.5971 4.33418 11.2951 5.00253 10.6909L6.64627 9.20515C7.53512 8.40172 7.97954 8 8.5 8C9.02046 8 9.46488 8.40172 10.3537 9.20515L11.9975 10.6909C12.6658 11.2951 13 11.5971 13 12C13 12.4029 12.6658 12.7049 11.9975 13.3091L10.3537 14.7948C9.46488 15.5983 9.02046 16 8.5 16C7.97954 16 7.53512 15.5983 6.64627 14.7948L5.00253 13.3091Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M16 12H20M20 21L20 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </>,
  // ImagesIcon
  reference: <>
    <path d="M4 17.0429L8.75635 12.6942C10.4331 11.1612 11.2714 10.3947 12.3096 10.3191C13.3478 10.2435 14.2884 10.8805 16.1695 12.1545L17.5 13.0556" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/>
    <path d="M7.375 7.25H7.25M7.5 7.25C7.5 7.38807 7.38807 7.5 7.25 7.5C7.11193 7.5 7 7.38807 7 7.25C7 7.11193 7.11193 7 7.25 7C7.38807 7 7.5 7.11193 7.5 7.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M6 17.9745C6.1287 19.2829 6.41956 20.1636 7.07691 20.8209C8.25596 22 10.1536 22 13.9489 22C17.7442 22 19.6419 22 20.8209 20.8209C22 19.6419 22 17.7442 22 13.9489C22 10.1536 22 8.25596 20.8209 7.07691C20.1636 6.41956 19.2829 6.1287 17.9745 6" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 10C2 6.22876 2 4.34315 3.17157 3.17157C4.34315 2 6.22876 2 10 2C13.7712 2 15.6569 2 16.8284 3.17157C18 4.34315 18 6.22876 18 10C18 13.7712 18 15.6569 16.8284 16.8284C15.6569 18 13.7712 18 10 18C6.22876 18 4.34315 18 3.17157 16.8284C2 15.6569 2 13.7712 2 10Z" stroke="currentColor" strokeWidth="1.5"/>
  </>,
  // Add01Icon
  add: <>
    <path d="M12.001 5.00003V19.002" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M19.002 12.002L4.99998 12.002" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </>,
} as const;

export function WorkspaceComposerGlyph({ name, className }: { name: keyof typeof glyphs; className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    {glyphs[name]}
  </svg>;
}
