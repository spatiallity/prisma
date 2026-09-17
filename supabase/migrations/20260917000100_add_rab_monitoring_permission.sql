-- Separate access to the RAB monitoring dashboard from category expense entry.
alter type app_module add value if not exists 'rab_monitoring';
