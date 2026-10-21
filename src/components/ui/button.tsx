import { ComponentProps } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function Button({className,variant='primary',...props}:ComponentProps<'button'>&{variant?:'primary'|'secondary'|'ghost'|'danger'}) {return <button className={twMerge(clsx('button',`button-${variant}`,className))} {...props}/>;}
