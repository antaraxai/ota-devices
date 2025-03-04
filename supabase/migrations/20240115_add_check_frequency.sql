-- Add check_frequency column to websites table
alter table websites
    add column if not exists check_frequency text default 'daily';

comment on column websites.check_frequency is 'Frequency of website status checks (daily, weekly, monthly, yearly)';