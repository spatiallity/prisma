-- ============================================================================
-- PJ UMK — the person who withdraws the money from the corporate fund — is a
-- different person from personil_nama (who the money is spent ON/FOR). Kept
-- as plain denormalized text, same convention as personil_nama already uses
-- on this table; no directory table, the UI autocompletes off whatever names
-- have already been typed.
-- ============================================================================

alter table finance_transactions add column pj_nama text;
