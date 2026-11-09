import type { ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay, Popover } from 'react-aria-components';
import { ChevronDown, X } from 'lucide-react';
export function Popup({label, compactLabel, icon, children, className = ''}: {label: string; compactLabel?: string; icon?: ReactNode; children: (close: () => void) => ReactNode; className?: string}) {
  return <DialogTrigger><Button aria-label={label} className={`control ${className}${compactLabel?' has-compact-label':''}`}>{icon}<span className="full-label">{label}</span>{compactLabel?<span className="compact-label" aria-hidden="true">{compactLabel}</span>:null}<ChevronDown size={14}/></Button><Popover className="popover" placement="bottom start" offset={8}><Dialog aria-label={label}>{({close}) => children(close)}</Dialog></Popover></DialogTrigger>;
}
export function Sheet({label, open, onClose, children, className = ''}: {label: string; open: boolean; onClose: () => void; children: ReactNode; className?: string}) {
  return <ModalOverlay isOpen={open} onOpenChange={value => {if (!value) onClose();}} isDismissable className="overlay"><Modal className={`sheet ${className}`}><Dialog aria-label={label}><header className="sheet-heading"><h2>{label}</h2><button className="icon-button" aria-label={`Fermer ${label}`} onClick={onClose}><X size={20}/></button></header>{children}</Dialog></Modal></ModalOverlay>;
}
export function Field({label, children}: {label: string; children: ReactNode}) { return <label className="field"><span>{label}</span>{children}</label>; }
