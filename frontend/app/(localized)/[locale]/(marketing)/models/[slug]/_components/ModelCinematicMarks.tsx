import * as React from 'react';
import { Plus } from 'lucide-react';

/** Fixed SVG geometry avoids font-dependent baselines inside small circular controls. */
export function CinematicPlus() {
  return <Plus className="cinema-plus-icon" size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}

/**
 * Official Phosphor Icons, MIT. Path geometry is unchanged from the vendored SVGs.
 * Source revision, original files and license: ./_icons/phosphor/.
 */
const benefitMarks = [
  <><path d="M168,96V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8H160A8,8,0,0,1,168,96Z" opacity="0.2" /><path d="M64,216a8,8,0,0,1-8,8H48a16,16,0,0,1-16-16v-8a8,8,0,0,1,16,0v8h8A8,8,0,0,1,64,216Zm48-8H96a8,8,0,0,0,0,16h16a8,8,0,0,0,0-16ZM40,168a8,8,0,0,0,8-8V144a8,8,0,0,0-16,0v16A8,8,0,0,0,40,168Zm128,24a8,8,0,0,0-8,8v8h-8a8,8,0,0,0,0,16h8a16,16,0,0,0,16-16v-8A8,8,0,0,0,168,192Zm0-80a8,8,0,0,0,8-8V96a16,16,0,0,0-16-16h-8a8,8,0,0,0,0,16h8v8A8,8,0,0,0,168,112ZM56,80H48A16,16,0,0,0,32,96v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16ZM208,32H96A16,16,0,0,0,80,48V88a4.44,4.44,0,0,0,0,.55A8,8,0,0,0,88,96h24a8,8,0,0,0,0-16H96V48H208V160H176V144a8,8,0,0,0-16,0v24a8,8,0,0,0,8,8h40a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Z" /></>,
  <><path d="M232,164c0,15.46-14.33,28-32,28s-32-12.54-32-28,14.33-28,32-28S232,148.54,232,164ZM34.82,152h90.36L80,56Z" opacity="0.2" /><path d="M87.24,52.59a8,8,0,0,0-14.48,0l-64,136a8,8,0,1,0,14.48,6.81L39.9,160h80.2l16.66,35.4a8,8,0,1,0,14.48-6.81ZM47.43,144,80,74.79,112.57,144ZM200,96c-12.76,0-22.73,3.47-29.63,10.32a8,8,0,0,0,11.26,11.36c3.8-3.77,10-5.68,18.37-5.68,13.23,0,24,9,24,20v3.22A42.76,42.76,0,0,0,200,128c-22.06,0-40,16.15-40,36s17.94,36,40,36a42.73,42.73,0,0,0,24-7.25,8,8,0,0,0,16-.75V132C240,112.15,222.06,96,200,96Zm0,88c-13.23,0-24-9-24-20s10.77-20,24-20,24,9,24,20S213.23,184,200,184Z" /></>,
  <><path d="M160,112a32,32,0,1,1-32-32A32,32,0,0,1,160,112Z" opacity="0.2" /><path d="M224,40V76a8,8,0,0,1-16,0V48H180a8,8,0,0,1,0-16h36A8,8,0,0,1,224,40Zm-8,132a8,8,0,0,0-8,8v28H180a8,8,0,0,0,0,16h36a8,8,0,0,0,8-8V180A8,8,0,0,0,216,172ZM76,208H48V180a8,8,0,0,0-16,0v36a8,8,0,0,0,8,8H76a8,8,0,0,0,0-16ZM40,84a8,8,0,0,0,8-8V48H76a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8V76A8,8,0,0,0,40,84Zm136,92a8,8,0,0,1-6.41-3.19,52,52,0,0,0-83.2,0,8,8,0,1,1-12.8-9.62A67.94,67.94,0,0,1,101,141.51a40,40,0,1,1,53.94,0,67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,176,176Zm-48-40a24,24,0,1,0-24-24A24,24,0,0,0,128,136Z" /></>,
  <><path d="M40,128h88v88H48a8,8,0,0,1-8-8ZM208,40H128v88h88V48A8,8,0,0,0,208,40Z" opacity="0.2" /><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,88H136V48h72ZM120,48v72H48V48ZM48,136h72v72H48Zm160,72H136V136h72v72Z" /></>,
];

export function CinematicArrow({ direction = 'right', disc = false }: {
  direction?: 'right' | 'down' | 'external'; disc?: boolean;
}) {
  const arrow = <svg className={`cinema-arrow cinema-arrow--${direction}`} width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
  </svg>;
  return disc ? <span className="cinema-action-disc" aria-hidden="true">{arrow}</span> : arrow;
}

/** Decorative Duotone symbols; the adjacent text supplies the accessible label. */
export function CinematicBenefitMark({ index }: { index: number }) {
  return <svg className="cinema-benefit-mark" width="36" height="36" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">
    {benefitMarks[index]}
  </svg>;
}
