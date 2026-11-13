import { useEffect, useRef } from 'react'
import './ConfirmDialog.css'

interface ConfirmDialogProps {title:string;message:string;confirmLabel:string;pending?:boolean;danger?:boolean;error?:string;onConfirm:()=>void;onClose:()=>void}

export function ConfirmDialog({title,message,confirmLabel,pending=false,danger=false,error,onConfirm,onClose}:ConfirmDialogProps){
  const cancelRef=useRef<HTMLButtonElement>(null)
  useEffect(()=>{cancelRef.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending)onClose()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[onClose,pending])
  return <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!pending)onClose()}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"><header><h2 id="confirm-dialog-title">{title}</h2><button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header><p id="confirm-dialog-message">{message}</p>{error&&<p className="confirm-dialog-error" role="alert">{error}</p>}<footer><button ref={cancelRef} type="button" disabled={pending} onClick={onClose}>ยกเลิก</button><button className={danger?'danger':''} type="button" disabled={pending} onClick={onConfirm}>{pending?'กำลังดำเนินการ…':confirmLabel}</button></footer></section></div>
}
