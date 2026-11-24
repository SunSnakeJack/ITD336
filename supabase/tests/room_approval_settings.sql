begin;
do $$
declare
 v_start timestamptz := '2026-11-24 16:30:00+07';
 v_end timestamptz := '2026-11-24 17:00:00+07';
begin
 assert public.room_approval_display_status('PENDING_APPROVAL','START',v_start,v_end,v_start-interval '1 second')='PENDING_APPROVAL';
 assert public.room_approval_display_status('PENDING_APPROVAL','START',v_start,v_end,v_start)='EXPIRED';
 assert public.room_approval_display_status('PENDING_APPROVAL','END',v_start,v_end,v_start)='PENDING_STARTED';
 assert public.room_approval_display_status('PENDING','END',v_start,v_end,v_end)='EXPIRED';
 assert public.room_approval_display_status('APPROVED','START',v_start,v_end,v_end)='APPROVED';
end $$;
rollback;
