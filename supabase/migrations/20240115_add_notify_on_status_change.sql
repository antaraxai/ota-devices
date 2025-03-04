-- Add notify_on_status_change column to websites table
alter table websites
    add column if not exists notify_on_status_change boolean default false;

comment on column websites.notify_on_status_change is 'Flag to control status change notifications for each website';