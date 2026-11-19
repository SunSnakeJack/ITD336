import { useEffect, useId, useRef, type ReactNode } from 'react'
import './ConfirmDialog.css'

interface ConfirmDialogProps {title:string;message:string;className?:string;icon?:ReactNode;children?:ReactNode;confirmLabel:string;pending?:boolean;danger?:boolean;error?:string;onConfirm:()=>void;onClose:()=>void}

export function ConfirmDialog({title,message,className,icon,children,confirmLabel,pending=false,danger=false,error,onConfirm,onClose}:ConfirmDialogProps){
  const id=useId()
  const cancelRef=useRef<HTMLButtonElement>(null)
  useEffect(()=>{cancelRef.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending)onClose()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[onClose,pending])
  return <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!pending)onClose()}}><section className={className ? `confirm-dialog ${className}` : "confirm-dialog"} role="alertdialog" aria-modal="true" aria-labelledby={id+"-title"} aria-describedby={id+"-message"}><header><h2 id={id+"-title"}>{title}</h2><button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header>{icon}<div id={id+"-message"}><p>{message}</p>{children}</div>{error&&<p className="confirm-dialog-error" role="alert">{error}</p>}<footer><button ref={cancelRef} type="button" disabled={pending} onClick={onClose}>ยกเลิก</button><button className={danger?'danger':''} type="button" disabled={pending} onClick={onConfirm}>{pending?'กำลังดำเนินการ…':confirmLabel}</button></footer></section></div>
}
