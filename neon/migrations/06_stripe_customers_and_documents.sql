begin;

alter table if exists profiles
  add column if not exists stripe_customer_id text;

alter table if exists app_receipts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_hosted_invoice_url text,
  add column if not exists stripe_invoice_pdf text,
  add column if not exists stripe_receipt_url text,
  add column if not exists stripe_document_synced_at timestamptz;

do $$
begin
  if to_regclass('public.profiles') is not null then
    create unique index if not exists profiles_stripe_customer_id_unique
      on profiles (stripe_customer_id)
      where stripe_customer_id is not null;
  end if;

  if to_regclass('public.app_receipts') is not null then
    create unique index if not exists app_receipts_stripe_checkout_session_id_unique
      on app_receipts (stripe_checkout_session_id)
      where stripe_checkout_session_id is not null;

    create unique index if not exists app_receipts_stripe_invoice_id_unique
      on app_receipts (stripe_invoice_id)
      where stripe_invoice_id is not null;

    create index if not exists app_receipts_stripe_customer_id_idx
      on app_receipts (stripe_customer_id)
      where stripe_customer_id is not null;
  end if;
end $$;

commit;
